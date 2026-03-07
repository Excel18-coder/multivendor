import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Package, Truck, Users, AlertTriangle, Search, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { storeApi, productApi } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

interface Store {
  id: string;
  name: string;
  rating: number;
  products: number;
  location: string;
  image_url: string | null;
  followers?: number;
  store_type?: string;
  slug?: string;
  description?: string;
  payment_options?: string[];
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
  tags?: string[];
  discount_percentage?: number;
  store?: {
    id: string;
    name: string;
  };
}

interface Complaint {
  id: string;
  message: string;
  submitted_at: string;
  username: string;
}

const StorePage = () => {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');

  useEffect(() => {
    if (storeSlug) {
      fetchStoreAndProducts();
    }
  }, [storeSlug]);

  useEffect(() => {
    if (store?.id) {
      fetchComplaints();
      fetchFollowersCount();
      fetchComplaintsCount();
      if (user) {
        checkFollowStatus();
      }
    }
  }, [store?.id, user]);

  useEffect(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(product =>
        product.category?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(selectedCategory.toLowerCase())) ||
        product.name.toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, products, selectedCategory]);

  const fetchFollowersCount = async () => {
    if (!store?.id) return;
    try {
      const s = await storeApi.getBySlug(storeSlug!);
      setFollowersCount(s.follower_count ?? 0);
    } catch {}
  };

  const fetchComplaintsCount = async () => {}; // included in store data

  const fetchStoreAndProducts = async () => {
    if (!storeSlug) return;
    try {
      const storeData = await storeApi.getBySlug(storeSlug);
      const transformedStore: Store = {
        id: storeData.id,
        name: storeData.name,
        rating: storeData.rating ?? 3.0,
        products: 0,
        location: storeData.location ?? "",
        image_url: storeData.logo_url ?? null,
        store_type: storeData.category,
        slug: storeData.slug,
        description: storeData.description,
        payment_options: [],
      };
      setStore(transformedStore);
      setFollowersCount(storeData.follower_count ?? 0);

      const productsData = await productApi.list({ store_id: storeData.id });
      const productsWithStore = productsData.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description ?? "",
        category: p.category ?? "",
        quality: "basic",
        image_url: p.images?.[0] ?? "/placeholder.svg",
        in_stock: p.stock_quantity > 0,
        tags: p.tags,
        discount_percentage: p.discount_price ? Math.round((1 - p.discount_price / p.price) * 100) : 0,
        store: { id: storeData.id, name: storeData.name },
      }));
      setProducts(productsWithStore);
      setFilteredProducts(productsWithStore);
    } catch {
      toast({ title: "Error", description: "Failed to load store data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchComplaints = async () => {
    if (!store?.id) return;
    try {
      const data = await storeApi.getComplaints(store.id);
      setComplaints(data.map((c: any) => ({ id: c.id, message: c.message, submitted_at: c.created_at, username: "Anonymous" })));
      setComplaintsCount(data.length);
    } catch {}
  };

  const checkFollowStatus = async () => {
    if (!user || !store?.id) return;
    try {
      const res = await storeApi.followStatus(store.id);
      setIsFollowing(res.following);
    } catch {}
  };

  const handleFollow = async () => {
    if (!user) { navigate("/auth"); return; }
    try {
      if (isFollowing) {
        await storeApi.unfollow(store!.id);
        setIsFollowing(false);
        setFollowersCount(c => Math.max(0, c - 1));
        toast({ title: "Success", description: `You have unfollowed ${store?.name}` });
      } else {
        await storeApi.follow(store!.id);
        setIsFollowing(true);
        setFollowersCount(c => c + 1);
        toast({ title: "Success", description: `You are now following ${store?.name}` });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update follow status", variant: "destructive" });
    }
  };

  const getCategoryFilters = (storeType: string) => {
    const baseCategories = ['All Categories'];
    
    if (!storeType) return baseCategories;
    
    const categoryMap: Record<string, string[]> = {
      "Fashion & Apparel": [
        ...baseCategories,
        "T-Shirts & Shirts",
        "Hoodies & Sweatshirts", 
        "Jeans & Trousers",
        "Suits & Formal Wear",
        "Dresses & Skirts",
        "Tracksuits & Sweatpants",
        "Shoes & Sneakers",
        "Heels & Flats",
        "Bags & Backpacks",
        "Caps, Watches & Accessories",
        "Innerwear & Lingerie",
        "Kidswear & Baby Clothes"
      ],
      "Tech & Gadgets": [
        ...baseCategories,
        "Phones & Accessories",
        "Laptops & Computers", 
        "Headphones, Smartwatches & Gadgets"
      ],
      "Furniture & Home": [
        ...baseCategories,
        "Sofas, Beds & Chairs",
        "Tables, Decor & Lighting"
      ],
      "Health & Beauty": [
        ...baseCategories,
        "Skin, Hair & Makeup Products"
      ],
      "Food & Grocery": [
        ...baseCategories,
        "Food, Snacks & Beverages"
      ],
      "Books & Stationery": [
        ...baseCategories,
        "Books, Notebooks & Office Supplies"
      ]
    };

    return categoryMap[storeType] || baseCategories;
  };

  const categoryFilters = getCategoryFilters(store?.store_type || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Store Not Found</h1>
            <Button onClick={() => navigate("/stores")}>
              Back to Stores
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Store Header Section - Side by Side */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-stretch md:justify-between">
          {/* Left Side - Store Information */}
          <div className="flex-1 max-w-lg">
            {/* Store Name */}
            <h1 className="text-3xl font-bold text-foreground mb-3">{store.name}</h1>
            
            {/* Location and Rating */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin size={18} />
                <span>{store.location}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Star className="fill-primary text-primary" size={18} />
                <span>{store.rating.toFixed(1)} Rating</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Package className="text-primary" size={20} />
                <div>
                  <div className="font-semibold">{products.length}</div>
                  <div className="text-xs text-muted-foreground">Products</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Users className="text-primary" size={20} />
                <div>
                  <div className="font-semibold">{followersCount}</div>
                  <div className="text-xs text-muted-foreground">Followers</div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold mb-2">About</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {store.description || `Welcome to ${store.name}! We're committed to providing quality products and reliable service. Feel free to reach out anytime.`}
              </p>
            </div>

            {/* Payment Policy */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold mb-2">Payment Options</h2>
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <Truck className="text-primary" size={18} />
                  {store.payment_options?.map((option) => (
                    <Badge key={option} variant="outline" className="text-xs">
                      {option === 'POD' ? 'Pay on Delivery' : option === 'Prepay' ? 'Prepay' : option}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                size="default" 
                className="flex-1"
                onClick={handleFollow}
              >
                {isFollowing ? '✓ Following' : '+ Follow Store'}
              </Button>
              <Button 
                size="default" 
                variant="outline"
                onClick={() => navigate('/complaint', { 
                  state: { 
                    storeId: store.id, 
                    storeName: store.name 
                  } 
                })}
              >
                Report Issue
              </Button>
            </div>
          </div>

          {/* Right Side - Store Image */}
          <div className="w-full md:w-[600px] md:flex-shrink-0 relative overflow-hidden rounded-lg self-stretch md:ml-auto">
            <img 
              src={store.image_url || "/placeholder.svg"} 
              alt={store.name}
              className="w-full h-full object-cover"
            />
            {store.store_type && (
              <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground px-4 py-2">
                {store.store_type}
              </Badge>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 flex items-center justify-center w-14 bg-primary rounded-l-lg pointer-events-none">
              <Search className="h-5 w-5 text-primary-foreground" />
            </div>
            <Input
              placeholder="Search products in this store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-16 h-14 text-base bg-card border-2 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm"
            />
          </div>
        </div>

        {/* Category Filters */}
        {categoryFilters.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {categoryFilters.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        {/* Products Grid */}
        <h2 className="text-2xl font-bold mb-6">All Products</h2>
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No products match your search." : "No products available from this store."}
              </p>
              <Button onClick={() => navigate("/marketplace")}>
                Browse All Products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product}
              />
            ))}
          </div>
        )}

        {/* Complaints Section */}
        {complaints.length > 0 && (
          <div className="mt-12 bg-card rounded-lg border p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center">
              <AlertTriangle className="mr-2 text-destructive" size={24} />
              Customer Feedback ({complaints.length})
            </h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {complaints.slice(0, 3).map((complaint) => (
                <Card key={complaint.id} className="border-l-4 border-l-destructive">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-foreground">
                        {complaint.username}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(complaint.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{complaint.message}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorePage;