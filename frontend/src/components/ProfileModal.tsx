import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Plus, User, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import axios from "@/api/axiosInstance";

type AccountSnapshot = {
  wallet: { balance: string; frozen_balance: string };
  positions: { quantity: string; averageBuyPrice: string }[];
};

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestLoginOpen?: () => void;
}

export const ProfileModal = ({
  open,
  onOpenChange,
  onRequestLoginOpen,
}: ProfileModalProps) => {
  const [showIPOForm, setShowIPOForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    imageLink: "",
  });
  const { toast } = useToast();
  const { user, isAuthenticated, logout } = useAuth();
  const [account, setAccount] = useState<
    (AccountSnapshot & { userId: string }) | null
  >(null);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    setAccount(null);
    setAccountError("");
    if (!open || !user?.id) return;
    const userId = user.id;
    let active = true;
    let requestId = 0;
    const load = async () => {
      const request = ++requestId;
      try {
        const { data } = await axios.get<AccountSnapshot>("/trade/account");
        if (active && request === requestId) {
          setAccount({ ...data, userId });
          setAccountError("");
        }
      } catch {
        if (active && request === requestId)
          setAccountError("Account data unavailable.");
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    window.addEventListener("portfolio:updated", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("portfolio:updated", load);
      window.removeEventListener("focus", load);
    };
  }, [open, user?.id]);

  const snapshot = account?.userId === user?.id ? account : null;
  const totalInvested = snapshot?.positions.reduce(
    (sum, position) =>
      sum + Number(position.quantity) * Number(position.averageBuyPrice),
    0,
  );
  const money = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;

  const userData = {
    name: user?.name || "User",
    email: user?.email || "user@example.com",
  };

  const handleIPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.imageLink) {
      toast({
        title: "Error",
        description:
          "Please fill in all required fields, including an image URL.",
        variant: "destructive",
      });
      return;
    }
    (async () => {
      try {
        // call API gateway to submit IPO
        const payload = {
          name: formData.name,
          description: formData.description,
          imageUrl: formData.imageLink,
        };
        // axiosInstance is not imported here; use fetch to avoid adding imports in this change
        const apiBase = import.meta.env.VITE_API_URL || "";
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${apiBase}/assets/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err || "Failed to submit IPO");
        }

        toast({
          title: "IPO Submitted!",
          description: `${formData.name} has been submitted for review`,
        });

        setFormData({ name: "", description: "", imageLink: "" });
        setShowIPOForm(false);
      } catch (err: any) {
        toast({
          title: "Submission failed",
          description: err?.message || String(err),
          variant: "destructive",
        });
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-secondary border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-primary" />
            <span>Profile</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <Card className="bg-gradient-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{userData.name}</CardTitle>
              <CardDescription>{userData.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">
                    Available Balance
                  </span>
                </div>
                <span className="font-semibold text-success">
                  {snapshot ? money(Number(snapshot.wallet.balance)) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Total Invested
                  </span>
                </div>
                <span className="font-semibold">
                  {totalInvested !== undefined ? money(totalInvested) : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cost of current holdings, including units reserved for sale.
              </p>
              {accountError && (
                <p role="alert" className="text-sm text-destructive">
                  {accountError}
                  {snapshot && " Displayed values may be stale."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* IPO Section */}
          {!showIPOForm ? (
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Asset listing</CardTitle>
                <CardDescription>
                  Listings require approval before trading.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setShowIPOForm(true)}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Submit Listing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Submit Listing</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIPOSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Being a hater, Jorts, Meme Energy"
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe the concept or trend people are investing in..."
                      rows={3}
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image">Image URL *</Label>
                    <Input
                      id="image"
                      type="url"
                      value={formData.imageLink}
                      onChange={(e) =>
                        setFormData({ ...formData, imageLink: e.target.value })
                      }
                      placeholder="https://example.com/image.jpg"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-primary hover:opacity-90"
                    >
                      Submit Listing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowIPOForm(false)}
                      className="border-border hover:bg-accent"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {isAuthenticated ? (
              <div className="flex space-x-2">
                <Button
                  className="w-full bg-destructive"
                  onClick={async () => {
                    await logout();
                    onOpenChange(false);
                    toast({
                      title: "Logged out",
                      description: "You have been signed out",
                    });
                  }}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex space-x-2">
                <Button
                  className="w-1/2 bg-gradient-primary"
                  onClick={() => {
                    onOpenChange(false);
                    onRequestLoginOpen && onRequestLoginOpen();
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  className="w-1/2"
                  onClick={() => {
                    onOpenChange(false);
                    onRequestLoginOpen && onRequestLoginOpen();
                  }}
                >
                  Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
