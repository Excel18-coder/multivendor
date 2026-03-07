import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PaymentButtonProps {
  amount: number;
  currency?: string;
  description?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const PaymentButton = ({ amount }: PaymentButtonProps) => {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      onClick={() => navigate("/cart")}
      className="bg-green-600 hover:bg-green-700 w-full"
    >
      <CreditCard className="mr-2" size={16} />
      Pay KSh {amount.toLocaleString()} via M-Pesa (from Cart)
    </Button>
  );
};