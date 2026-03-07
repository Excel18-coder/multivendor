-- Add M-Pesa columns to stores table
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS mpesa_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mpesa_type text,
ADD COLUMN IF NOT EXISTS mpesa_number text,
ADD COLUMN IF NOT EXISTS mpesa_account_number text,
ADD COLUMN IF NOT EXISTS mpesa_bank_name text,
ADD COLUMN IF NOT EXISTS mpesa_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS mpesa_api_key text,
ADD COLUMN IF NOT EXISTS mpesa_approved_at timestamp with time zone;

-- Create table for M-Pesa payment requests (for STK push tracking)
CREATE TABLE IF NOT EXISTS public.mpesa_payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  external_reference text,
  transaction_reference text,
  status text DEFAULT 'pending',
  mpesa_receipt_number text,
  result_desc text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on mpesa_payment_requests
ALTER TABLE public.mpesa_payment_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Store owners can view their payment requests
CREATE POLICY "Store owners can view their payment requests"
ON public.mpesa_payment_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = mpesa_payment_requests.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Policy: Store owners can create payment requests
CREATE POLICY "Store owners can create payment requests"
ON public.mpesa_payment_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = mpesa_payment_requests.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Policy: Anyone can view payment requests (for callback updates)
CREATE POLICY "Public can view payment requests by reference"
ON public.mpesa_payment_requests
FOR SELECT
USING (true);

-- Policy: Service role can update payment requests (for callbacks)
CREATE POLICY "Service can update payment requests"
ON public.mpesa_payment_requests
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_mpesa_payment_requests_updated_at
BEFORE UPDATE ON public.mpesa_payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_settings_updated_at();