import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { wishlistApi, cartApi, type WishlistItem } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";

const Wishlist = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateCartCount, updateWishlistCount } = useAppContext();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchWishlistItems();
    else setLoading(false);
  }, [user]);

  const fetchWishlistItems = async () => {
    try {
      const data = await wishlistApi.get();
      setWishlistItems(data);
    } catch {
      toast({ title: "Error", description: "Failed to load wishlist", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (itemId: string) => {
    try {
      await wishlistApi.remove(itemId);
      setWishlistItems(prev => prev.filter(i => i.id !== itemId));
      updateWishlistCount();
      toast({ title: "Removed", description: "Item removed from wishlist" });
    } catch {
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    }
  };

  const addToCart = async (productId: string) => {
    if (!user) return;
    try {
      await cartApi.add(productId, 1);
      updateCartCount();
      toast({ title: "Success", description: "Item added to cart" });
    } catch {
      toast({ title: "Error", description: "Failed to add item to cart", variant: "destructive" });
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Please Login</h1>
        <p className="text-gray-600 mb-6">You need to login to view your wishlist</p>
        <Link to="/auth"><Button className="bg-orange-600 hover:bg-orange-700">Login</Button></Link>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Wishlist</h1>
        {wishlistItems.length === 0 ? (
          <div className="text-center py-12">
            <Heart size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Your wishlist is empty</h2>
            <p className="text-gray-500 mb-6">Save items you love to your wishlist</p>
            <Link to="/marketplace"><Button className="bg-orange-600 hover:bg-orange-700">Continue Shopping</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <Card key={item.id} className="group overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img
                    src={item.product?.images?.[0] ?? "/placeholder.svg"}
                    alt={item.product?.name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 bg-red-100 text-red-500 rounded-full p-2" onClick={() => removeFromWishlist(item.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.product?.name}</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-orange-600">KSh {item.product?.price?.toLocaleString()}</span>
                  </div>
                  {item.product?.store && (
                    <div className="text-sm text-gray-600 mb-4">
                      <div className="font-medium">{item.product.store.name}</div>
                    </div>
                  )}
                  <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => item.product_id && addToCart(item.product_id)}>
                    <ShoppingCart size={16} className="mr-2" />Add to Cart
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
