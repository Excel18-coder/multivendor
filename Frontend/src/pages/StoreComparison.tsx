
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Star, MapPin, Heart, ShoppingCart, ArrowLeft } from "lucide-react";
import { storeApi, productApi, cartApi, wishlistApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  location: string;
  image_url: string | null;
  rating: number;
  follower_count: number;
  is_active: boolean;
  bestPrice?: number;
  bestProductId?: string;
}

const StoreComparison = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState("rating");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLabel, setCategoryLabel] = useState("similar stores");

  const categoryParam = searchParams.get("category") || "";
  const productId = searchParams.get("product_id") || "";

  useEffect(() => {
    fetchStores();
  }, [categoryParam, productId]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const allStores = await storeApi.list();

      if (categoryParam) {
        setCategoryLabel(categoryParam);
        const filtered = (allStores || []).filter((s: any) => {
          const cat = s.category || s.store_type || "";
          return cat.toLowerCase().includes(categoryParam.toLowerCase());
        }) as StoreRow[];
        setStores(filtered);
      } else if (productId) {
        const product = await productApi.get(productId);
        if (product) {
          setCategoryLabel(product.category || "similar");
          const similar = await productApi.list({ category: product.category || undefined, limit: 50 });
          const storeMap = new Map<string, StoreRow>();
          for (const p of similar || []) {
            const s = (p as any).store;
            if (s && !storeMap.has(s.id)) {
              const full = (allStores || []).find((st: any) => st.id === s.id) as any;
              storeMap.set(s.id, {
                id: s.id,
                name: s.name || full?.name || "Unknown",
                slug: s.slug || full?.slug || s.id,
                category: s.category || full?.category || "",
                location: full?.location || "Kenya",
                image_url: full?.logo_url || full?.image_url || null,
                rating: full?.rating || 3.0,
                follower_count: full?.follower_count || 0,
                is_active: full?.is_active ?? true,
                bestPrice: (p as any).price,
                bestProductId: (p as any).id,
              });
            }
          }
          setStores(Array.from(storeMap.values()));
        }
      } else {
        setStores((allStores || []) as StoreRow[]);
        setCategoryLabel("all stores");
      }
    } catch (error) {
      console.error("Error fetching stores:", error);
      toast({ title: "Error", description: "Failed to load stores", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sortedStores = [...stores].sort((a, b) => {
    if (sortBy === "price") return (a.bestPrice ?? 99999) - (b.bestPrice ?? 99999);
    if (sortBy === "followers") return (b.follower_count || 0) - (a.follower_count || 0);
    return (b.rating || 0) - (a.rating || 0);
  });

  const handleAddToCart = async (pid: string) => {
    if (!user) { navigate("/auth"); return; }
    try { await cartApi.add(pid, 1); toast({ title: "Added to cart!" }); }
    catch { toast({ title: "Error", description: "Failed to add to cart", variant: "destructive" }); }
  };

  const handleAddToWishlist = async (pid: string) => {
    if (!user) { navigate("/auth"); return; }
    try { await wishlistApi.add(pid); toast({ title: "Added to wishlist!" }); }
    catch { toast({ title: "Error", description: "Failed to add to wishlist", variant: "destructive" }); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Compare Stores</h1>
          <p className="text-gray-600">
            Comparing stores for: <span className="font-semibold text-orange-600">{categoryLabel}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600" />
          </div>
        ) : stores.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500 mb-4">No stores found for this category.</p>
              <Button onClick={() => navigate("/stores")}>Browse All Stores</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="price">Best Price</SelectItem>
                    <SelectItem value="followers">Followers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-gray-500">{stores.length} stores found</span>
            </div>

            <div className="grid gap-6">
              {sortedStores.map((store, index) => (
                <Card
                  key={store.id}
                  className={`${index === 0 ? "ring-2 ring-orange-500" : ""} ${!store.is_active ? "opacity-60" : ""}`}
                >
                  {index === 0 && (
                    <div className="bg-orange-500 text-white text-center py-1 text-sm font-medium rounded-t-lg">
                      Top Match
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <img
                        src={store.image_url || "/placeholder.svg"}
                        alt={store.name}
                        className="w-full lg:w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
                          <div>
                            <h3 className="text-xl font-semibold mb-1">{store.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                              <span className="flex items-center gap-1">
                                <Star size={14} className="text-yellow-500 fill-current" />
                                {(store.rating || 3).toFixed(1)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={14} /> {store.location}
                              </span>
                              {store.follower_count > 0 && (
                                <span>{store.follower_count} followers</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={store.is_active ? "default" : "secondary"}>
                                {store.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {store.category && <Badge variant="outline">{store.category}</Badge>}
                            </div>
                          </div>
                          {store.bestPrice != null && (
                            <div className="text-right mt-2 sm:mt-0">
                              <p className="text-xs text-gray-500">Best price</p>
                              <span className="text-2xl font-bold text-orange-600">
                                KSh {store.bestPrice.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => navigate(`/stores/${store.slug || store.id}`)}>
                            View Store
                          </Button>
                          {store.bestProductId && (
                            <>
                              <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => handleAddToCart(store.bestProductId!)}>
                                <ShoppingCart size={16} className="mr-2" /> Add to Cart
                              </Button>
                              <Button variant="outline" onClick={() => handleAddToWishlist(store.bestProductId!)}>
                                <Heart size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {stores.length > 1 && (
              <Card className="mt-8">
                <CardHeader><CardTitle>Quick Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Highest Rated</p>
                      <p className="text-lg font-bold text-yellow-600">
                        {Math.max(...stores.map(s => s.rating || 0)).toFixed(1)} ⭐
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Most Followers</p>
                      <p className="text-lg font-bold text-blue-600">
                        {Math.max(...stores.map(s => s.follower_count || 0)).toLocaleString()}
                      </p>
                    </div>
                    {stores.some(s => s.bestPrice != null) && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Lowest Price</p>
                        <p className="text-lg font-bold text-green-600">
                          KSh {Math.min(...stores.filter(s => s.bestPrice != null).map(s => s.bestPrice!)).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StoreComparison;


  // Mock data for stores selling the same item
  const productName = "African Print Dress";
  const stores = [
    {
      id: 1,
      name: "Nairobi Fashion Hub",
      price: 2500,
      originalPrice: 3000,
      rating: 4.8,
      reviews: 234,
      location: "Nairobi CBD",
      distance: "2.5 km",
      deliveryFee: 200,
      deliveryTime: "1-2 days",
      quality: "Premium",
      inStock: true,
      stockCount: 15,
      image: "/placeholder.svg",
      verified: true
    },
    {
      id: 2,
      name: "Heritage Crafts",
      price: 2800,
      originalPrice: null,
      rating: 4.9,
      reviews: 189,
      location: "Karen",
      distance: "12 km",
      deliveryFee: 350,
      deliveryTime: "2-3 days",
      quality: "Luxury",
      inStock: true,
      stockCount: 8,
      image: "/placeholder.svg",
      verified: true
    },
    {
      id: 3,
      name: "Style Avenue",
      price: 2200,
      originalPrice: 2500,
      rating: 4.6,
      reviews: 156,
      location: "Westlands",
      distance: "5.8 km",
      deliveryFee: 250,
      deliveryTime: "1-3 days",
      quality: "Premium",
      inStock: true,
      stockCount: 3,
      image: "/placeholder.svg",
      verified: false
    },
    {
      id: 4,
      name: "Urban Boutique",
      price: 1950,
      originalPrice: null,
      rating: 4.4,
      reviews: 98,
      location: "Kileleshwa",
      distance: "8.2 km",
      deliveryFee: 200,
      deliveryTime: "2-4 days",
      quality: "Basic",
      inStock: false,
      stockCount: 0,
      image: "/placeholder.svg",
      verified: true
    }
  ];

  const getQualityColor = (quality: string) => {
    switch (quality.toLowerCase()) {
      case 'basic': return 'bg-gray-500';
      case 'premium': return 'bg-blue-500';
      case 'luxury': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const sortedStores = [...stores].sort((a, b) => {
    switch (sortBy) {
      case "price":
        return a.price - b.price;
      case "rating":
        return b.rating - a.rating;
      case "distance":
        return parseFloat(a.distance) - parseFloat(b.distance);
      case "delivery":
        return a.deliveryFee - b.deliveryFee;
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Compare Stores</h1>
          <p className="text-gray-600">
            Comparing prices for: <span className="font-semibold text-orange-600">{productName}</span>
          </p>
        </div>

        {/* Sorting Options */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="distance">Distance</SelectItem>
                <SelectItem value="delivery">Delivery Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-gray-500">
            {stores.length} stores found
          </div>
        </div>

        {/* Store Comparison Grid */}
        <div className="grid gap-6">
          {sortedStores.map((store, index) => (
            <Card key={store.id} className={`${index === 0 ? 'ring-2 ring-orange-500' : ''} ${!store.inStock ? 'opacity-75' : ''}`}>
              {index === 0 && (
                <div className="bg-orange-500 text-white text-center py-1 text-sm font-medium">
                  Best Match
                </div>
              )}
              
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-6">
                  {/* Store Image */}
                  <img 
                    src={store.image} 
                    alt={productName}
                    className="w-full lg:w-32 h-32 object-cover rounded-lg"
                  />
                  
                  {/* Store Details */}
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-xl font-semibold">{store.name}</h3>
                          {store.verified && (
                            <Badge className="bg-green-500 text-white text-xs">Verified</Badge>
                          )}
                          <Badge className={`${getQualityColor(store.quality)} text-white text-xs`}>
                            {store.quality}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-1">
                            <Star size={16} className="text-yellow-500 fill-current" />
                            <span className="font-medium">{store.rating}</span>
                            <span>({store.reviews} reviews)</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <MapPin size={16} />
                            <span>{store.location} • {store.distance}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-2xl font-bold text-orange-600">
                            KSh {store.price.toLocaleString()}
                          </span>
                          {store.originalPrice && (
                            <span className="text-sm text-gray-500 line-through">
                              KSh {store.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {store.inStock ? (
                            <span className="text-green-600">
                              {store.stockCount} in stock
                            </span>
                          ) : (
                            <span className="text-red-600">Out of stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Delivery Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <Truck size={16} className="text-gray-400" />
                        <span>Delivery: KSh {store.deliveryFee}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <Clock size={16} className="text-gray-400" />
                        <span>{store.deliveryTime}</span>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button 
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                        disabled={!store.inStock}
                      >
                        <ShoppingCart size={16} className="mr-2" />
                        {store.inStock ? 'Add to Cart' : 'Out of Stock'}
                      </Button>
                      
                      <Button variant="outline" size="default">
                        <Heart size={16} />
                      </Button>
                      
                      <Button variant="outline">
                        View Store
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">Lowest Price</p>
                <p className="text-lg font-bold text-green-600">
                  KSh {Math.min(...stores.filter(s => s.inStock).map(s => s.price)).toLocaleString()}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Highest Rating</p>
                <p className="text-lg font-bold text-yellow-600">
                  {Math.max(...stores.map(s => s.rating))} ⭐
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Closest Store</p>
                <p className="text-lg font-bold text-blue-600">
                  {Math.min(...stores.map(s => parseFloat(s.distance)))} km
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Lowest Delivery</p>
                <p className="text-lg font-bold text-purple-600">
                  KSh {Math.min(...stores.map(s => s.deliveryFee))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoreComparison;
