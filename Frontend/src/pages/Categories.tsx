import { useState, useEffect } from 'react';
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { productApi } from "@/lib/api";
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Leaf, Shirt, Utensils, Smartphone, Home, Heart, BookOpen } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  quality: string;
  image_url: string;
  in_stock: boolean;
  tags: string[];
  discount_percentage?: number;
  stores?: {
    id: string;
    name: string;
    store_type: string;
  };
}

interface CategoryType {
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  items: string[];
}

const Categories = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const categoryTypes: CategoryType[] = [
    { 
      name: "Fashion & Apparel", 
      description: "Clothing and accessories for all occasions", 
      icon: Shirt,
      items: [
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
      ]
    },
    { 
      name: "Electronics & Tech", 
      description: "Latest gadgets and technology", 
      icon: Smartphone,
      items: [
        "Phones & Accessories",
        "Laptops & Computers",
        "Headphones, Smartwatches & Gadgets"
      ]
    },
    { 
      name: "Home & Furniture", 
      description: "Everything for your home", 
      icon: Home,
      items: [
        "Sofas, Beds & Chairs",
        "Tables, Decor & Lighting"
      ]
    },
    { 
      name: "Beauty & Health", 
      description: "Beauty and wellness products", 
      icon: Heart,
      items: [
        "Skin, Hair & Makeup Products"
      ]
    },
    { 
      name: "Food & Books", 
      description: "Nutrition and knowledge", 
      icon: BookOpen,
      items: [
        "Food, Snacks & Beverages",
        "Books, Notebooks & Office Supplies"
      ]
    }
  ];

  useEffect(() => {
    fetchAllProducts();
  }, []);

  const fetchAllProducts = async () => {
    setLoading(true);
    try {
      const data = await productApi.list({ in_stock: true });
      const products = (data || []).map((p: any) => ({
        ...p,
        image_url: p.image_url || '',
        tags: p.tags || [],
        stores: p.store ? { id: p.store.id, name: p.store.name, store_type: p.store.category } : undefined,
      }));
      setAllProducts(products as Product[]);
      setFilteredProducts(products as Product[]);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term) {
      const searched = allProducts.filter(product =>
        product.name.toLowerCase().includes(term.toLowerCase()) ||
        product.description.toLowerCase().includes(term.toLowerCase()) ||
        product.tags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredProducts(searched);
    } else {
      setFilteredProducts(allProducts);
    }
  };

const filterProductsByCategory = (categoryName: string) => {
    const category = categoryTypes.find(cat => cat.name === categoryName);
    if (!category) return;

    const filtered = allProducts.filter(product => 
      category.items.some(item => 
        product.category?.toLowerCase().includes(item.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(item.toLowerCase())) ||
        product.name?.toLowerCase().includes(item.toLowerCase())
      )
    );
    setFilteredProducts(filtered);
    setSelectedCategory(categoryName);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilteredProducts(allProducts);
    setSelectedCategory(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Explore Categories</h1>
          <p className="text-gray-600">
            Browse products by category type.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Input
            type="text"
            placeholder="Search for products..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-12"
          />
          <Search className="absolute left-4 top-3 h-5 w-5 text-gray-500" />
        </div>

        {/* Category Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {categoryTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Card 
                key={type.name}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${
                  selectedCategory === type.name 
                    ? 'ring-2 ring-orange-500 bg-orange-50' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => navigate(`/marketplace?category=${encodeURIComponent(type.items.join(','))}`)}
              >
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">
                    <IconComponent className="w-10 h-10 mx-auto text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{type.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{type.description}</p>
                  
                  {/* Category Items */}
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700 mb-2">All Categories</div>
                    <div className="space-y-1 text-sm text-gray-600 max-h-32 overflow-y-auto">
                      {type.items.map((item, index) => (
                        <div key={index} className="text-xs hover:text-orange-600 cursor-pointer py-0.5">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Clear Filters Button */}
        {selectedCategory && (
          <div className="mb-6">
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        )}

        {/* Products Display */}
        {selectedCategory && (
          <div>
            <h2 className="text-2xl font-bold mb-6">
              {selectedCategory} Products ({filteredProducts.length})
            </h2>
            
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    No products found for {selectedCategory}
                  </p>
                  <Button onClick={() => setSelectedCategory(null)}>
                    View All Categories
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                   <ProductCard key={product.id} product={{
                     ...product,
                     store: product.stores ? { id: product.stores.id, name: product.stores.name } : undefined
                   }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;