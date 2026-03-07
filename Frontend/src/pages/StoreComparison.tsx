
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Star, MapPin, Truck, Clock, Heart, ShoppingCart } from "lucide-react";

const StoreComparison = () => {
  const [sortBy, setSortBy] = useState("rating");

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
