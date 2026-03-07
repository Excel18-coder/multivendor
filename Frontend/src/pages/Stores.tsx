
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { StoreCard } from "@/components/StoreCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, Store } from "lucide-react";
import { storeApi } from "@/lib/api";

interface Store {
  id: string;
  name: string;
  location: string;
  delivery_fee: number;
  image_url: string | null;
  store_type: string | null;
  description: string | null;
  products?: number;
  slug?: string;
}

const Stores = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  const storeTypes = [
    "Fashion & Apparel",
    "Tech & Gadgets", 
    "Furniture & Home",
    "Health & Beauty",
    "Food & Grocery",
    "Books & Stationery"
  ];

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    filterStores();
  }, [stores, searchTerm, selectedCategory]);

  const fetchStores = async () => {
    try {
      const data = await storeApi.list();
      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.location || 'Kenya',
        delivery_fee: 0,
        image_url: s.logo_url || s.image_url || null,
        store_type: s.category || s.store_type || null,
        description: s.description || null,
        products: 0,
        slug: s.slug,
        rating: s.rating || 3.0,
      }));
      setStores(mapped);
    } catch (error) {
      console.error("Error fetching stores:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterStores = () => {
    let filtered = stores;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(store =>
        store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(store => store.store_type === selectedCategory);
    }

    setFilteredStores(filtered);
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Stores</h1>
          <p className="text-gray-600">Discover amazing stores and their unique products</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search stores by name, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-black"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {storeTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Filter size={16} />
              More Filters
            </Button>
          </div>
        </div>

        {/* Stores Grid */}
        {filteredStores.length === 0 ? (
          <div className="text-center py-12">
            <Store size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">No stores found</h2>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStores.map((store) => (
              <StoreCard
                key={store.id}
                store={{
                  id: store.id,
                  name: store.name || "Unknown Store",
                  rating: (store as any).rating || 3.0,
                  products: store.products || 0,
                  location: store.location || "Kenya",
                  delivery_fee: store.delivery_fee || 0,
                  image_url: store.image_url,
                  store_type: store.store_type,
                  slug: store.slug
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stores;
