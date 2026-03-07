import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { cartApi, orderApi, type CartItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";

const Checkout = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { updateCartCount } = useAppContext();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });

  useEffect(() => {
    if (user) {
      fetchCartItems();
      setShippingInfo(prev => ({
        ...prev,
        email: user.email || "",
      }));
    }
  }, [user]);

  const fetchCartItems = async () => {
    try {
      const data = await cartApi.get();
      setCartItems(data);
    } catch {
      toast({ title: "Error", description: "Failed to load cart items", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getSubtotal = () => cartItems.reduce((t, i) => t + (i.product?.price ?? 0) * i.quantity, 0);
  const getDeliveryFee = () => 0;
  const getTotal = () => getSubtotal() + getDeliveryFee();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const address = [
        shippingInfo.fullName,
        shippingInfo.address,
        shippingInfo.city,
        shippingInfo.postalCode,
        shippingInfo.phone,
      ].filter(Boolean).join(", ");
      await orderApi.create({ shipping_address: address });
      updateCartCount();
      toast({ title: "Order Placed Successfully!", description: "Your order has been placed. You'll be contacted for delivery." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to process order. Please try again.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please Login</h1>
            <p className="text-gray-600 mb-6">You need to login to checkout</p>
            <Link to="/auth">
              <Button className="bg-orange-600 hover:bg-orange-700">Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
            <p className="text-gray-600 mb-6">Add some items to your cart before checkout</p>
            <Link to="/marketplace">
              <Button className="bg-orange-600 hover:bg-orange-700">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={shippingInfo.fullName}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, fullName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={shippingInfo.email}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo(prev => ({ ...prev, address: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={shippingInfo.city}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, city: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={shippingInfo.postalCode}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, postalCode: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={processing}
                  >
                    {processing ? "Processing..." : "Place Order (Cash on Delivery)"}
                  </Button>
                  <p className="text-sm text-center text-gray-500">
                    For M-Pesa payments, use the <Link to="/cart" className="text-orange-600 underline">Cart page</Link> to pay store by store.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <img
                      src={item.product?.image_url ?? item.product?.images?.[0] ?? "/placeholder.svg"}
                      alt={item.product?.name ?? "Product"}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{item.product?.name ?? item.product_name ?? "Unknown"}</h4>
                      <p className="text-sm text-gray-500">{item.product?.store?.name ?? item.store_name}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">
                      KSh {((item.product?.price ?? item.price ?? 0) * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>KSh {getSubtotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span>KSh {getDeliveryFee().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>KSh {getTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
