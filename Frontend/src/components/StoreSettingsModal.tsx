import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { storeApi } from "@/lib/api";
import { Upload, X } from "lucide-react";

interface Store {
  id: string;
  name: string;
  description?: string;
  location?: string;
  store_type?: string;
  image_url?: string;
  payment_options?: string[];
}

interface StoreSettingsModalProps {
  open: boolean;
  onClose: () => void;
  store: Store;
  onUpdate: (updatedStore: Store) => void;
}

export const StoreSettingsModal = ({ open, onClose, store, onUpdate }: StoreSettingsModalProps) => {
  const [name, setName] = useState(store.name || "");
  const [description, setDescription] = useState(store.description || "");
  const [location, setLocation] = useState(store.location || "");
  const [storeType, setStoreType] = useState(store.store_type || "");
  const [paymentOptions, setPaymentOptions] = useState<string[]>(store.payment_options || ["POD"]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(store.image_url || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const storeTypes = [
    "fashion",
    "electronics",
    "furniture",
    "beauty",
    "food",
    "books",
    "sports",
    "jewelry",
    "art",
    "other"
  ];

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imagePreview;

    // Convert to data URL for storage (backend handles actual file serving)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(imagePreview);
      reader.readAsDataURL(imageFile);
    });
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let imageUrl = imagePreview;
      
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const { error } = await (async () => {
        try {
          await storeApi.update(store.id, {
            name,
            description,
            location,
            category: storeType,
            logo_url: imageUrl || undefined,
          } as any);
          return { error: null };
        } catch (e) {
          return { error: e };
        }
      })();

      if (error) throw error;

      const updatedStore = {
        ...store,
        name,
        description,
        location,
        store_type: storeType,
        image_url: imageUrl,
        payment_options: paymentOptions
      };

      onUpdate(updatedStore);
      onClose();
      toast({
        title: "Success",
        description: "Store settings updated successfully!",
      });
    } catch (error) {
      console.error('Error updating store:', error);
      toast({
        title: "Error",
        description: "Failed to update store settings",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Store Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Store Image */}
          <div>
            <Label className="text-sm font-medium">Store Image</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative w-32 h-32">
                  <img
                    src={imagePreview}
                    alt="Store preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0"
                    onClick={() => {
                      setImagePreview("");
                      setImageFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X size={12} />
                  </Button>
                </div>
              ) : (
                <div
                  className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-500"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={24} className="text-gray-400" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {!imagePreview && (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2"
                >
                  Upload Image
                </Button>
              )}
            </div>
          </div>

          {/* Store Name */}
          <div>
            <Label htmlFor="name">Store Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter store name"
            />
          </div>

          {/* Store Type */}
          <div>
            <Label htmlFor="store-type">Store Type</Label>
            <Select value={storeType} onValueChange={setStoreType}>
              <SelectTrigger>
                <SelectValue placeholder="Select store type" />
              </SelectTrigger>
              <SelectContent>
                {storeTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your store"
              rows={3}
            />
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Store location"
            />
          </div>

          {/* Payment Options */}
          <div>
            <Label>Payment Options</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={paymentOptions.includes("POD")}
                  onChange={(e) => {
                    const options = e.target.checked
                      ? [...paymentOptions, "POD"]
                      : paymentOptions.filter(o => o !== "POD");
                    setPaymentOptions(options);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">Pay on Delivery</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={paymentOptions.includes("Prepay")}
                  onChange={(e) => {
                    const options = e.target.checked
                      ? [...paymentOptions, "Prepay"]
                      : paymentOptions.filter(o => o !== "Prepay");
                    setPaymentOptions(options);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">Prepay</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};