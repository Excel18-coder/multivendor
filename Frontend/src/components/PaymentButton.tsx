import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { getToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface PaymentButtonProps {
  amount: number;
  currency?: string;
  description?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const PaymentButton = ({ 
  amount, 
  currency = "KES", 
  description = "Payment",
  onSuccess,
  onError 
}: PaymentButtonProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to make a payment",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
      const token = getToken();
      const res = await fetch(`${BASE_URL}/payments/pesapal/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount, currency, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Payment request failed');

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
        onSuccess?.();
      } else {
        throw new Error('No payment URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handlePayment} 
      disabled={loading}
      className="bg-green-600 hover:bg-green-700"
    >
      <CreditCard className="mr-2" size={16} />
      {loading ? "Processing..." : `Pay KSh ${amount.toLocaleString()}`}
    </Button>
  );
};