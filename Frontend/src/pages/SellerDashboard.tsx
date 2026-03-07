import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ProductForm } from "@/components/ProductForm";
import { StoreSettingsModal } from "@/components/StoreSettingsModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { storeApi, productApi, paymentApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Store, DollarSign, Users, AlertTriangle, Upload, Edit, Trash2, Settings, Smartphone, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StoreData {
  id: string;
  name: string;
  description: string;
  location: string;
  image_url: string;
  store_type: string;
  payment_options: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  quality: string;
  image_url: string;
  in_stock: boolean;
}

const SellerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [storeImageUploading, setStoreImageUploading] = useState(false);
  const [showStoreSettings, setShowStoreSettings] = useState(false);
  
  // Manual STK Push state
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [mpesaStatus, setMpesaStatus] = useState<string | null>(null);

  // Store form state
  const [storeForm, setStoreForm] = useState({
    name: "",
    description: "",
    location: "",
    image_url: "",
    store_type: "",
    payment_options: ["POD"] as string[],
    // M-Pesa fields
    mpesa_enabled: false,
    mpesa_type: "" as "" | "till" | "paybill" | "bank",
    mpesa_number: "",
    mpesa_account_number: "",
    mpesa_bank_name: "",
  });

  const storeTypes = [
    "Fashion & Apparel",
    "Tech & Gadgets", 
    "Furniture & Home",
    "Health & Beauty",
    "Food & Grocery",
    "Books & Stationery"
  ];

  useEffect(() => {
    if (user) {
      checkUserProfile();
      fetchStore();
    }
  }, [user]);

  useEffect(() => {
    if (store) {
      fetchStoreStats();
      fetchRecentPayments();
      fetchMpesaStatus();
    }
  }, [store]);

  // Poll for payment status
  useEffect(() => {
    if (paymentStatus !== 'pending' || !transactionRef || !store) return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await paymentApi.mpesaStatus(transactionRef, store.id);
        const status = data?.status?.toLowerCase();
        if (status === 'success') {
          setPaymentStatus('success');
          clearInterval(pollInterval);
          toast({
            title: "Payment Successful!",
            description: "Payment has been received",
          });
          fetchRecentPayments();
        } else if (status === 'failed') {
          setPaymentStatus('failed');
          clearInterval(pollInterval);
          toast({
            title: "Payment Failed",
            description: data?.result_desc || "Payment was not completed",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    // Stop polling after 2.5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (paymentStatus === 'pending') {
        setPaymentStatus('failed');
        toast({
          title: "Payment Timeout",
          description: "Payment verification timed out. Please check your M-Pesa messages.",
          variant: "destructive",
        });
      }
    }, 150000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [paymentStatus, transactionRef, store]);

  const checkUserProfile = async () => {
    if (!user) return;
    // user_type is available directly from auth token
    if (user.user_type !== "seller") {
      toast({
        title: "Access Denied",
        description: "Only sellers can access this dashboard. Please sign up as a seller.",
        variant: "destructive",
      });
      navigate("/auth");
    }
    setProfile(user);
  };

  const fetchStore = async () => {
    if (!user) return;

    try {
      const data = await storeApi.getMyStore();
      if (data) {
        setStore(data as any);
        setStoreForm({
          name: data.name || "",
          description: data.description || "",
          location: data.location || "",
          image_url: (data as any).image_url || data.logo_url || "",
          store_type: (data as any).store_type || data.category || "",
          payment_options: (data as any).payment_options || ["POD"],
          mpesa_enabled: false,
          mpesa_type: "",
          mpesa_number: "",
          mpesa_account_number: "",
          mpesa_bank_name: "",
        });
        fetchProducts(data.id);
      }
    } catch (error: any) {
      // 404 means no store yet — that's normal
      if (!error?.message?.includes('404') && !error?.message?.includes('not found')) {
        console.error("Error fetching store:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreStats = async () => {
    if (!store) return;

    try {
      const [complaintsData] = await Promise.all([
        storeApi.getComplaints(store.id),
      ]);

      setComplaintsCount(complaintsData?.length || 0);
      setComplaints(complaintsData || []);

      // Followers count from store data
      setFollowersCount((store as any).follower_count || 0);
    } catch (error) {
      console.error("Error fetching store stats:", error);
    }
  };

  const fetchMpesaStatus = async () => {
    if (!store) return;
    // mpesa_api_key non-null means approved; check store data directly
    const s = store as any;
    if (s.mpesa_api_key) {
      setMpesaStatus('approved');
    } else if (s.mpesa_status) {
      setMpesaStatus(s.mpesa_status);
    } else {
      setMpesaStatus(null);
    }
  };

  const fetchRecentPayments = async () => {
    if (!store) return;
    
    try {
      const data = await paymentApi.storeHistory(store.id);
      setRecentPayments((data || []).slice(0, 10));
    } catch (error) {
      console.error("Error fetching recent payments:", error);
    }
  };

  const initiateManualPayment = async () => {
    if (!store || !customerPhone || !paymentAmount) return;

    // Validate phone number
    const cleanPhone = customerPhone.replace(/\s+/g, '');
    if (!/^(254|0|\+254)?[17]\d{8}$/.test(cleanPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Safaricom phone number",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setPaymentLoading(true);
    setPaymentStatus('idle');

    try {
      const data = await paymentApi.mpesaInitiate({
        store_id: store.id,
        phone: cleanPhone,
        amount: amount,
        order_reference: `manual-${Date.now()}`
      });

      setTransactionRef(data.checkout_request_id);
      setPaymentStatus('pending');
      toast({
        title: "STK Push Sent",
        description: "Customer should receive M-Pesa prompt on their phone",
      });
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setPaymentStatus('failed');
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate M-Pesa payment",
        variant: "destructive",
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const resetPaymentDialog = () => {
    setCustomerPhone("");
    setPaymentAmount("");
    setPaymentDescription("");
    setPaymentStatus('idle');
    setTransactionRef(null);
  };

  const fetchProducts = async (storeId: string) => {
    try {
      const data = await productApi.list({ store_id: storeId });
      setProducts((data || []) as any[]);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || profile?.user_type !== "seller") {
      toast({
        title: "Error",
        description: "Only sellers can create stores",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = await storeApi.create({
        name: storeForm.name.trim(),
        description: storeForm.description,
        location: storeForm.location,
        logo_url: storeForm.image_url,
        category: storeForm.store_type,
        ...(storeForm.mpesa_enabled ? {
          mpesa_till_number: storeForm.mpesa_number,
        } : {}),
      } as any);

      setStore(data as any);
      
      if (storeForm.mpesa_enabled) {
        toast({
          title: "Store Created!",
          description: `Your store "${data.name}" has been created. M-Pesa activation is pending admin approval.`,
        });
      } else {
        toast({
          title: "Success",
          description: `Store "${data.name}" created successfully! Your store URL: /stores/${data.slug}`,
        });
      }
    } catch (error: any) {
      console.error("Error creating store:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create store. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProductSuccess = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    if (store) {
      fetchProducts(store.id);
    }
    toast({
      title: "Success",
      description: editingProduct ? "Product updated successfully!" : "Product added successfully!",
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await productApi.delete(productId);

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      
      if (store) {
        fetchProducts(store.id);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const handleStoreUpdate = (updatedStore: any) => {
    setStore(updatedStore);
  };

  const handleStoreImageUpload = async (file: File) => {
    setStoreImageUploading(true);
    try {
      // Convert to data URL for preview (actual file storage handled by backend)
      const reader = new FileReader();
      reader.onload = () => {
        setStoreForm(prev => ({ ...prev, image_url: reader.result as string }));
        toast({
          title: "Image Selected",
          description: "Image preview ready. It will be uploaded when you create the store.",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error handling store image:", error);
      toast({
        title: "Error",
        description: "Failed to process store image",
        variant: "destructive",
      });
    } finally {
      setStoreImageUploading(false);
    }
  };

  const handleStoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleStoreImageUpload(file);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please Login</h1>
            <p className="text-gray-600 mb-6">You need to login as a seller to access this dashboard</p>
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

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Store size={24} />
                  <span>Create Your Store</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStore} className="space-y-4">
                  <div>
                    <Label htmlFor="store-name">Store Name</Label>
                    <Input
                      id="store-name"
                      value={storeForm.name}
                      onChange={(e) => setStoreForm({...storeForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="store-type">Store Type</Label>
                    <Select value={storeForm.store_type} onValueChange={(value) => setStoreForm({...storeForm, store_type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select store type" />
                      </SelectTrigger>
                      <SelectContent>
                        {storeTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="store-description">Description</Label>
                    <Textarea
                      id="store-description"
                      value={storeForm.description}
                      onChange={(e) => setStoreForm({...storeForm, description: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="store-location">Location</Label>
                    <Input
                      id="store-location"
                      value={storeForm.location}
                      onChange={(e) => setStoreForm({...storeForm, location: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="payment-options">Payment Options</Label>
                    <div className="flex gap-2 mt-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={storeForm.payment_options.includes("POD")}
                          onChange={(e) => {
                            const options = e.target.checked
                              ? [...storeForm.payment_options, "POD"]
                              : storeForm.payment_options.filter(o => o !== "POD");
                            setStoreForm({...storeForm, payment_options: options});
                          }}
                        />
                        <span className="text-sm">Pay on Delivery</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={storeForm.payment_options.includes("Prepay")}
                          onChange={(e) => {
                            const options = e.target.checked
                              ? [...storeForm.payment_options, "Prepay"]
                              : storeForm.payment_options.filter(o => o !== "Prepay");
                            setStoreForm({...storeForm, payment_options: options});
                          }}
                        />
                        <span className="text-sm">Prepay</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* M-Pesa STK Push Section */}
                  <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                    <div className="flex items-start gap-3 mb-4">
                      <input
                        type="checkbox"
                        id="mpesa-enabled"
                        checked={storeForm.mpesa_enabled}
                        onChange={(e) => setStoreForm({...storeForm, mpesa_enabled: e.target.checked})}
                        className="mt-1"
                      />
                      <div>
                        <Label htmlFor="mpesa-enabled" className="text-green-800 font-semibold cursor-pointer">
                          Enable M-Pesa STK Push for your customers
                        </Label>
                        <p className="text-sm text-green-700 mt-1">
                          ⭐ <strong>Highly Recommended!</strong> Allow customers to pay directly via M-Pesa prompt for a smooth checkout experience.
                        </p>
                      </div>
                    </div>
                    
                    {storeForm.mpesa_enabled && (
                      <div className="space-y-4 mt-4 pl-6 border-l-2 border-green-300">
                        <div>
                          <Label htmlFor="mpesa-type">Payment Type</Label>
                          <Select 
                            value={storeForm.mpesa_type} 
                            onValueChange={(value: "till" | "paybill" | "bank") => setStoreForm({...storeForm, mpesa_type: value, mpesa_number: "", mpesa_account_number: "", mpesa_bank_name: ""})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="till">Till Number</SelectItem>
                              <SelectItem value="paybill">Paybill Number</SelectItem>
                              <SelectItem value="bank">Bank Account</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {storeForm.mpesa_type === "till" && (
                          <div>
                            <Label htmlFor="till-number">Till Number</Label>
                            <Input
                              id="till-number"
                              value={storeForm.mpesa_number}
                              onChange={(e) => setStoreForm({...storeForm, mpesa_number: e.target.value})}
                              placeholder="e.g., 123456"
                              required={storeForm.mpesa_enabled}
                            />
                          </div>
                        )}
                        
                        {storeForm.mpesa_type === "paybill" && (
                          <>
                            <div>
                              <Label htmlFor="paybill-number">Paybill Number</Label>
                              <Input
                                id="paybill-number"
                                value={storeForm.mpesa_number}
                                onChange={(e) => setStoreForm({...storeForm, mpesa_number: e.target.value})}
                                placeholder="e.g., 888880"
                                required={storeForm.mpesa_enabled}
                              />
                            </div>
                            <div>
                              <Label htmlFor="account-number">Account Number</Label>
                              <Input
                                id="account-number"
                                value={storeForm.mpesa_account_number}
                                onChange={(e) => setStoreForm({...storeForm, mpesa_account_number: e.target.value})}
                                placeholder="Your account number"
                                required={storeForm.mpesa_enabled}
                              />
                            </div>
                          </>
                        )}
                        
                        {storeForm.mpesa_type === "bank" && (
                          <>
                            <div>
                              <Label htmlFor="bank-name">Bank Name</Label>
                              <Input
                                id="bank-name"
                                value={storeForm.mpesa_bank_name}
                                onChange={(e) => setStoreForm({...storeForm, mpesa_bank_name: e.target.value})}
                                placeholder="e.g., Equity Bank, KCB, etc."
                                required={storeForm.mpesa_enabled}
                              />
                            </div>
                            <div>
                              <Label htmlFor="bank-account-number">Bank Account Number</Label>
                              <Input
                                id="bank-account-number"
                                value={storeForm.mpesa_account_number}
                                onChange={(e) => setStoreForm({...storeForm, mpesa_account_number: e.target.value})}
                                placeholder="Your bank account number"
                                required={storeForm.mpesa_enabled}
                              />
                            </div>
                          </>
                        )}
                        
                        {storeForm.mpesa_type && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                            <p className="text-sm text-amber-800">
                              <strong>📝 Note:</strong> After creating your store, please wait for admin approval to activate M-Pesa payments. 
                              You'll be notified via email and on this dashboard when your M-Pesa is active.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="store-image">Store Image</Label>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Input
                          id="store-image"
                          type="file"
                          accept="image/*"
                          onChange={handleStoreFileChange}
                          disabled={storeImageUploading}
                          className="flex-1"
                        />
                        <Button type="button" disabled={storeImageUploading} className="flex items-center gap-2">
                          <Upload size={16} />
                          {storeImageUploading ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor="store-image-url">Or paste image URL</Label>
                        <Input
                          id="store-image-url"
                          value={storeForm.image_url}
                          onChange={(e) => setStoreForm({...storeForm, image_url: e.target.value})}
                          placeholder="https://example.com/store-image.jpg"
                        />
                      </div>
                      {storeForm.image_url && (
                        <div className="mt-2">
                          <img 
                            src={storeForm.image_url} 
                            alt="Store preview" 
                            className="w-32 h-32 object-cover rounded-md border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                    Create Store
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Seller Dashboard</h1>
          <p className="text-gray-600">Manage your store and products</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="store">Store Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{products.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Followers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{followersCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Complaints</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{complaintsCount}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Payment Options</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {store.payment_options.map((option) => (
                      <Badge key={option} variant="secondary">
                        {option === 'POD' ? 'Pay on Delivery' : option === 'Prepay' ? 'Prepay' : option}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Products</CardTitle>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <p className="text-gray-500">No products yet. Add your first product!</p>
                ) : (
                  <div className="space-y-4">
                    {products.slice(0, 5).map((product) => (
                      <div key={product.id} className="flex items-center space-x-4">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium">{product.name}</h3>
                          <p className="text-sm text-gray-500">KSh {product.price}</p>
                        </div>
                        <Badge variant={product.in_stock ? "default" : "secondary"}>
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Complaints Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Customer Complaints ({complaintsCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {complaints.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No complaints yet</p>
                ) : (
                  <div className="space-y-4">
                    {complaints.map((complaint) => (
                      <div key={complaint.id} className="border rounded-lg p-4 bg-red-50 border-red-200">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-red-800">
                            Customer Complaint
                          </p>
                          <span className="text-sm text-red-600">
                            {new Date(complaint.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-red-700">{complaint.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Products</h2>
              <Button 
                onClick={() => setShowProductForm(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus size={16} className="mr-2" />
                Add Product
              </Button>
            </div>

            {(showProductForm || editingProduct) && (
              <ProductForm
                storeId={store.id}
                product={editingProduct}
                onSuccess={handleProductSuccess}
                onCancel={() => {
                  setShowProductForm(false);
                  setEditingProduct(null);
                }}
              />
            )}

            {products.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Package size={64} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No products yet</h3>
                  <p className="text-gray-500 mb-6">Start by adding your first product to your store</p>
                  <Button 
                    onClick={() => setShowProductForm(true)}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Add Your First Product
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="p-4">
                      <img
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded mb-4"
                      />
                      <h3 className="font-semibold mb-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-orange-600">KSh {product.price}</span>
                        <Badge variant={product.in_stock ? "default" : "secondary"}>
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </div>
                       <div className="flex gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setEditingProduct(product)}
                           className="flex-1 flex items-center gap-1"
                         >
                           <Edit size={12} />
                           Edit
                         </Button>
                         <Button
                           variant="destructive"
                           size="sm"
                           onClick={() => handleDeleteProduct(product.id)}
                           className="flex-1 flex items-center gap-1"
                         >
                           <Trash2 size={12} />
                           Delete
                         </Button>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            {/* M-Pesa Status Banner */}
            {mpesaStatus === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                <div>
                  <p className="font-medium text-amber-800">M-Pesa Activation Pending</p>
                  <p className="text-sm text-amber-700">Your M-Pesa payment feature is awaiting admin approval.</p>
                </div>
              </div>
            )}
            
            {mpesaStatus === 'approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">M-Pesa Activated</p>
                  <p className="text-sm text-green-700">You can now request payments from customers via STK Push.</p>
                </div>
              </div>
            )}
            
            {mpesaStatus === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">M-Pesa Request Rejected</p>
                  <p className="text-sm text-red-700">Please contact support for more information.</p>
                </div>
              </div>
            )}

            {/* Request Payment Button */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  Request M-Pesa Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Use this feature to send an M-Pesa STK push prompt to any customer (e.g., for WhatsApp orders).
                </p>
                <Button
                  onClick={() => {
                    resetPaymentDialog();
                    setMpesaDialogOpen(true);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={mpesaStatus !== 'approved'}
                >
                  <Smartphone size={16} className="mr-2" />
                  Request Payment
                </Button>
                {mpesaStatus !== 'approved' && (
                  <p className="text-sm text-gray-500 mt-2">
                    {mpesaStatus === 'pending' 
                      ? "Waiting for admin approval to enable this feature."
                      : "Please enable M-Pesa in your store settings to use this feature."
                    }
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Payments */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Payment Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {recentPayments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No payment requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {recentPayments.map((payment) => (
                      <div 
                        key={payment.id} 
                        className={`border rounded-lg p-4 ${
                          payment.status === 'success' ? 'bg-green-50 border-green-200' :
                          payment.status === 'failed' ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">KSh {payment.amount?.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">{payment.phone_number}</p>
                            {payment.metadata?.description && (
                              <p className="text-sm text-gray-500">{payment.metadata.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={
                                payment.status === 'success' ? 'default' :
                                payment.status === 'failed' ? 'destructive' :
                                'secondary'
                              }
                            >
                              {payment.status}
                            </Badge>
                            {payment.mpesa_receipt_number && (
                              <p className="text-xs text-gray-500 mt-1">
                                Receipt: {payment.mpesa_receipt_number}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(payment.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="store">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Store Information</CardTitle>
                <Button
                  onClick={() => setShowStoreSettings(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Settings size={16} className="mr-2" />
                  Edit Store Settings
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {store.image_url && (
                  <div>
                    <Label>Store Image</Label>
                    <img 
                      src={store.image_url} 
                      alt={store.name}
                      className="w-32 h-32 object-cover rounded-md border mt-2"
                    />
                  </div>
                )}
                <div>
                  <Label>Store Name</Label>
                  <p className="text-lg font-medium">{store.name}</p>
                </div>
                <div>
                  <Label>Store Type</Label>
                  <p className="text-lg capitalize">{store.store_type}</p>
                </div>
                <div>
                  <Label>Description</Label>
                  <p>{store.description}</p>
                </div>
                <div>
                  <Label>Location</Label>
                  <p>{store.location}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showStoreSettings && store && (
          <StoreSettingsModal
            open={showStoreSettings}
            onClose={() => setShowStoreSettings(false)}
            store={store}
            onUpdate={handleStoreUpdate}
          />
        )}
      </div>

      {/* M-Pesa Payment Dialog */}
      <Dialog open={mpesaDialogOpen} onOpenChange={setMpesaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-600" />
              Request M-Pesa Payment
            </DialogTitle>
            <DialogDescription>
              Enter the customer's phone number and amount to send an STK push.
            </DialogDescription>
          </DialogHeader>
          
          {paymentStatus === 'idle' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer-phone">Customer Phone Number</Label>
                <Input
                  id="customer-phone"
                  placeholder="e.g., 0712345678 or 254712345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payment-amount">Amount (KSh)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  placeholder="e.g., 1500"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="payment-description">Description (Optional)</Label>
                <Input
                  id="payment-description"
                  placeholder="e.g., Order #123, Blue Shoes"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                />
              </div>
              <Button
                onClick={initiateManualPayment}
                disabled={paymentLoading || !customerPhone || !paymentAmount}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Smartphone size={16} className="mr-2" />
                    Send STK Push
                  </>
                )}
              </Button>
            </div>
          )}
          
          {paymentStatus === 'pending' && (
            <div className="text-center py-6">
              <Loader2 size={48} className="mx-auto text-green-600 animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Waiting for Payment</h3>
              <p className="text-gray-600 mb-4">
                STK Push sent to {customerPhone}.<br />
                Customer should enter M-Pesa PIN on their phone.
              </p>
              <p className="text-sm text-gray-500">Amount: KSh {paymentAmount}</p>
            </div>
          )}
          
          {paymentStatus === 'success' && (
            <div className="text-center py-6">
              <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">Payment Successful!</h3>
              <p className="text-gray-600 mb-4">
                KSh {paymentAmount} received from {customerPhone}
              </p>
              <Button
                onClick={() => {
                  resetPaymentDialog();
                  setMpesaDialogOpen(false);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Done
              </Button>
            </div>
          )}
          
          {paymentStatus === 'failed' && (
            <div className="text-center py-6">
              <XCircle size={48} className="mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Payment Failed</h3>
              <p className="text-gray-600 mb-4">
                The payment was not completed. The customer may have cancelled or the request timed out.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetPaymentDialog();
                    setMpesaDialogOpen(false);
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => setPaymentStatus('idle')}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerDashboard;
