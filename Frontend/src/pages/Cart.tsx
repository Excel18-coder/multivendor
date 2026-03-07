import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Minus, ShoppingBag, MessageCircle, Smartphone, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cartApi, paymentApi, type CartItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppContext } from "@/contexts/AppContext";

interface StoreGroup {
  storeId: string;
  storeName: string;
  storeSlug: string | null;
  whatsappPhone: string | null;
  mpesaApiKey: string | null;
  items: CartItem[];
  subtotal: number;
}

const Cart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { updateCartCount } = useAppContext();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreGroup | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchCartItems();
    else setLoading(false);
  }, [user]);

  // Poll payment status
  useEffect(() => {
    if (paymentStatus !== "pending" || !checkoutRequestId || !selectedStore) return;
    const interval = setInterval(async () => {
      try {
        const res = await paymentApi.mpesaStatus(checkoutRequestId, selectedStore.storeId);
        if (res.status === "success" || res.status === "completed") {
          setPaymentStatus("success");
          clearInterval(interval);
          toast({ title: "Payment Successful!", description: "Your payment was received." });
        } else if (res.status === "failed") {
          setPaymentStatus("failed");
          clearInterval(interval);
          toast({ title: "Payment Failed", description: res.result_desc ?? "Payment not completed", variant: "destructive" });
        }
      } catch {}
    }, 5000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (paymentStatus === "pending") {
        setPaymentStatus("failed");
        toast({ title: "Payment Timeout", description: "Check your M-Pesa messages.", variant: "destructive" });
      }
    }, 150000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [paymentStatus, checkoutRequestId, selectedStore]);

  const fetchCartItems = async () => {
    try {
      const data = await cartApi.get();
      setCartItems(data);
    } catch {
      toast({ title: "Error", description: "Failed to load cart", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const groupItemsByStore = (): StoreGroup[] => {
    const map = new Map<string, StoreGroup>();
    cartItems.forEach((item) => {
      const storeId = item.product?.store?.id ?? "unknown";
      const storeName = item.product?.store?.name ?? "Unknown Store";
      const storeSlug = item.product?.store?.slug ?? null;
      const whatsappPhone = item.product?.store?.whatsapp ?? null;
      const mpesaApiKey = item.product?.store?.mpesa_api_key ?? null;
      if (!map.has(storeId)) {
        map.set(storeId, { storeId, storeName, storeSlug, whatsappPhone, mpesaApiKey, items: [], subtotal: 0 });
      }
      const g = map.get(storeId)!;
      g.items.push(item);
      g.subtotal += (item.product?.price ?? 0) * item.quantity;
    });
    return Array.from(map.values());
  };

  const updateQuantity = async (itemId: string, newQty: number) => {
    if (newQty <= 0) { await removeItem(itemId); return; }
    try {
      await cartApi.update(itemId, newQty);
      setCartItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));
      updateCartCount();
    } catch {
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await cartApi.remove(itemId);
      setCartItems(prev => prev.filter(i => i.id !== itemId));
      updateCartCount();
      toast({ title: "Removed", description: "Item removed from cart" });
    } catch {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    }
  };

  const getTotalPrice = () => cartItems.reduce((t, i) => t + (i.product?.price ?? 0) * i.quantity, 0);

  const handleOrderOnWhatsApp = (g: StoreGroup) => {
    if (!g.whatsappPhone) {
      toast({ title: "WhatsApp not available", description: "Store hasn't set up WhatsApp ordering.", variant: "destructive" });
      return;
    }
    const lines = g.items.map(i => `• ${i.product?.name} x${i.quantity} - KSh ${((i.product?.price ?? 0) * i.quantity).toLocaleString()}`).join("\n");
    const msg = `Hello! I'd like to order from ${g.storeName}:\n\n${lines}\n\nTotal: KSh ${g.subtotal.toLocaleString()}`;
    window.open(`https://wa.me/${g.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handlePayViaMpesa = (g: StoreGroup) => {
    if (!g.mpesaApiKey) {
      toast({ title: "M-Pesa Not Available", description: "Store hasn't activated M-Pesa payments yet.", variant: "destructive" });
      return;
    }
    setSelectedStore(g);
    setPhoneNumber("");
    setPaymentStatus("idle");
    setCheckoutRequestId(null);
    setMpesaDialogOpen(true);
  };

  const initiatePayment = async () => {
    if (!selectedStore || !phoneNumber) return;
    const clean = phoneNumber.replace(/\s+/g, "");
    if (!/^(254|0|\+254)?[17]\d{8}$/.test(clean)) {
      toast({ title: "Invalid Phone Number", description: "Enter a valid Safaricom number", variant: "destructive" });
      return;
    }
    setPaymentLoading(true);
    try {
      const ref = `ORDER-${Date.now()}`;
      const res = await paymentApi.mpesaInitiate({ store_id: selectedStore.storeId, phone: clean, amount: selectedStore.subtotal, order_reference: ref });
      setCheckoutRequestId(res.checkout_request_id);
      setPaymentStatus("pending");
      toast({ title: "STK Push Sent", description: "Check your phone and enter M-Pesa PIN" });
    } catch (err: any) {
      setPaymentStatus("failed");
      toast({ title: "Payment Failed", description: err.message, variant: "destructive" });
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Please Login</h1>
        <p className="text-gray-600 mb-6">You need to login to view your cart</p>
        <Link to="/auth"><Button className="bg-orange-600 hover:bg-orange-700">Login</Button></Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600" />
      </div>
    </div>
  );

  const storeGroups = groupItemsByStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>
        {cartItems.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Start shopping to add items</p>
            <Link to="/marketplace"><Button className="bg-orange-600 hover:bg-orange-700">Continue Shopping</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {storeGroups.map((g) => (
                <Card key={g.storeId} className="overflow-hidden">
                  <CardHeader className="bg-orange-50 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <CardTitle className="text-lg cursor-pointer hover:text-orange-600" onClick={() => g.storeSlug && navigate(`/stores/${g.storeSlug}`)}>
                        {g.storeName}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 flex items-center gap-2" onClick={() => handleOrderOnWhatsApp(g)}>
                          <MessageCircle size={16} /><span className="hidden sm:inline">Order on WhatsApp</span>
                        </Button>
                        <Button size="sm" className={`flex items-center gap-2 text-white ${g.mpesaApiKey ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}`} onClick={() => handlePayViaMpesa(g)} disabled={!g.mpesaApiKey}>
                          <Smartphone size={16} /><span className="hidden sm:inline">Pay via M-Pesa</span>
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Subtotal: <span className="font-semibold text-orange-600">KSh {g.subtotal.toLocaleString()}</span></p>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {g.items.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4 p-3 bg-white rounded-lg border">
                        <img src={item.product?.images?.[0] ?? "/placeholder.svg"} alt={item.product?.name} className="w-16 h-16 object-cover rounded-lg" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{item.product?.name}</h3>
                          <p className="text-orange-600 font-bold">KSh {item.product?.price?.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></Button>
                          <Input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)} className="w-12 text-center h-8 text-sm" min="1" />
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-600 hover:text-red-700 h-8 w-8 p-0"><Trash2 size={18} /></Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Order Summary</h3>
                  <div className="space-y-3 mb-4">
                    {storeGroups.map((g) => (
                      <div key={g.storeId} className="flex justify-between text-sm">
                        <span className="text-gray-600">{g.storeName}</span>
                        <span>KSh {g.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span className="text-orange-600">KSh {getTotalPrice().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <Link to="/checkout"><Button className="w-full bg-orange-600 hover:bg-orange-700">Proceed to Checkout</Button></Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Dialog open={mpesaDialogOpen} onOpenChange={setMpesaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Smartphone className="text-green-600" size={24} />Pay via M-Pesa</DialogTitle>
            <DialogDescription>Enter your Safaricom phone number to receive the payment prompt</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedStore && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Paying to:</p>
                <p className="font-semibold">{selectedStore.storeName}</p>
                <p className="text-lg font-bold text-green-600">KSh {selectedStore.subtotal.toLocaleString()}</p>
              </div>
            )}
            {paymentStatus === "idle" && (
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="e.g., 0712345678" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1" />
                <p className="text-xs text-gray-500 mt-1">Enter your Safaricom M-Pesa number</p>
              </div>
            )}
            {paymentStatus === "pending" && (
              <div className="text-center py-4">
                <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
                <p className="font-semibold text-lg">Waiting for payment...</p>
                <p className="text-sm text-gray-600">Please check your phone and enter your M-Pesa PIN</p>
              </div>
            )}
            {paymentStatus === "success" && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="text-green-600" size={32} />
                </div>
                <p className="font-semibold text-lg text-green-600">Payment Successful!</p>
              </div>
            )}
            {paymentStatus === "failed" && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="text-red-600" size={32} />
                </div>
                <p className="font-semibold text-lg text-red-600">Payment Failed</p>
                <p className="text-sm text-gray-600">Please try again</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {paymentStatus === "idle" && (
              <>
                <Button variant="outline" onClick={() => setMpesaDialogOpen(false)} className="flex-1">Cancel</Button>
                <Button onClick={initiatePayment} disabled={!phoneNumber || paymentLoading} className="flex-1 bg-green-600 hover:bg-green-700">
                  {paymentLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send Payment Request"}
                </Button>
              </>
            )}
            {paymentStatus === "pending" && (
              <Button variant="outline" onClick={() => { setPaymentStatus("idle"); setCheckoutRequestId(null); }} className="w-full">Cancel & Try Again</Button>
            )}
            {(paymentStatus === "success" || paymentStatus === "failed") && (
              <Button onClick={() => { setMpesaDialogOpen(false); if (paymentStatus === "success") fetchCartItems(); }} className="w-full">Close</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cart;
