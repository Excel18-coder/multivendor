
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle, CheckCircle } from "lucide-react";

export const SubscriptionStatus = () => {
  // Mock subscription data - this will be replaced with real Supabase/Stripe data
  const subscriptionStatus = {
    isActive: true,
    plan: "Basic Seller",
    nextBilling: "2024-02-15",
    amount: 1500 // KSh per month
  };

  return (
    <Card className="mb-8 border-l-4 border-l-green-500">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Subscription Status</span>
          </div>
          <Badge className={subscriptionStatus.isActive ? "bg-green-500" : "bg-red-500"}>
            {subscriptionStatus.isActive ? (
              <><CheckCircle size={12} className="mr-1" /> Active</>
            ) : (
              <><AlertTriangle size={12} className="mr-1" /> Inactive</>
            )}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subscriptionStatus.isActive ? (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div>
              <p className="text-lg font-semibold text-green-700">{subscriptionStatus.plan}</p>
              <p className="text-gray-600">
                Next billing: {subscriptionStatus.nextBilling} • KSh {subscriptionStatus.amount.toLocaleString()}/month
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                Manage Subscription
              </Button>
              <Button variant="outline" size="sm">
                Upgrade Plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Subscription Required</h3>
            <p className="text-gray-600 mb-4">
              You need an active subscription to sell on Urban Stores.
            </p>
            <Button className="bg-orange-600 hover:bg-orange-700">
              Subscribe Now - KSh 1,500/month
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
