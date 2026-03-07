
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Info, Upload } from "lucide-react";
import { productApi, storeApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ProductFormProps {
  storeId: string;
  onSuccess: () => void;
  onCancel: () => void;
  product?: any;
}

export const ProductForm = ({ storeId, onSuccess, onCancel, product }: ProductFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price || "",
    category: product?.category || "",
    quality: product?.quality || "basic",
    image_url: product?.image_url || "",
    image_urls: product?.image_urls || [],
    in_stock: product?.in_stock !== undefined ? product.in_stock : true,
    discount_percentage: product?.discount_percentage || "",
  });
  const [tags, setTags] = useState<string[]>(product?.tags || []);
  const [newTag, setNewTag] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Store-specific categories and tags
  const getStoreTypeCategories = (storeType: string) => {
    const categoryMap: Record<string, { categories: string[], tags: string[] }> = {
      "Fashion & Apparel": {
        categories: ["T-Shirts & Shirts", "Hoodies & Sweatshirts", "Jeans & Trousers", "Suits & Formal Wear", "Dresses & Skirts", "Tracksuits & Sweatpants", "Shoes & Sneakers", "Heels & Flats", "Bags & Backpacks", "Caps, Watches & Accessories", "Innerwear & Lingerie", "Kidswear & Baby Clothes"],
        tags: ["tracksuits", "jeans", "suits", "tshirts", "hoodies", "dresses", "sneakers", "heels", "caps", "balenciaga", "nike", "adidas", "zara", "boots", "loafers", "denim", "jackets"]
      },
      "Tech & Gadgets": {
        categories: ["Phones & Accessories", "Laptops & Computers", "Headphones, Smartwatches & Gadgets"],
        tags: ["hp", "dell", "macbook", "iphone", "samsung", "oraimo", "charger", "powerbank", "smartwatch", "earbuds", "laptop", "keyboard", "mouse", "speaker", "phone", "tablet", "screen"]
      },
      "Furniture & Home": {
        categories: ["Sofas, Beds & Chairs", "Tables, Decor & Lighting"],
        tags: ["sofa", "chair", "table", "bed", "mattress", "curtains", "shelf", "lamp", "carpet", "wardrobe", "cabinet", "kitchen", "pillow", "decor", "mirror"]
      },
      "Health & Beauty": {
        categories: ["Skin, Hair & Makeup Products"],
        tags: ["skincare", "makeup", "lotion", "perfume", "soap", "serum", "cleanser", "oil", "nails", "deodorant", "brush", "hair", "cologne", "wellness", "bodywash"]
      },
      "Food & Grocery": {
        categories: ["Food, Snacks & Beverages"],
        tags: ["rice", "sugar", "milk", "bread", "eggs", "juice", "snacks", "tea", "coffee", "meat", "fruits", "vegetables", "water", "spices", "flour"]
      },
      "Books & Stationery": {
        categories: ["Books, Notebooks & Office Supplies"],
        tags: ["textbook", "novel", "pen", "pencil", "notebook", "highlighter", "paper", "sharpener", "eraser", "stapler", "ruler", "files", "journal", "diary", "calculator"]
      }
    };

    return categoryMap[storeType] || {
      categories: ["T-Shirts & Shirts", "Hoodies & Sweatshirts", "Jeans & Trousers", "Phones & Accessories", "Sofas, Beds & Chairs", "Skin, Hair & Makeup Products", "Food, Snacks & Beverages", "Books, Notebooks & Office Supplies"],
      tags: ["new", "popular", "bestseller", "limited-edition", "premium", "budget-friendly", "eco-friendly", "handmade", "imported", "local"]
    };
  };

  const [storeType, setStoreType] = useState<string>("");
  
  useEffect(() => {
    const fetchStoreType = async () => {
      if (storeId) {
        try {
          const stores = await storeApi.list();
          const found = (stores || []).find((s: any) => s.id === storeId);
          if (found?.category || (found as any)?.store_type) {
            setStoreType(found.category || (found as any).store_type);
          }
        } catch {
          // ignore
        }
      }
    };
    
    fetchStoreType();
  }, [storeId]);

  const storeCategories = getStoreTypeCategories(storeType);
  const categories = storeCategories.categories;
  const availableTags = storeCategories.tags;

  const tagExamples = [
    "cotton", "silk", "denim", "leather", "wool", "linen", // Materials
    "casual", "formal", "business", "sport", "outdoor", "vintage", // Styles
    "red", "blue", "black", "white", "green", "pink", // Colors
    "small", "medium", "large", "xl", "xxl", // Sizes
    "macbook", "iphone", "samsung", "nike", "adidas", // Brands
    "sofa", "chair", "table", "lamp", "curtain", "pillow", // Home items
    "handmade", "organic", "eco-friendly", "sustainable", // Qualities
    "african", "kenyan", "maasai", "kikoy", "traditional" // Cultural
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags(prev => [...prev, trimmedTag]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const addExampleTag = (exampleTag: string) => {
    if (!tags.includes(exampleTag.toLowerCase())) {
      setTags(prev => [...prev, exampleTag.toLowerCase()]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleImageUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const uploadPromises = files.map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const currentUrls = formData.image_urls || [];
      const newUrls = [...currentUrls, ...uploadedUrls];
      
      handleInputChange("image_urls", newUrls);
      if (!formData.image_url && newUrls.length > 0) {
        handleInputChange("image_url", newUrls[0]);
      }
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} image(s) selected successfully!`,
      });
    } catch (error) {
      console.error("Error processing images:", error);
      toast({
        title: "Error",
        description: "Failed to process images",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(files);
      handleImageUpload(files);
    }
  };

  const removeImage = (index: number) => {
    const newUrls = [...(formData.image_urls || [])];
    newUrls.splice(index, 1);
    handleInputChange("image_urls", newUrls);
    
    if (formData.image_url === formData.image_urls?.[index]) {
      handleInputChange("image_url", newUrls[0] || "");
    }
  };

  const addImageUrl = () => {
    if (formData.image_url && !formData.image_urls?.includes(formData.image_url)) {
      const newUrls = [...(formData.image_urls || []), formData.image_url];
      handleInputChange("image_urls", newUrls);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tags.length < 3) {
      toast({
        title: "Minimum 3 tags required",
        description: "Please add at least 3 tags to help customers find your product and enable comparisons",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Build payload without discount when left blank
      const productData: any = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        quality: formData.quality,
        images: formData.image_urls || (formData.image_url ? [formData.image_url] : []),
        stock_quantity: 100,
        is_active: formData.in_stock,
        store_id: storeId,
        tags,
      };

      if (formData.discount_percentage !== "" && formData.discount_percentage !== null && formData.discount_percentage !== undefined) {
        productData.discount_price = parseFloat(formData.price) * (1 - parseFloat(formData.discount_percentage as any) / 100);
      }

      if (product) {
        await productApi.update(product.id, productData);
      } else {
        await productApi.create(productData);
      }

      toast({
        title: "Success",
        description: product ? "Product updated successfully!" : "Product added successfully!",
      });
      
      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: `Failed to ${product ? 'update' : 'add'} product`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? 'Edit Product' : 'Add New Product'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
              placeholder="Enter product name"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <div className="mt-2">
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(value) => handleInputChange("description", value)}
                placeholder="Describe your product with rich formatting..."
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'clean']
                  ],
                }}
                formats={[
                  'header', 'bold', 'italic', 'underline',
                  'list', 'bullet', 'link'
                ]}
                style={{ backgroundColor: 'white' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (KSh) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => handleInputChange("price", e.target.value)}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="discount_percentage">Discount % (optional)</Label>
              <Input
                id="discount_percentage"
                type="number"
                value={formData.discount_percentage}
                onChange={(e) => handleInputChange("discount_percentage", e.target.value)}
                min="0"
                max="100"
                step="0.01"
                placeholder="Enter discount percentage (0-100)"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quality">Quality *</Label>
            <Select value={formData.quality} onValueChange={(value) => handleInputChange("quality", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="image">Product Images (Multiple allowed)</Label>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button type="button" disabled={uploading} className="flex items-center gap-2">
                  <Upload size={16} />
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => handleInputChange("image_url", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1"
                />
                <Button type="button" onClick={addImageUrl}>Add URL</Button>
              </div>
              {formData.image_urls && formData.image_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {formData.image_urls.map((url, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={url} 
                        alt={`Product ${index + 1}`} 
                        className="w-full h-24 object-cover rounded-md border"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removeImage(index)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Product Tags * (minimum 3 required)</Label>
            <div className="flex items-center gap-2 text-sm text-blue-600 mb-2">
              <Info size={16} />
              <span>Tags help customers find your products and enable comparisons with similar items in stores of the same type</span>
            </div>
            <div className="flex gap-2 mb-2">
              <Input
                id="tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter a tag and press Enter"
              />
              <Button type="button" onClick={addTag}>Add</Button>
            </div>
            
            <div className="mb-3">
              <p className="text-sm text-gray-600 mb-2">Current tags ({tags.length}/3 minimum):</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      size={14}
                      className="cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Quick add examples:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 12).map((example) => (
                  <Badge 
                    key={example} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => addExampleTag(example)}
                  >
                    + {example}
                  </Badge>
                ))}
              </div>
            </div>
            
            {tags.length < 3 && (
              <p className="text-sm text-red-500 mt-2">At least 3 tags are required (currently {tags.length})</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="in_stock"
              checked={formData.in_stock}
              onChange={(e) => handleInputChange("in_stock", e.target.checked)}
            />
            <Label htmlFor="in_stock">In Stock</Label>
          </div>

          <div className="flex space-x-4">
            <Button type="submit" disabled={loading || tags.length < 3} className="flex-1">
              {loading ? "Saving..." : (product ? "Update Product" : "Add Product")}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
