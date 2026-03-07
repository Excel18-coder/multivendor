
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, MapPin, ShoppingCart, Heart, ArrowLeft, GitCompare, MessageCircle, Smartphone, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { productApi, cartApi, wishlistApi, paymentApi } from "@/lib/api";
import { ImageModal } from "@/components/ImageModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  store: {
    id: string;
    name: string;
    location: string;
    image_url: string | null;
    slug?: string;
    whatsapp_phone?: string | null;
    mpesa_enabled?: boolean | null;
    mpesa_status?: string | null;
  } | null;
}

const ProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // M-Pesa payment state
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [transactionRef, setTransactionRef] = useState<string | null>(null);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    if (!productId) return;

    try {
      const data = await productApi.get(productId);
      if (data) {
        setProduct({
          ...data,
          image_url: data.images?.[0] || '',
          image_urls: data.images || [],
          tags: data.tags || [],
          store: data.store ? {
            id: data.store.id,
            name: data.store.name,
            location: data.store.location || '',
            image_url: data.store.logo_url || null,
            slug: data.store.slug,
            whatsapp_phone: (data.store as any).whatsapp_phone || data.store.whatsapp || null,
            mpesa_enabled: !!(data.store.mpesa_api_key),
            mpesa_status: data.store.mpesa_api_key ? 'approved' : null,
          } : null,
        } as Product);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast({
        title: "Error",
        description: "Failed to load product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      await cartApi.add(product!.id, 1);
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

  const handleAddToWishlist = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      await wishlistApi.add(product!.id);
      toast({
        title: "Success",
        description: "Product added to wishlist!",
      });
    } catch (error: any) {
      if (error?.message?.includes('already')) {
        toast({ title: "Info", description: "Product is already in your wishlist" });
        return;
      }
      console.error("Error adding to wishlist:", error);
      toast({
        title: "Error",
        description: "Failed to add product to wishlist",
        variant: "destructive",
      });
    }
  };

  const handleStoreClick = () => {
    if (product?.store) {
      const storeIdentifier = product.store.slug || product.store.id;
      navigate(`/stores/${storeIdentifier}`);
    }
  };

  const handleWhatsAppOrder = () => {
    if (!product?.store?.whatsapp_phone) {
      toast({
        title: "WhatsApp Not Available",
        description: "This store doesn't have WhatsApp ordering enabled",
        variant: "destructive",
      });
      return;
    }

    const productUrl = window.location.href;
    const hasProductDiscount = typeof product.discount_percentage === 'number' && product.discount_percentage > 0;
    const productDiscountedPrice = hasProductDiscount
      ? product.price * (1 - (product.discount_percentage as number) / 100)
      : product.price;
    const message = `Hi! I'm interested in ordering: ${product.name} (KSh ${hasProductDiscount ? productDiscountedPrice.toFixed(2) : product.price}) from your store.\n\nProduct link: ${productUrl}`;
    const whatsappUrl = `https://wa.me/${product.store.whatsapp_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;

    try {
      const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        if (window.top) {
          window.top.location.href = whatsappUrl;
        } else {
          window.location.href = whatsappUrl;
        }
      }
    } catch (e) {
      if (window.top) {
        window.top.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }
    }
  };

  const handlePayViaMpesa = () => {
    if (!product?.store?.mpesa_enabled || product?.store?.mpesa_status !== 'approved') {
      toast({
        title: "M-Pesa Not Available",
        description: "This store hasn't activated M-Pesa payments yet",
        variant: "destructive",
      });
      return;
    }
    setPhoneNumber("");
    setPaymentStatus('idle');
    setTransactionRef(null);
    setMpesaDialogOpen(true);
  };

  const initiatePayment = async () => {
    if (!product || !phoneNumber) return;

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\s+/g, '');
    if (!/^(254|0|\+254)?[17]\d{8}$/.test(cleanPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Safaricom phone number",
        variant: "destructive",
      });
      return;
    }

    setPaymentLoading(true);
    setPaymentStatus('idle');

    const hasProductDiscount = typeof product.discount_percentage === 'number' && product.discount_percentage > 0;
    const productDiscountedPrice = hasProductDiscount
      ? product.price * (1 - (product.discount_percentage as number) / 100)
      : product.price;
    const finalPrice = hasProductDiscount ? productDiscountedPrice : product.price;

    try {
      const data = await paymentApi.mpesaInitiate({
        store_id: product.store?.id || '',
        phone: cleanPhone,
        amount: finalPrice,
        order_reference: `product-${product.id}-${Date.now()}`
      });

      setTransactionRef(data.checkout_request_id);
      setPaymentStatus('pending');
      toast({
        title: "STK Push Sent",
        description: "Please check your phone and enter your M-Pesa PIN",
      });
      // Start polling
      pollPaymentStatus(data.checkout_request_id, product.store?.id || '');
    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setPaymentStatus('failed');
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate M-Pesa payment",
        variant: "destructive",
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const pollPaymentStatus = async (reference: string, storeId: string) => {
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPaymentStatus('failed');
        toast({
          title: "Payment Timeout",
          description: "Payment verification timed out. Please check your M-Pesa messages.",
          variant: "destructive",
        });
        return;
      }

      try {
        const data = await paymentApi.mpesaStatus(reference, storeId);
        const status = data?.status?.toLowerCase();
        if (status === 'success') {
          setPaymentStatus('success');
          toast({
            title: "Payment Successful!",
            description: "Your payment has been received.",
          });
        } else if (status === 'failed') {
          setPaymentStatus('failed');
          toast({
            title: "Payment Failed",
            description: data?.result_desc || "Payment was not completed",
            variant: "destructive",
          });
        } else {
          attempts++;
          setTimeout(poll, 5000);
        }
      } catch (err) {
        console.error('Polling error:', err);
        attempts++;
        setTimeout(poll, 5000);
      }
    };

    poll();
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

  if (!product) {
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative">
              <ImageModal
                images={allImages}
                initialIndex={currentImageIndex}
                trigger={
                  <img
                    src={allImages[currentImageIndex]}
                    alt={product.name}
                    className="w-full h-96 object-contain bg-white rounded-lg shadow-md cursor-pointer"
                  />
                }
              />
              {allImages.length > 1 && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1}/{allImages.length}
                </div>
              )}
              {hasDiscount && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  -{product.discount_percentage}% OFF
                </div>
              )}
            </div>
            
            {/* Image Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {allImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      index === currentImageIndex ? 'border-orange-500' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              
              {/* Store Information */}
              {product.store && (
                <button
                  onClick={handleStoreClick}
                  className="flex items-center space-x-2 text-orange-600 hover:text-orange-700 mb-4 transition-colors"
                >
                  <img 
                    src={product.store.image_url || "/placeholder.svg"} 
                    alt={product.store.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="font-medium">by {product.store.name}</span>
                  <MapPin size={14} />
                  <span className="text-sm text-gray-500">{product.store.location}</span>
                </button>
              )}

              {/* Price */}
              <div className="flex items-center space-x-4 mb-4">
                {hasDiscount ? (
                  <>
                    <span className="text-3xl font-bold text-orange-600">
                      KSh {discountedPrice.toFixed(2)}
                    </span>
                    <span className="text-xl text-gray-500 line-through">
                      KSh {product.price}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-orange-600">
                    KSh {product.price}
                  </span>
                )}
              </div>

              {/* Quality and Stock Status */}
              <div className="flex items-center space-x-4 mb-6">
                <Badge variant="outline" className="text-sm">
                  Quality: {product.quality}
                </Badge>
                <Badge variant={product.in_stock ? "default" : "destructive"}>
                  {product.in_stock ? "In Stock" : "Out of Stock"}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <Button
                size="lg"
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={handleAddToCart}
                disabled={!product.in_stock}
              >
                <ShoppingCart size={20} className="mr-2" />
                Add to Cart
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleAddToWishlist}
                disabled={!product.in_stock}
              >
                <Heart size={20} className="mr-2" />
                Add to Wishlist
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/compare/${product.id}`)}
              >
                <GitCompare size={20} className="mr-2" />
                Compare
              </Button>

              {product.store?.whatsapp_phone && (
                product.in_stock ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full bg-green-600 hover:bg-green-700 text-white border-green-600"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${product.store.whatsapp_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi! I'm interested in ordering: ${product.name} (KSh ${hasDiscount ? discountedPrice.toFixed(2) : product.price}) from your store.\n\nProduct link: ${window.location.href}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Order ${product.name} on WhatsApp`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleWhatsAppOrder();
                      }}
                    >
                      <MessageCircle size={20} className="mr-2" />
                      Order on WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full bg-green-600 hover:bg-green-700 text-white border-green-600"
                    disabled
                  >
                    <MessageCircle size={20} className="mr-2" />
                    Order on WhatsApp
                  </Button>
                )
              )}

              {/* M-Pesa Pay Button */}
              {product.store?.mpesa_enabled && product.store?.mpesa_status === 'approved' && (
                product.in_stock ? (
                  <Button
                    size="lg"
                    className="w-full bg-green-700 hover:bg-green-800 text-white"
                    onClick={handlePayViaMpesa}
                  >
                    <Smartphone size={20} className="mr-2" />
                    Pay via M-Pesa
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full bg-green-700 text-white"
                    disabled
                  >
                    <Smartphone size={20} className="mr-2" />
                    Pay via M-Pesa
                  </Button>
                )
              )}
            </div>

            {/* Description */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">Product Description</h3>
                <div 
                  className="text-gray-700 leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ 
                    __html: product.description?.replace(/\n/g, '<br>') || 'No description available.' 
                  }}
                />
              </CardContent>
            </Card>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* M-Pesa Payment Dialog */}
      <Dialog open={mpesaDialogOpen} onOpenChange={setMpesaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-600" />
              Pay via M-Pesa
            </DialogTitle>
            <DialogDescription>
              Enter your M-Pesa phone number to pay for {product?.name}
            </DialogDescription>
          </DialogHeader>
          
          {paymentStatus === 'idle' && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Product: <span className="font-medium">{product?.name}</span></p>
                <p className="text-lg font-bold text-green-600">Amount: KSh {hasDiscount ? discountedPrice.toFixed(2) : product?.price}</p>
              </div>
              <div>
                <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                <Input
                  id="mpesa-phone"
                  placeholder="e.g., 0712345678 or 254712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <Button
                onClick={initiatePayment}
                disabled={paymentLoading || !phoneNumber}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Smartphone size={16} className="mr-2" />
                    Pay Now
                  </>
                )}
              </Button>
            </div>
          )}
          
          {paymentStatus === 'pending' && (
            <div className="text-center py-6">
              <Loader2 size={48} className="mx-auto text-green-600 animate-spin mb-4" />
              <h3 className="text-lg font-semibold mb-2">Waiting for Payment</h3>
              <p className="text-gray-600 mb-4">
                Check your phone and enter your M-Pesa PIN to complete payment.
              </p>
              <p className="text-sm text-gray-500">Amount: KSh {hasDiscount ? discountedPrice.toFixed(2) : product?.price}</p>
            </div>
          )}
          
          {paymentStatus === 'success' && (
            <div className="text-center py-6">
              <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">Payment Successful!</h3>
              <p className="text-gray-600 mb-4">
                Your payment for {product?.name} has been received.
              </p>
              <Button
                onClick={() => setMpesaDialogOpen(false)}
                className="bg-green-600 hover:bg-green-700"
              >
                Done
              </Button>
            </div>
          )}
          
          {paymentStatus === 'failed' && (
            <div className="text-center py-6">
              <XCircle size={48} className="mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold text-red-800 mb-2">Payment Failed</h3>
              <p className="text-gray-600 mb-4">
                The payment was not completed. You may have cancelled or the request timed out.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setMpesaDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => setPaymentStatus('idle')}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductPage;
