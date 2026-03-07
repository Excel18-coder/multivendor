
import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Star, ShoppingCart, Heart } from "lucide-react";
import { productApi, cartApi, wishlistApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  quality: string;
  image_url: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  stores?: {
    name: string;
    location: string;
  };
}

const ProductComparison = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comparisonProducts, setComparisonProducts] = useState<Product[]>([]);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchComparisonProducts();
    }
  }, [user]);

  const fetchComparisonProducts = async () => {
    if (!user) return;

    try {
      const comparisons = await productApi.getComparisons();
      const mapped = (comparisons || []).map((p: any) => ({
        ...p,
        image_url: p.image_url || null,
        tags: p.tags || [],
        stores: p.store ? { name: p.store.name, location: p.store.location || '' } : undefined,
      }));
      setComparisonProducts(mapped);

      // Find similar products based on tags
      if (mapped.length > 0) {
        const allTags = [...new Set(mapped.flatMap((p: any) => p.tags))];
        const similar = await productApi.list({ in_stock: true, limit: 8 });
        const filtered = (similar || [])
          .filter((p: any) => !mapped.find((c: any) => c.id === p.id))
          .filter((p: any) => (p.tags || []).some((tag: string) => allTags.includes(tag)))
          .map((p: any) => ({
            ...p,
            image_url: p.image_url || null,
            tags: p.tags || [],
            stores: p.store ? { name: p.store.name, location: p.store.location || '' } : undefined,
          }));
        setSimilarProducts(filtered);
      }
    } catch (error) {
      console.error("Error fetching comparison products:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromComparison = async (productId: string) => {
    if (!user) return;

    try {
      await productApi.removeComparison(productId);
      setComparisonProducts(prev => prev.filter(p => p.id !== productId));
      toast({
        title: "Product removed",
        description: "Product removed from comparison",
      });
    } catch (error) {
      console.error("Error removing product:", error);
      toast({
        title: "Error",
        description: "Failed to remove product from comparison",
        variant: "destructive",
      });
    }
  };

  const addToComparison = async (productId: string) => {
    if (!user) return;

    try {
      await productApi.addComparison(productId);
      fetchComparisonProducts();
      toast({
        title: "Product added",
        description: "Product added to comparison",
      });
    } catch (error) {
      console.error("Error adding product to comparison:", error);
      toast({
        title: "Error",
        description: "Failed to add product to comparison",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please Login</h1>
            <p className="text-gray-600">You need to login to compare products</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Product Comparison</h1>
          <p className="text-gray-600">Compare products side by side to make informed decisions</p>
        </div>

        {comparisonProducts.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-600 mb-4">No products to compare</h2>
            <p className="text-gray-500 mb-6">Add products to comparison from the marketplace</p>
            <Button onClick={() => window.location.href = "/marketplace"}>
              Browse Products
            </Button>
          </div>
        ) : (
          <>
            {/* Comparison Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Product</th>
                      {comparisonProducts.map((product) => (
                        <th key={product.id} className="px-6 py-4 text-center">
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0"
                              onClick={() => removeFromComparison(product.id)}
                            >
                              <X size={16} />
                            </Button>
                             <img
                              src={product.image_url || "/placeholder.svg"}
                              alt={product.name}
                              className="w-20 h-20 object-contain rounded mx-auto mb-2"
                            />
                            <p className="font-medium text-sm">{product.name}</p>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Price</td>
                      {comparisonProducts.map((product) => (
                        <td key={product.id} className="px-6 py-4 text-center">
                          <span className="text-lg font-bold text-orange-600">
                            KSh {product.price}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Quality</td>
                      {comparisonProducts.map((product) => (
                        <td key={product.id} className="px-6 py-4 text-center">
                          <Badge
                            variant={product.quality === 'luxury' ? 'default' : 
                                   product.quality === 'premium' ? 'secondary' : 'outline'}
                          >
                            {product.quality}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Store</td>
                      {comparisonProducts.map((product) => (
                        <td key={product.id} className="px-6 py-4 text-center">
                          <div>
                            <p className="font-medium">
                              {Array.isArray(product.stores) ? product.stores[0]?.name : product.stores?.name || "Unknown Store"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {Array.isArray(product.stores) ? product.stores[0]?.location : product.stores?.location || "Kenya"}
                            </p>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Tags</td>
                      {comparisonProducts.map((product) => (
                        <td key={product.id} className="px-6 py-4 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {product.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Actions</td>
                      {comparisonProducts.map((product) => (
                        <td key={product.id} className="px-6 py-4 text-center">
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              className="bg-orange-600 hover:bg-orange-700"
                              onClick={async () => {
                                if (!user) { window.location.href = "/auth"; return; }
                                try {
                                  await cartApi.add(product.id, 1);
                                  toast({ title: "Added to cart!" });
                                } catch {
                                  toast({ title: "Error", description: "Failed to add to cart", variant: "destructive" });
                                }
                              }}
                            >
                              <ShoppingCart size={16} className="mr-1" />
                              Add to Cart
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!user) { window.location.href = "/auth"; return; }
                                try {
                                  await wishlistApi.add(product.id);
                                  toast({ title: "Added to wishlist!" });
                                } catch {
                                  toast({ title: "Error", description: "Failed to add to wishlist", variant: "destructive" });
                                }
                              }}
                            >
                              <Heart size={16} className="mr-1" />
                              Wishlist
                            </Button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Similar Products */}
            {similarProducts.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Similar Products You Might Like</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {similarProducts.map((product) => (
                    <Card key={product.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                         <img
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="w-full h-32 object-contain rounded mb-4"
                        />
                        <h3 className="font-semibold mb-2">{product.name}</h3>
                        <p className="text-orange-600 font-bold mb-2">KSh {product.price}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {product.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => addToComparison(product.id)}
                        >
                          Add to Compare
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductComparison;
