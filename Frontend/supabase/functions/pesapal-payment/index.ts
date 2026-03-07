import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { amount, currency = "KES", description = "Payment" } = await req.json();

    // PesaPal credentials
    const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET");

    if (!consumerKey || !consumerSecret) {
      throw new Error("PesaPal credentials not configured");
    }

    // Get PesaPal access token
    const tokenResponse = await fetch("https://cybqa.pesapal.com/pesapalv3/api/Auth/RequestToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.token) {
      throw new Error("Failed to get PesaPal access token");
    }

    // Create payment order
    const orderData = {
      id: crypto.randomUUID(),
      currency: currency,
      amount: amount,
      description: description,
      callback_url: `${req.headers.get("origin")}/payment-success`,
      cancellation_url: `${req.headers.get("origin")}/payment-canceled`,
      notification_id: crypto.randomUUID(),
      billing_address: {
        email_address: user.email,
        phone_number: "",
        country_code: "KE",
        first_name: user.user_metadata?.full_name?.split(" ")[0] || "Customer",
        middle_name: "",
        last_name: user.user_metadata?.full_name?.split(" ")[1] || "",
        line_1: "",
        line_2: "",
        city: "",
        state: "",
        postal_code: "",
        zip_code: "",
      },
    };

    const paymentResponse = await fetch("https://cybqa.pesapal.com/pesapalv3/api/Transactions/SubmitOrderRequest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${tokenData.token}`,
      },
      body: JSON.stringify(orderData),
    });

    const paymentData = await paymentResponse.json();
    
    if (!paymentData.redirect_url) {
      throw new Error("Failed to create PesaPal payment");
    }

    // Store payment in database
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    await supabaseService.from("orders").insert({
      user_id: user.id,
      total_amount: amount,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ 
        redirect_url: paymentData.redirect_url,
        order_tracking_id: paymentData.order_tracking_id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("PesaPal payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});