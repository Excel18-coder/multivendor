import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Star, Filter, ShoppingBag, Plus, Zap, Percent, TrendingUp, Award } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { StoreCard } from "@/components/StoreCard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { productApi, storeApi, adminApi } from "@/lib/api";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<any[]>([]);
  const [electronicsProducts, setElectronicsProducts] = useState<any[]>([]);
  const [discountProducts, setDiscountProducts] = useState<any[]>([]);
  const [topStores, setTopStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const navigate = useNavigate();

  const categories = [
    "all",
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
    "Kidswear & Baby Clothes",
    "Phones & Accessories",
    "Laptops & Computers",
    "Headphones, Smartwatches & Gadgets",
    "Sofas, Beds & Chairs",
    "Tables, Decor & Lighting",
    "Skin, Hair & Makeup Products",
    "Food, Snacks & Beverages",
    "Books, Notebooks & Office Supplies"
  ];

  useEffect(() => {
    fetchFeaturedData();
  }, []);

  const fetchFeaturedData = async () => {
    try {
      // Featured products from admin settings
      let featuredProductIds: string[] = [];
      let topSellingIds: string[] = [];
      try {
        const fs = await adminApi.getSetting("featured_products");
        const fsObj = typeof fs.value === 'string' ? JSON.parse(fs.value) : fs.value;
        featuredProductIds = fsObj?.product_ids || [];
      } catch {}
      try {
        const ts = await adminApi.getSetting("top_selling_products");
        const tsObj = typeof ts.value === 'string' ? JSON.parse(ts.value) : ts.value;
        topSellingIds = tsObj?.product_ids || [];
      } catch {}

      const toCard = (p: any) => ({
        id: p.id, name: p.name ?? "Unknown Product", price: p.price ?? 0,
        image: p.image_url ?? "/placeholder.svg", image_url: p.image_url ?? "/placeholder.svg",
        rating: 4.5, quality: "basic",
        store: p.store?.name ?? "Unknown Store",
        location: p.store?.location ?? "Kenya",
        tags: p.tags ?? [],
        discount_percentage: p.discount_percentage ?? 0,
      });

      const [allProducts, storesData] = await Promise.all([
        productApi.list({ in_stock: true, limit: 40 }),
        storeApi.list({ limit: 6 }),
      ]);

      // Featured
      const featured = featuredProductIds.length > 0
        ? allProducts.filter(p => featuredProductIds.includes(p.id)).slice(0, 8)
        : allProducts.slice(0, 8);
      setFeaturedProducts(featured.map(toCard));

      // Top selling
      if (topSellingIds.length > 0) {
        setTopSellingProducts(allProducts.filter(p => topSellingIds.includes(p.id)).map(toCard));
      } else {
        setTopSellingProducts([]);
      }

      // Electronics
      const elecCats = ["Phones & Accessories", "Laptops & Computers", "Headphones, Smartwatches & Gadgets"];
      setElectronicsProducts(allProducts.filter(p => p.category && elecCats.includes(p.category)).slice(0, 20).map(toCard));

      // Discount products
      setDiscountProducts(allProducts.filter(p => p.discount_price && p.discount_price < p.price).slice(0, 8).map(toCard));

      // Stores
      setTopStores(storesData.map(s => ({
        id: s.id, name: s.name, rating: s.rating ?? 4.5,
        products: 0, location: s.location ?? "Kenya",
        delivery_fee: 0, image_url: s.logo_url,
        followers: s.follower_count ?? 0, store_type: s.category,
      })));
    } catch (error) {
      console.error("Error fetching featured data:", error);
      setFeaturedProducts([]); setTopSellingProducts([]); setDiscountProducts([]); setTopStores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    navigate(`/marketplace?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleStartSelling = () => {
    navigate("/auth");
  };

  const filteredProducts = featuredProducts.filter(product => {
    const matchesSearch = searchQuery === "" || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.store.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || 
      product.name.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      product.tags.some((tag: string) => tag.toLowerCase().includes(selectedCategory.toLowerCase()));
    
    return matchesSearch && matchesCategory;
  });


  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 bg-gradient-to-br from-primary/10 to-accent/5">
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 px-4 py-2 text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              <Zap className="mr-2" size={16} />
              🇰🇪 Kenya's #1 Marketplace
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Urban Stores <span className="text-primary">Kenya</span>
            </h1>
            <p className="text-xl mb-4 text-muted-foreground font-medium">Discover authentic products from local Kenyan brands</p>
            <p className="text-base mb-12 text-muted-foreground/80 max-w-2xl mx-auto">Fast delivery • Secure checkout • Support local entrepreneurs</p>
            
            <div className="flex justify-center mb-8">
              <div className="max-w-2xl w-full relative">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  placeholder="Search for products, stores, or categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-14 pr-28 py-4 text-base rounded-xl bg-card text-foreground w-full shadow-lg border-input"
                />
                <Button 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-lg px-6 py-2 text-base font-medium"
                  onClick={handleSearch}
                >
                  Search
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-muted-foreground">Shop by Category</h3>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {(showAllCategories ? categories : categories.slice(0, 6)).map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(category);
                  if (category !== "all") {
                    navigate(`/marketplace?category=${encodeURIComponent(category)}`);
                  }
                }}
                className="capitalize text-sm font-medium px-4 py-2 rounded-full"
                size="sm"
              >
                {category}
              </Button>
            ))}
            {categories.length > 6 && (
              <Button
                variant="secondary"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-sm rounded-full px-4 py-2"
                size="sm"
              >
                <Plus size={14} className="mr-1" />
                {showAllCategories ? "Show Less" : `+${categories.length - 6} More`}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Hot Deals Section */}
      {discountProducts.length > 0 && (
        <section className="py-16 bg-gradient-to-br from-accent/5 to-destructive/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="mb-4 px-4 py-2 text-sm bg-accent/10 text-accent border-accent/20">
                <Percent className="mr-2" size={16} />
                Hot Deals
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">🔥 Limited Time Offers</h2>
              <p className="text-lg text-muted-foreground">Grab these amazing discounts before they're gone!</p>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Carousel opts={{ align: 'start', loop: true }} className="relative">
                <CarouselContent>
                 {discountProducts.map((product) => (
                   <CarouselItem key={product.id} className="basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                     <ProductCard product={product} />
                   </CarouselItem>
                 ))}
                </CarouselContent>
                <CarouselPrevious className="bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground" />
                <CarouselNext className="bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground" />
              </Carousel>
            )}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 px-4 py-2 text-sm bg-primary/10 text-primary border-primary/20">
              <Award className="mr-2" size={16} />
              Featured
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">✨ Featured Products</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Handpicked by our team for exceptional quality and value
            </p>
          </div>
          
          <div className="flex justify-center mb-8">
            <Button variant="outline" className="flex items-center gap-2 px-6 py-3 rounded-full" onClick={() => navigate('/marketplace')}>
              <Filter size={18} />
              Explore All Products
            </Button>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Carousel opts={{ align: 'start', loop: true }} className="relative">
              <CarouselContent>
                {filteredProducts.slice(0, 12).map((product) => (
                  <CarouselItem key={product.id} className="basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                    <ProductCard product={product} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </div>
      </section>

      {/* Top Selling Products */}
      {topSellingProducts.length > 0 && (
        <section className="py-16 bg-secondary/20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="mb-4 px-4 py-2 text-sm bg-success/10 text-success border-success/20">
                <TrendingUp className="mr-2" size={16} />
                Best Sellers
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">🏆 Top Selling Items</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Most loved products by our community
              </p>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {topSellingProducts.slice(0, 8).map((product, index) => (
                  <div key={product.id} className="relative">
                    <Badge className="absolute -top-2 -left-2 z-10 px-2 py-1 text-xs font-bold bg-primary text-primary-foreground">
                      #{index + 1}
                    </Badge>
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Electronics Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 px-4 py-2 text-sm bg-info/10 text-info border-info/20">
              <Zap className="mr-2" size={16} />
              Tech Zone
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">⚡ Electronics & Tech</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Latest gadgets and technology at unbeatable prices
            </p>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Carousel opts={{ align: 'start', loop: true }} className="relative">
              <CarouselContent>
                {electronicsProducts.map((product) => (
                  <CarouselItem key={product.id} className="basis-3/4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                    <ProductCard product={product} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
        </div>
      </section>

      {/* Top Followed Stores */}
      <section className="py-16 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 px-4 py-2 text-sm bg-warning/10 text-warning border-warning/20">
              <Star className="mr-2" size={16} />
              Community Favorites
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">⭐ Top Followed Stores</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover the most trusted and loved stores in Kenya
            </p>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topStores.sort((a, b) => (b.followers || 0) - (a.followers || 0)).slice(0, 6).map((store, index) => (
                <div key={store.id} className="relative">
                  {index < 3 && (
                    <Badge className="absolute -top-2 -right-2 z-10 px-2 py-1 text-xs font-bold bg-accent text-accent-foreground">
                      {index === 0 ? '👑 #1' : index === 1 ? '🥈 #2' : '🥉 #3'}
                    </Badge>
                  )}
                  <StoreCard store={store} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 px-6 py-3 text-lg bg-primary/10 text-primary border-primary/20">
              <ShoppingBag className="mr-2" size={20} />
              Join Our Community
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Start Your <span className="text-primary">Success Story</span>
            </h2>
            <p className="text-xl mb-4 text-muted-foreground font-medium">
              Join 1000+ Kenyan entrepreneurs already selling on our platform
            </p>
            <p className="text-base mb-12 text-muted-foreground max-w-2xl mx-auto">
              Zero setup fees • Easy store management • Instant payments • 24/7 support
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button 
                size="lg" 
                className="px-8 py-3 text-lg font-semibold rounded-xl"
                onClick={handleStartSelling}
              >
                <ShoppingBag className="mr-2" size={20} />
                Start Selling Today
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-3 text-lg font-semibold rounded-xl"
              >
                Learn More
              </Button>
            </div>

            {/* Success metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 text-foreground">
              <div>
                <div className="text-2xl font-bold mb-2 text-primary">₹2M+</div>
                <div className="text-sm text-muted-foreground">Monthly Sales</div>
              </div>
              <div>
                <div className="text-2xl font-bold mb-2 text-primary">98%</div>
                <div className="text-sm text-muted-foreground">Seller Satisfaction</div>
              </div>
              <div>
                <div className="text-2xl font-bold mb-2 text-primary">24hrs</div>
                <div className="text-sm text-muted-foreground">Average Setup Time</div>
              </div>
              <div>
                <div className="text-2xl font-bold mb-2 text-primary">0%</div>
                <div className="text-sm text-muted-foreground">Setup Fees</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;