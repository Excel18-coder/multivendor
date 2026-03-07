import { useState, useEffect } from 'react';
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Star, TrendingUp, Users, Store, Smartphone, Check, X, Power } from "lucide-react";
import { adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StoreWithMpesa {
  id: string;
  name: string;
  owner_id: string;
  location: string;
  description: string;
  is_active: boolean;
  image_url: string;
  store_type: string;
  mpesa_enabled: boolean;
  mpesa_type: string;
  mpesa_number: string;
  mpesa_account_number: string;
  mpesa_bank_name: string;
  mpesa_status: string;
  mpesa_api_key: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  store_id: string;
  stores: { name: string };
}

interface Complaint {
  id: string;
  message: string;
  submitted_at: string;
  store_id: string;
  stores: { name: string };
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  user_type: string;
  created_at: string;
}

const Admin = () => {
  const [stores, setStores] = useState<StoreWithMpesa[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<string[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean>(() => localStorage.getItem('admin_access') === 'true');
  const [adminPassword, setAdminPassword] = useState('');
  const ADMIN_PASS = 'password123';

  // Get pending M-Pesa requests
  const pendingMpesaStores = stores.filter(s => s.mpesa_enabled && s.mpesa_status === 'pending');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (authorized) {
      fetchAdminData();
    }
  }, [user, navigate, authorized, authLoading]);

  const fetchAdminData = async () => {
    setDataLoading(true);
    try {
      const [storesData, productsData, complaintsData, usersData] = await Promise.all([
        adminApi.stores(),
        adminApi.products(),
        adminApi.complaints(),
        adminApi.users(),
      ]);

      // Fetch admin settings
      const featuredData = await adminApi.getSetting('featured_products').catch(() => null);
      const topSellingData = await adminApi.getSetting('top_selling_products').catch(() => null);

      setStores((storesData || []) as StoreWithMpesa[]);
      setProducts(productsData as any[] || []);
      setComplaints(complaintsData as any[] || []);
      setUsers((usersData || []) as AdminUser[]);

      // value may already be parsed object or a JSON string — handle both
      const parseSettingIds = (v: any): string[] => {
        try {
          const obj = typeof v === 'string' ? JSON.parse(v) : v;
          return obj?.product_ids || [];
        } catch { return []; }
      };
      setFeaturedProducts(parseSettingIds(featuredData?.value));
      setTopSellingProducts(parseSettingIds(topSellingData?.value));
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  const handleAuthorize = () => {
    if (adminPassword === ADMIN_PASS) {
      localStorage.setItem('admin_access', 'true');
      setAuthorized(true);
      toast({ title: 'Access granted' });
      fetchAdminData();
    } else {
      toast({ title: 'Incorrect password', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    try {
      await adminApi.deleteStore(storeId);
      setStores(stores.filter(s => s.id !== storeId));
      toast({ title: "Success", description: "Store deleted successfully" });
    } catch (error) {
      console.error('Error deleting store:', error);
      toast({ title: "Error", description: "Failed to delete store", variant: "destructive" });
    }
  };

  const handleToggleStore = async (storeId: string, isActive: boolean) => {
    try {
      await adminApi.toggleStore(storeId, !isActive);
      setStores(stores.map(s => s.id === storeId ? { ...s, is_active: !isActive } : s));
      toast({ title: "Success", description: `Store ${!isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
      console.error('Error toggling store:', error);
      toast({ title: "Error", description: "Failed to update store status", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await adminApi.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      toast({ title: "Success", description: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(userId, { role, user_type: role });
      setUsers(users.map(u => u.id === userId ? { ...u, role, user_type: role } : u));
      toast({ title: "Success", description: "User role updated successfully" });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({ title: "Error", description: "Failed to update user role", variant: "destructive" });
    }
  };

  const handleDeleteComplaint = async (complaintId: string) => {
    try {
      await adminApi.updateComplaint(complaintId, 'resolved');
      setComplaints(complaints.filter(complaint => complaint.id !== complaintId));
      toast({
        title: "Success",
        description: "Complaint resolved successfully",
      });
    } catch (error) {
      console.error('Error resolving complaint:', error);
      toast({
        title: "Error",
        description: "Failed to resolve complaint",
        variant: "destructive",
      });
    }
  };

  const handleToggleFeatured = async (productId: string) => {
    try {
      const isCurrentlyFeatured = featuredProducts.includes(productId);
      const updatedFeatured = isCurrentlyFeatured
        ? featuredProducts.filter(id => id !== productId)
        : [...featuredProducts, productId];

      await adminApi.setSetting('featured_products', JSON.stringify({ product_ids: updatedFeatured }));

      setFeaturedProducts(updatedFeatured);
      toast({
        title: "Success",
        description: isCurrentlyFeatured ? "Removed from featured" : "Added to featured",
      });
    } catch (error) {
      console.error('Error updating featured products:', error);
      toast({
        title: "Error",
        description: "Failed to update featured products",
        variant: "destructive",
      });
    }
  };

  const handleToggleTopSelling = async (productId: string) => {
    try {
      const isCurrentlyTopSelling = topSellingProducts.includes(productId);
      const updatedTopSelling = isCurrentlyTopSelling
        ? topSellingProducts.filter(id => id !== productId)
        : [...topSellingProducts, productId];

      await adminApi.setSetting('top_selling_products', JSON.stringify({ product_ids: updatedTopSelling }));

      setTopSellingProducts(updatedTopSelling);
      toast({
        title: "Success",
        description: isCurrentlyTopSelling ? "Removed from top selling" : "Added to top selling",
      });
    } catch (error) {
      console.error('Error updating top selling products:', error);
      toast({
        title: "Error",
        description: "Failed to update top selling products",
        variant: "destructive",
      });
    }
  };

  const handleApproveMpesa = async (storeId: string) => {
    const apiKey = apiKeyInputs[storeId];
    if (!apiKey || apiKey.trim() === '') {
      toast({
        title: "API Key Required",
        description: "Please enter the Lipia API key before approving",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminApi.approveMpesa(storeId, apiKey.trim());
      setStores(stores.map(s => 
        s.id === storeId 
          ? { ...s, mpesa_status: 'approved', mpesa_api_key: apiKey.trim() }
          : s
      ));
      setApiKeyInputs({ ...apiKeyInputs, [storeId]: '' });
      
      toast({
        title: "M-Pesa Approved",
        description: "Store's M-Pesa payments have been activated!",
      });
    } catch (error) {
      console.error('Error approving M-Pesa:', error);
      toast({
        title: "Error",
        description: "Failed to approve M-Pesa",
        variant: "destructive",
      });
    }
  };

  const handleRejectMpesa = async (storeId: string) => {
    try {
      await adminApi.rejectMpesa(storeId, 'Rejected by admin');
      setStores(stores.map(s => 
        s.id === storeId 
          ? { ...s, mpesa_status: 'rejected', mpesa_enabled: false }
          : s
      ));
      
      toast({
        title: "M-Pesa Rejected",
        description: "Store's M-Pesa request has been rejected.",
      });
    } catch (error) {
      console.error('Error rejecting M-Pesa:', error);
      toast({
        title: "Error",
        description: "Failed to reject M-Pesa request",
        variant: "destructive",
      });
    }
  };

  const getMpesaTypeLabel = (store: StoreWithMpesa) => {
    if (store.mpesa_type === 'till') return `Till: ${store.mpesa_number}`;
    if (store.mpesa_type === 'paybill') return `Paybill: ${store.mpesa_number} (Acc: ${store.mpesa_account_number})`;
    if (store.mpesa_type === 'bank') return `Bank: ${store.mpesa_bank_name} (Acc: ${store.mpesa_account_number})`;
    return 'Unknown';
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">Admin Access</h2>
            <p className="text-sm text-gray-600 mb-4">Enter password to access the dashboard.</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              <Button onClick={handleAuthorize}>Enter</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage stores, products, and complaints</p>
        </div>

        {/* Pending M-Pesa Requests Alert */}
        {pendingMpesaStores.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="text-green-600" size={20} />
              <h3 className="font-semibold text-green-800">
                {pendingMpesaStores.length} Pending M-Pesa Request{pendingMpesaStores.length > 1 ? 's' : ''}
              </h3>
            </div>
            <p className="text-sm text-green-700">
              New stores are waiting for M-Pesa activation. Go to the M-Pesa tab to review and approve.
            </p>
          </div>
        )}

        <Tabs defaultValue="stores" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store size={16} />
              Stores ({stores.length})
            </TabsTrigger>
            <TabsTrigger value="mpesa" className="flex items-center gap-2 relative">
              <Smartphone size={16} />
              M-Pesa
              {pendingMpesaStores.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingMpesaStores.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Star size={16} />
              Products ({products.length})
            </TabsTrigger>
            <TabsTrigger value="complaints" className="flex items-center gap-2">
              <Users size={16} />
              Complaints ({complaints.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users size={16} />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="featured" className="flex items-center gap-2">
              <TrendingUp size={16} />
              Featured
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stores" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Stores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <img
                          src={store.image_url || "/placeholder.svg"}
                          alt={store.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{store.name}</h3>
                          <p className="text-sm text-gray-600">{store.location}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant={store.is_active ? "default" : "secondary"}>
                              {store.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {store.mpesa_enabled && (
                              <Badge variant={store.mpesa_status === 'approved' ? 'default' : store.mpesa_status === 'pending' ? 'secondary' : 'destructive'}>
                                M-Pesa: {store.mpesa_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStore(store.id, store.is_active)}
                        >
                          <Power size={16} className={store.is_active ? "text-orange-500" : "text-green-500"} />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteStore(store.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mpesa" className="mt-6">
            <div className="space-y-6">
              {/* Pending Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="text-yellow-600" size={20} />
                    Pending M-Pesa Requests ({pendingMpesaStores.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingMpesaStores.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No pending M-Pesa requests</p>
                  ) : (
                    <div className="space-y-4">
                      {pendingMpesaStores.map((store) => (
                        <div key={store.id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{store.name}</h3>
                              <p className="text-sm text-gray-600">{store.location}</p>
                            </div>
                            <Badge variant="secondary">Pending</Badge>
                          </div>
                          
                          <div className="bg-white rounded-lg p-3 mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-1">M-Pesa Details:</p>
                            <p className="text-sm text-gray-600">{getMpesaTypeLabel(store)}</p>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor={`api-key-${store.id}`}>Lipia API Key</Label>
                              <Input
                                id={`api-key-${store.id}`}
                                type="password"
                                placeholder="Enter API key from Lipia Online"
                                value={apiKeyInputs[store.id] || ''}
                                onChange={(e) => setApiKeyInputs({ ...apiKeyInputs, [store.id]: e.target.value })}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Get this from lipia-online.vercel.app after setting up the seller's till/paybill
                              </p>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveMpesa(store.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                <Check size={16} className="mr-2" />
                                Approve & Activate
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleRejectMpesa(store.id)}
                                className="flex-1"
                              >
                                <X size={16} className="mr-2" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Approved Stores */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="text-green-600" size={20} />
                    Approved M-Pesa Stores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stores.filter(s => s.mpesa_status === 'approved').length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No approved stores yet</p>
                  ) : (
                    <div className="grid gap-4">
                      {stores.filter(s => s.mpesa_status === 'approved').map((store) => (
                        <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                          <div>
                            <h3 className="font-semibold">{store.name}</h3>
                            <p className="text-sm text-gray-600">{getMpesaTypeLabel(store)}</p>
                          </div>
                          <Badge className="bg-green-600">Active</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-600">KSh {product.price}</p>
                          <p className="text-xs text-gray-500">by {product.stores?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={featuredProducts.includes(product.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleFeatured(product.id)}
                        >
                          <Star size={16} className="mr-1" />
                          Featured
                        </Button>
                        <Button
                          variant={topSellingProducts.includes(product.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleTopSelling(product.id)}
                        >
                          <TrendingUp size={16} className="mr-1" />
                          Top Selling
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Complaints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-2">
                          Complaint about: {complaint.stores?.name}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">{complaint.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(complaint.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteComplaint(complaint.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manage Users</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No users found</p>
                ) : (
                  <div className="grid gap-4">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{u.full_name || u.email}</h3>
                          <p className="text-sm text-gray-600">{u.email}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role || 'buyer'}
                            </Badge>
                            {u.user_type && u.user_type !== u.role && (
                              <Badge variant="outline">{u.user_type}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {u.role !== 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateUserRole(u.id, u.role === 'seller' ? 'buyer' : 'seller')}
                            >
                              {u.role === 'seller' ? 'Make Buyer' : 'Make Seller'}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="featured" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star size={20} />
                    Featured Products ({featuredProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {products.filter(p => featuredProducts.includes(p.id)).map((product) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-600">KSh {product.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp size={20} />
                    Top Selling Products ({topSellingProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {products.filter(p => topSellingProducts.includes(p.id)).map((product) => (
                      <div key={product.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-600">KSh {product.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
