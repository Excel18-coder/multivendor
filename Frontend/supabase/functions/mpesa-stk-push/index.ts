import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIPIA_BASE_URL = "https://lipia-api.kreativelabske.com/api/v2";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, storeId, phoneNumber, amount, externalReference, metadata } = await req.json();

    console.log(`M-Pesa STK Push action: ${action}`, { storeId, phoneNumber, amount });

    if (action === 'initiate') {
      // Get store's M-Pesa API key
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('mpesa_api_key, mpesa_enabled, mpesa_status, name')
        .eq('id', storeId)
        .single();

      if (storeError || !store) {
        console.error('Store not found:', storeError);
        return new Response(
          JSON.stringify({ success: false, error: 'Store not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!store.mpesa_enabled || store.mpesa_status !== 'approved' || !store.mpesa_api_key) {
        console.error('M-Pesa not enabled or approved for this store');
        return new Response(
          JSON.stringify({ success: false, error: 'M-Pesa payments not enabled for this store' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Format phone number to 2547XXXXXXXX format
      let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
      
      // Remove + if present and handle different formats
      formattedPhone = formattedPhone.replace(/^\+/, '');
      
      if (formattedPhone.startsWith('254')) {
        // Already in correct format (254XXXXXXXXX)
        // Keep as is
      } else if (formattedPhone.startsWith('0')) {
        // Convert 07XXXXXXXX or 01XXXXXXXX to 2547XXXXXXXX or 2541XXXXXXXX
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
        // Handle 7XXXXXXXX or 1XXXXXXXX format
        formattedPhone = '254' + formattedPhone;
      }
      
      // Validate the final format (should be 12 digits starting with 254)
      if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        console.error('Invalid phone number format:', { original: phoneNumber, formatted: formattedPhone });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid phone number format. Please use a valid Safaricom number (07XX or 01XX).' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Formatted phone number:', { original: phoneNumber, formatted: formattedPhone });

      // Generate external reference if not provided
      const reference = externalReference || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Build callback URL
      const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-callback`;

      console.log('Initiating STK Push to Lipia API...', { formattedPhone, amount, reference });

      // Call Lipia STK Push API
      const lipiaResponse = await fetch(`${LIPIA_BASE_URL}/payments/stk-push`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${store.mpesa_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: formattedPhone,
          amount: Math.round(amount),
          external_reference: reference,
          callback_url: callbackUrl,
          metadata: {
            store_id: storeId,
            store_name: store.name,
            ...metadata
          }
        }),
      });

      const lipiaData = await lipiaResponse.json();
      console.log('Lipia API response:', lipiaData);

      if (!lipiaResponse.ok || !lipiaData.success) {
        console.error('Lipia API error:', lipiaData);
        
        // Provide more helpful error messages
        let errorMessage = lipiaData.message || 'Failed to initiate payment';
        const mpesaError = lipiaData.error?.mpesaError?.errorMessage;
        
        if (mpesaError?.includes('Invalid PhoneNumber')) {
          errorMessage = 'Invalid phone number. Please ensure you are using a valid, M-Pesa registered Safaricom number. If using a test API key, use test numbers from your Lipia dashboard.';
        } else if (mpesaError) {
          errorMessage = mpesaError;
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store the payment request
      const { data: paymentRequest, error: insertError } = await supabase
        .from('mpesa_payment_requests')
        .insert({
          store_id: storeId,
          phone_number: formattedPhone,
          amount: amount,
          external_reference: reference,
          transaction_reference: lipiaData.data?.TransactionReference,
          status: 'pending',
          metadata: metadata
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing payment request:', insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transactionReference: lipiaData.data?.TransactionReference,
            externalReference: reference,
            paymentRequestId: paymentRequest?.id
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check-status') {
      const { transactionReference, storeId: checkStoreId } = await req.json();

      // Get store's API key
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('mpesa_api_key')
        .eq('id', checkStoreId)
        .single();

      if (storeError || !store?.mpesa_api_key) {
        return new Response(
          JSON.stringify({ success: false, error: 'Store not found or M-Pesa not configured' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check payment status with Lipia
      const statusResponse = await fetch(
        `${LIPIA_BASE_URL}/payments/status?reference=${transactionReference}`,
        {
          headers: {
            'Authorization': `Bearer ${store.mpesa_api_key}`,
          },
        }
      );

      const statusData = await statusResponse.json();
      console.log('Payment status check:', statusData);

      // Update local record if status changed
      if (statusData.data?.response?.Status) {
        const status = statusData.data.response.Status.toLowerCase();
        await supabase
          .from('mpesa_payment_requests')
          .update({
            status: status,
            mpesa_receipt_number: statusData.data.response.MpesaReceiptNumber,
            result_desc: statusData.data.response.ResultDesc
          })
          .eq('transaction_reference', transactionReference);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: statusData.data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('M-Pesa STK Push error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
