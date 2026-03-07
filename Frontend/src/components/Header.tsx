
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, User, Menu, X, Heart, AlertTriangle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSearch = () => {
    navigate(`/marketplace?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="/favicon.png" 
              alt="Urban Stores" 
              className="w-8 h-8 rounded-lg object-contain"
            />
            <span className="font-bold text-xl text-gray-900 hidden sm:block">
              Urban Stores
            </span>
          </Link>

          {/* Search Bar - Hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 pr-4"
              />
            </div>
          </div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/marketplace" className="text-gray-700 hover:text-orange-600 transition-colors">
              Marketplace
            </Link>
            <Link to="/stores" className="text-gray-700 hover:text-orange-600 transition-colors">
              Stores
            </Link>
            <Link to="/categories" className="text-gray-700 hover:text-orange-600 transition-colors">
              Categories
            </Link>
            <Link to="/complaint" className="text-gray-700 hover:text-orange-600 transition-colors">
              Complaints
            </Link>
          </nav>

          {/* User Actions - Desktop */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/wishlist")}>
                  <Heart size={20} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/cart")}>
                  <ShoppingCart size={20} />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <User size={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate("/account")}>
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/wishlist")}>
                      Wishlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/seller-dashboard")}>
                      Seller Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={signOut}>
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button onClick={() => navigate("/auth")}>
                  Sign Up
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {/* Mobile Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 pr-4"
                />
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="space-y-2 mb-4">
              <Link 
                to="/marketplace" 
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Marketplace
              </Link>
              <Link 
                to="/stores" 
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Stores
              </Link>
              <Link 
                to="/categories" 
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Categories
              </Link>
              <Link 
                to="/complaint" 
                className="block py-2 text-gray-700 hover:text-orange-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Complaints
              </Link>
            </nav>

            {/* Mobile User Actions */}
            <div className="space-y-2">
              {user ? (
                <>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    onClick={() => {
                      navigate("/wishlist");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <Heart size={20} className="mr-2" />
                    Wishlist
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    onClick={() => {
                      navigate("/cart");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <ShoppingCart size={20} className="mr-2" />
                    Cart
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    onClick={() => {
                      navigate("/account");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <User size={20} className="mr-2" />
                    My Account
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    onClick={() => {
                      navigate("/seller-dashboard");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Seller Dashboard
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start" 
                    onClick={signOut}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Sign In
                  </Button>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      navigate("/auth");
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Sign Up
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
