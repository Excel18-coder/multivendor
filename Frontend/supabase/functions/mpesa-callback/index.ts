import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('M-Pesa callback received');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const callbackData = await req.json();
    console.log('Callback data:', JSON.stringify(callbackData, null, 2));

    const response = callbackData.response;
    const status = callbackData.status;
    
    // Determine payment status
    let paymentStatus = 'failed';
    if (status === true && response?.Status?.toLowerCase() === 'success') {
      paymentStatus = 'success';
    } else if (response?.Status?.toLowerCase() === 'failed') {
      paymentStatus = 'failed';
    }

    // Find and update the payment request by external reference
    const externalReference = response?.ExternalReference;
    
    if (externalReference) {
      const { error: updateError } = await supabase
        .from('mpesa_payment_requests')
        .update({
          status: paymentStatus,
          mpesa_receipt_number: response?.MpesaReceiptNumber,
          result_desc: response?.ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('external_reference', externalReference);

      if (updateError) {
        console.error('Error updating payment request:', updateError);
      } else {
        console.log(`Payment request updated: ${externalReference} -> ${paymentStatus}`);
      }
    }

    // Respond with "ok" as required by Lipia
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Still return ok to acknowledge receipt
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
