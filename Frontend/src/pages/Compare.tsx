
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { productApi, cartApi, wishlistApi } from "@/lib/api";
import { ArrowLeft, ShoppingCart, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  store_id: string;
  stores: {
    name: string;
    store_type: string;
  } | null;
}

const Compare = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      fetchProductAndSimilar();
    }
  }, [productId]);

  const fetchProductAndSimilar = async () => {
    if (!productId) return;

    try {
      const product = await productApi.get(productId);
      if (!product) throw new Error('Product not found');
      
      const mapped = {
        ...product,
        image_url: product.image_url || '',
        tags: product.tags || [],
        store_id: product.store_id,
        stores: product.store ? { name: product.store.name, store_type: product.store.category || '' } : null,
      } as unknown as Product;
      
      setOriginalProduct(mapped);

      if (product.store?.category) {
        const similar = await productApi.list({ category: product.category || undefined, limit: 6 });
        const mappedSimilar = (similar || [])
          .filter((p: any) => p.id !== productId)
          .slice(0, 6)
          .map((p: any) => ({
            ...p,
            image_url: p.image_url || '',
            tags: p.tags || [],
            stores: p.store ? { name: p.store.name, store_type: p.store.category || '' } : null,
          }));
        setSimilarProducts(mappedSimilar as unknown as Product[]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load comparison data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      await cartApi.add(productId, 1);
      toast({
        title: "Success",
        description: "Product added to cart!",
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast({
        title: "Error",
        description: "Failed to add product to cart",
        variant: "destructive",
      });
    }
  };

  const addToWishlist = async (productId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      await wishlistApi.add(productId);
      toast({
        title: "Success",
        description: "Product added to wishlist!",
      });
    } catch (error) {
      console.error("Error adding to wishlist:", error);
      toast({
        title: "Error",
        description: "Failed to add product to wishlist",
        variant: "destructive",
      });
    }
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

  if (!originalProduct || !originalProduct.stores) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <Button onClick={() => navigate("/marketplace")}>
              Back to Marketplace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Compare Products</h1>
          <p className="text-gray-600">
            Comparing products similar to "{originalProduct.name}" in {originalProduct.stores.store_type || 'similar'} stores
          </p>
        </div>

        {/* Original Product */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Selected Product</h2>
          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <img
                  src={originalProduct.image_url || "/placeholder.svg"}
                  alt={originalProduct.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
                <div>
                  <h3 className="text-xl font-bold mb-2">{originalProduct.name}</h3>
                  <p className="text-2xl font-bold text-orange-600 mb-2">KSh {originalProduct.price}</p>
                  <p className="text-gray-600 mb-4">{originalProduct.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {originalProduct.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">From: {originalProduct.stores?.name}</p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => addToCart(originalProduct.id)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <ShoppingCart size={16} className="mr-2" />
                      Add to Cart
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => addToWishlist(originalProduct.id)}
                    >
                      <Heart size={16} className="mr-2" />
                      Wishlist
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Similar Products */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Similar Products ({similarProducts.length} found)
          </h2>
          
          {similarProducts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-gray-500 mb-4">No similar products found in the same store type.</p>
                <Button onClick={() => navigate("/marketplace")}>
                  Browse All Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarProducts.map((product) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <img
                      src={product.image_url || "/placeholder.svg"}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded mb-4"
                    />
                    <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                    <p className="text-lg font-bold text-orange-600 mb-2">KSh {product.price}</p>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mb-3">From: {product.stores?.name || 'Unknown Store'}</p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        onClick={() => addToCart(product.id)}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        <ShoppingCart size={14} className="mr-1" />
                        Cart
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline" 
                        onClick={() => addToWishlist(product.id)}
                      >
                        <Heart size={14} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Compare;
