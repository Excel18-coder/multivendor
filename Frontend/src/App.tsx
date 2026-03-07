
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Marketplace from "./pages/Marketplace";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Account from "./pages/Account";
import Stores from "./pages/Stores";
import StorePage from "./pages/StorePage";
import ProductPage from "./pages/ProductPage";
import Compare from "./pages/Compare";
import Categories from "./pages/Categories";
import SellerAuth from "./pages/SellerAuth";
import Checkout from "./pages/Checkout";
import SellerDashboard from "./pages/SellerDashboard";
import Admin from "./pages/Admin";
import ComplaintForm from "./pages/ComplaintForm";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/seller-auth" element={<SellerAuth />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/account" element={<Account />} />
              <Route path="/stores" element={<Stores />} />
              <Route path="/stores/:storeSlug" element={<StorePage />} />
              <Route path="/products/:productId" element={<ProductPage />} />
              <Route path="/compare/:productId" element={<Compare />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/seller-dashboard" element={<SellerDashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/complaint" element={<ComplaintForm />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
