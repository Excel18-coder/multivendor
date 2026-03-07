
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart, Eye, GitCompare, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cartApi, wishlistApi } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import { useState } from "react";
import { ImageModal } from "./ImageModal";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  quality: string;
  image_url: string;
  image_urls?: string[];
  in_stock: boolean;
  tags?: string[];
  discount_percentage?: number;
  store?: {
    id: string;
    name: string;
    slug?: string;
  };
}

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateCartCount, updateWishlistCount } = useAppContext();
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    setLoading(true);
    try {
      await cartApi.add(product.id, 1);
      updateCartCount();
      toast({ title: "Success", description: "Product added to cart!" });
    } catch {
      toast({ title: "Error", description: "Failed to add product to cart", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    try {
      await wishlistApi.add(product.id);
      updateWishlistCount();
      toast({ title: "Success", description: "Product added to wishlist!" });
    } catch (err: any) {
      if (err.message?.includes("already")) {
        toast({ title: "Info", description: "Product is already in your wishlist" });
      } else {
        toast({ title: "Error", description: "Failed to add product to wishlist", variant: "destructive" });
      }
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/compare/${product.id}`);
  };

  const handleProductClick = () => {
    navigate(`/products/${product.id}`);
  };

  const handleStoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.store) {
      const storeIdentifier = product.store.slug || product.store.id;
      navigate(`/stores/${storeIdentifier}`);
    }
  };

  const hasDiscount = typeof product.discount_percentage === 'number' && product.discount_percentage > 0;
  const discountedPrice = hasDiscount
    ? product.price * (1 - (product.discount_percentage as number) / 100)
    : product.price;

  const allImages = product.image_urls && product.image_urls.length > 0 
    ? product.image_urls 
    : product.image_url 
    ? [product.image_url] 
    : ["/placeholder.svg"];

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm cursor-pointer"
      onClick={handleProductClick}
    >
      <CardContent className="p-0">
        <div className="relative overflow-hidden">
          <img
            src={allImages[0]}
            alt={product.name}
            className="w-full h-48 object-contain group-hover:scale-105 transition-transform duration-300 bg-white"
          />
          {allImages.length > 1 && (
            <Badge className="absolute top-2 right-2 bg-blue-500 text-white">
              1/{allImages.length}
            </Badge>
          )}
          {hasDiscount && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white">
              -{product.discount_percentage}%
            </Badge>
          )}
          {product.in_stock === false && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <Badge variant="destructive">Out of Stock</Badge>
            </div>
          )}
        </div>
        
        <div className="p-4">
          <div className="mb-2">
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-orange-600 transition-colors">
              {product.name}
            </h3>
            {product.store?.name && (
              <button
                onClick={handleStoreClick}
                className="flex items-center space-x-1 text-sm text-orange-600 font-medium hover:text-orange-700 transition-colors mt-1"
              >
                <Store size={14} />
                <span>by {product.store.name}</span>
              </button>
            )}
          </div>
          
          <div 
            className="text-gray-600 text-sm mb-3 line-clamp-2"
            dangerouslySetInnerHTML={{ 
              __html: product.description?.replace(/\n/g, '<br>') || '' 
            }}
          />
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              {hasDiscount ? (
                <>
                  <span className="text-lg font-bold text-orange-600">
                    KSh {discountedPrice.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500 line-through">
                    KSh {product.price}
                  </span>
                </>
              ) : (
                <span className="text-lg font-bold text-orange-600">
                  KSh {product.price}
                </span>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {product.quality}
            </Badge>
          </div>

          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {product.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {product.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{product.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleAddToCart}
              disabled={product.in_stock === false || loading}
            >
              <ShoppingCart size={14} className="mr-1" />
              {loading ? "Adding..." : "Add to Cart"}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddToWishlist}
              disabled={product.in_stock === false}
            >
              <Heart size={14} />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCompare}
              title="Compare similar products"
            >
              <GitCompare size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
