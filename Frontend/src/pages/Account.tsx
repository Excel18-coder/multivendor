
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { Header } from "@/components/Header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, Settings, Trash2, UserCog } from "lucide-react";

const Account = () => {
  const { user, signOut, refreshUser } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  const updateProfile = async () => {
    setUpdating(true);
    try {
      await authApi.updateProfile({ full_name: fullName, phone });
      await refreshUser();
      toast({ title: "Success", description: "Profile updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      toast({ title: "Account Deleted", description: "Your account has been permanently deleted." });
      signOut();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-gray-600">Please sign in to view your account.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">My Account</h1>

          {/* Profile Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user.email} disabled />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
              </div>
              <Button onClick={updateProfile} disabled={updating} className="w-full">
                {updating ? "Updating..." : "Update Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings size={20} />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-800">Account ID</h3>
                  <p className="text-sm text-gray-600 font-mono">{user.id}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Account Type</h3>
                  <p className="text-sm text-gray-600 capitalize">{user.user_type}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Member Since</h3>
                  <p className="text-sm text-gray-600">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role Info */}
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <UserCog size={20} />
                Role Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Your account type determines what you can do:</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• <strong>Buyer:</strong> Browse, purchase products, manage cart/wishlist</li>
                  <li>• <strong>Seller:</strong> Create stores, add products, manage inventory</li>
                  <li>• <strong>Admin:</strong> Full platform management access</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 size={20} />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-medium text-red-800">Delete Account</h3>
              <p className="text-sm text-gray-600 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting} className="w-full">
                    {deleting ? "Deleting..." : "Delete Account"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account, stores, products, orders, and all other data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount} className="bg-red-600 hover:bg-red-700">
                      Yes, delete my account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;
