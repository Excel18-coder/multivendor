
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cartApi, wishlistApi } from '@/lib/api';

interface AppContextType {
  cartCount: number;
  wishlistCount: number;
  updateCartCount: () => void;
  updateWishlistCount: () => void;
  refreshCounts: () => void;
}

const AppContext = createContext<AppContextType>({
  cartCount: 0,
  wishlistCount: 0,
  updateCartCount: () => {},
  updateWishlistCount: () => {},
  refreshCounts: () => {},
});

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const { user } = useAuth();

  const updateCartCount = async () => {
    if (!user) {
      setCartCount(0);
      return;
    }
    try {
      const items = await cartApi.get();
      const total = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      setCartCount(total);
    } catch {
      setCartCount(0);
    }
  };

  const updateWishlistCount = async () => {
    if (!user) {
      setWishlistCount(0);
      return;
    }
    try {
      const items = await wishlistApi.get();
      setWishlistCount(items.length);
    } catch {
      setWishlistCount(0);
    }
  };

  const refreshCounts = () => {
    updateCartCount();
    updateWishlistCount();
  };

  useEffect(() => {
    if (user) {
      refreshCounts();
    } else {
      setCartCount(0);
      setWishlistCount(0);
    }
  }, [user]);

  return (
    <AppContext.Provider value={{
      cartCount,
      wishlistCount,
      updateCartCount,
      updateWishlistCount,
      refreshCounts,
    }}>
      {children}
    </AppContext.Provider>
  );
};

// Export for backward compatibility
export const AppContextProvider = AppProvider;
