import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { ArrowLeft } from "lucide-react";

const SellerAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate("/seller-dashboard");
  }, [user, navigate]);

  const handleSellerSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password, fullName, undefined, "seller");
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome Seller!", description: "Your seller account has been created." });
      navigate("/seller-dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
          
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Join as a Seller</CardTitle>
              <CardDescription>
                Start selling your products on Urban Stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSellerSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="seller-name">Full Name</Label>
                  <Input
                    id="seller-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="seller-email">Email</Label>
                  <Input
                    id="seller-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <Label htmlFor="seller-password">Password</Label>
                  <Input
                    id="seller-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Create a password"
                    minLength={6}
                  />
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Seller Benefits:</strong>
                  </p>
                  <ul className="text-sm text-orange-700 mt-2 space-y-1">
                    <li>• Create your own store</li>
                    <li>• List unlimited products</li>
                    <li>• Track sales and analytics</li>
                    <li>• Manage customer orders</li>
                  </ul>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating seller account..." : "Create Seller Account"}
                </Button>
                
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link to="/auth" className="text-orange-600 hover:underline">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SellerAuth;