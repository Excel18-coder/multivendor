
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Package, Truck, Users, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { storeApi } from "@/lib/api";
import { useState, useEffect } from "react";

interface Store {
  id: string;
  name: string;
  rating: number;
  products: number;
  location: string;
  delivery_fee: number;
  image_url: string | null;
  followers?: number;
  store_type?: string;
  slug?: string;
}

interface StoreCardProps {
  store: Store;
}

export const StoreCard = ({ store }: StoreCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [complaintsCount, setComplaintsCount] = useState(0);

  useEffect(() => {
    fetchFollowersCount();
    fetchComplaintsCount();
    if (user) {
      checkFollowStatus();
    }
  }, [user, store.id]);

  // Refresh followers count periodically (no realtime in Go backend)

  const fetchFollowersCount = async () => {
    try {
      // Use follower_count from store data if available
      setFollowersCount((store as any).follower_count || store.followers || 0);
    } catch (error) {
      console.error("Error fetching followers count:", error);
      setFollowersCount(store.followers || 0);
    }
  };

  const fetchComplaintsCount = async () => {
    // Complaints count not available in list view
    setComplaintsCount(0);
  };

  const checkFollowStatus = async () => {
    if (!user) return;

    try {
      const data = await storeApi.followStatus(store.id);
      setIsFollowing(data.following);
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  const handleViewStore = () => {
    // Use slug if available, otherwise fall back to ID
    const storeIdentifier = store.slug || store.id;
    navigate(`/stores/${storeIdentifier}`);
  };

  const handleFollow = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      if (isFollowing) {
        await storeApi.unfollow(store.id);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        toast({
          title: "Success",
          description: `You have unfollowed ${store.name}`,
        });
      } else {
        await storeApi.follow(store.id);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast({
          title: "Success",
          description: `You are now following ${store.name}`,
        });
      }
    } catch (error) {
      console.error("Error following/unfollowing store:", error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <img 
            src={store.image_url || "/placeholder.svg"} 
            alt={store.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">{store.name}</h3>
              <div className="flex items-center space-x-1">
                <Star size={16} className="text-yellow-500 fill-current" />
                <span className="font-medium">{store.rating.toFixed(1)}</span>
              </div>
            </div>
            
            {store.store_type && (
              <Badge variant="outline" className="mb-2">
                {store.store_type}
              </Badge>
            )}
            
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Package size={14} />
                <span>{store.products || 0} products</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <MapPin size={14} />
                <span>{store.location}</span>
              </div>
              

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users size={14} />
                  <span>{followersCount} followers</span>
                </div>
                {complaintsCount > 0 && (
                  <div className="flex items-center space-x-1 text-red-600">
                    <AlertTriangle size={14} />
                    <span>{complaintsCount} complaints</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleViewStore}
              >
                View Store
              </Button>
              <Button 
                size="sm" 
                className={`flex-1 ${isFollowing ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                onClick={handleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
