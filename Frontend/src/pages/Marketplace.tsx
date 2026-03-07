
import { useState, useEffect } from 'react';
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { productApi } from "@/lib/api";

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

const Marketplace = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<number[]>([0, 0]);
  const [priceBounds, setPriceBounds] = useState<{min: number; max: number}>({ min: 0, max: 0 });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [productsPerPage] = useState(12);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Updated categories list
  const predefinedCategories = [
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
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, priceRange, categoryFilter, page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const productsData = await productApi.list({ in_stock: true });
      setProducts(productsData as any);
      setCategories(predefinedCategories);
      if (productsData.length > 0) {
        const prices = productsData.map(p => Number(p.price) || 0);
        const minPrice = Math.floor(Math.min(...prices));
        const maxPrice = Math.ceil(Math.max(...prices));
        setPriceBounds({ min: minPrice, max: maxPrice });
        setPriceRange([minPrice, maxPrice]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Search Filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Price Range Filter
    const effectiveMin = priceRange[0] || priceBounds.min || 0;
    const effectiveMax = priceRange[1] || priceBounds.max || Number.MAX_SAFE_INTEGER;
    filtered = filtered.filter(product => {
      const priceNum = Number((product as any).price) || 0;
      return priceNum >= effectiveMin && priceNum <= effectiveMax;
    });

    // Category Filter - Enhanced to handle multiple categories
    if (categoryFilter && categoryFilter !== 'All' && categoryFilter !== '') {
      const filterTerms = categoryFilter.split(',').map(term => term.trim().toLowerCase());
      filtered = filtered.filter(product => 
        filterTerms.some(term =>
          product.category?.toLowerCase().includes(term) ||
          product.tags?.some(tag => tag.toLowerCase().includes(term)) ||
          product.name?.toLowerCase().includes(term)
        )
      );
    }

    // Store all filtered results for pagination calculation
    const totalFiltered = filtered.length;
    
    // Apply pagination
    const startIndex = (page - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedResults = filtered.slice(0, endIndex); // Show cumulative results for "load more"

    setFilteredProducts(paginatedResults);
  };

  // Handle URL parameters for category filtering
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    const searchParam = urlParams.get('search');
    
    if (categoryParam) {
      setCategoryFilter(categoryParam);
    }
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handlePriceChange = (value: number[]) => {
    setPriceRange(value);
    setPage(1); // Reset to first page on price change
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1); // Reset to first page on category change
  };

  const handleLoadMore = () => {
    setPage(prevPage => prevPage + 1);
  };

  const displayedCategories = showAllCategories ? categories : categories.slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header and Search */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Marketplace</h1>
            <div className="flex gap-2">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  type="text"
                  placeholder="Search products..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
              <Button
                variant="outline"
                className="md:hidden"
                onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              >
                <Filter size={20} />
              </Button>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600 mb-4">
            {loading ? "Loading..." : `${filteredProducts.length} products found`}
          </div>
        </div>

        {/* Mobile Filters */}
        <Collapsible open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
          <CollapsibleContent className="md:hidden mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mobile Price Range */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range (KSh {priceRange[0]} - KSh {priceRange[1]})
                  </Label>
                  <Slider
                    min={priceBounds.min}
                    max={priceBounds.max}
                    step={100}
                    value={priceRange}
                    onValueChange={handlePriceChange}
                  />
                </div>

                {/* Mobile Category Filter */}
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Categories
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge 
                      variant={categoryFilter === '' ? "default" : "outline"} 
                      className="cursor-pointer p-2 text-center justify-center"
                      onClick={() => handleCategoryChange('All')}
                    >
                      All
                    </Badge>
                    {displayedCategories.map(category => (
                      <Badge 
                        key={category}
                        variant={categoryFilter === category ? "default" : "outline"} 
                        className="cursor-pointer p-2 text-center justify-center"
                        onClick={() => handleCategoryChange(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                    {categories.length > 6 && (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer p-2 text-center justify-center"
                        onClick={() => setShowAllCategories(!showAllCategories)}
                      >
                        <Plus size={14} className="mr-1" />
                        {showAllCategories ? "Show Less" : `+${categories.length - 6} More`}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Desktop Filters */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Price Range Filter */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Price Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  KSh {priceRange[0]} - KSh {priceRange[1]}
                </div>
                <Slider
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={100}
                  value={priceRange}
                  onValueChange={handlePriceChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Category Filter */}
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={categoryFilter === '' ? "default" : "outline"} 
                  className="cursor-pointer"
                  onClick={() => handleCategoryChange('All')}
                >
                  All Categories
                </Badge>
                {displayedCategories.map(category => (
                  <Badge 
                    key={category}
                    variant={categoryFilter === category ? "default" : "outline"} 
                    className="cursor-pointer"
                    onClick={() => handleCategoryChange(category)}
                  >
                    {category}
                  </Badge>
                ))}
                {categories.length > 6 && (
                  <Badge 
                    variant="secondary" 
                    className="cursor-pointer"
                    onClick={() => setShowAllCategories(!showAllCategories)}
                  >
                    <Plus size={14} className="mr-1" />
                    {showAllCategories ? "Show Less" : `Show ${categories.length - 6} More`}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
               <ProductCard 
                 key={product.id} 
                 product={{
                   ...product,
                   store: product.stores ? { id: product.stores.id, name: product.stores.name } : undefined
                 }} 
               />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-500 mb-4">
                <Search size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p>Try adjusting your search terms or filters</p>
              </div>
              <Button variant="outline" onClick={() => {
                setSearchTerm('');
                setCategoryFilter('');
                setPriceRange([priceBounds.min, priceBounds.max]);
                setPage(1);
              }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Load More Button */}
        {!loading && filteredProducts.length > 0 && filteredProducts.length >= productsPerPage && (
          <div className="mt-8 flex justify-center">
            <Button onClick={handleLoadMore} size="lg">
              Load More Products
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;
