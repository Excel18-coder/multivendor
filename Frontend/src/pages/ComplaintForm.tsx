
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { storeApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Store {
  id: string;
  name: string;
}

const ComplaintForm = () => {
  const [formData, setFormData] = useState({
    storeId: "",
    message: "",
    contactEmail: ""
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const data = await storeApi.list();
      setStores((data || []).map((s: any) => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error("Error fetching stores:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const targetStoreId = formData.storeId === "general" ? null : formData.storeId;
      if (targetStoreId) {
        await storeApi.addComplaint(targetStoreId, {
          subject: 'Customer Complaint',
          message: formData.message,
        });
      } else {
        // General complaint — submit to first store or skip
        throw new Error('Please select a specific store for your complaint');
      }

      toast({
        title: "Complaint Submitted",
        description: "Your complaint has been submitted successfully. We'll review it soon.",
      });

      // Reset form
      setFormData({
        storeId: "",
        message: "",
        contactEmail: ""
      });
    } catch (error: any) {
      console.error("Error submitting complaint:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit complaint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Submit a Complaint</h1>
            <p className="text-gray-600">
              We take all complaints seriously. Please provide as much detail as possible 
              to help us resolve your issue quickly.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Complaint Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="storeId">Store (Optional)</Label>
                  <Select 
                    value={formData.storeId} 
                    onValueChange={(value) => setFormData({ ...formData, storeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a store (if applicable)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Complaint</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contactEmail">Your Email (Optional)</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="your.email@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Provide your email if you'd like us to follow up with you
                  </p>
                </div>

                <div>
                  <Label htmlFor="message">Complaint Details *</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Please describe your complaint in detail..."
                    rows={6}
                    required
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">Before submitting:</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Ensure you've tried to resolve the issue directly with the seller</li>
                    <li>• Include specific details about dates, order numbers, or incidents</li>
                    <li>• Be respectful and factual in your description</li>
                    <li>• Complaints are reviewed within 24-48 hours</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={loading || !formData.message.trim()}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Send size={16} />
                      <span>Submit Complaint</span>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              All complaints are handled confidentially. For urgent matters, 
              please contact our support team directly at support@urbanthreads.co.ke
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintForm;
