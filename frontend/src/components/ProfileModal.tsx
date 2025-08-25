import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Plus, User, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const [showIPOForm, setShowIPOForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageLink: ''
  });
  const { toast } = useToast();

  const userData = {
    name: 'Alex Thompson',
    email: 'alex.thompson@email.com',
    balance: 15420.50,
    totalInvested: 8580.00
  };

  const handleIPOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "IPO Submitted!",
      description: `${formData.name} has been submitted for review`,
    });
    
    setFormData({ name: '', description: '', imageLink: '' });
    setShowIPOForm(false);
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
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                </div>
                <span className="font-semibold text-success">
                  ${userData.balance.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Invested</span>
                </div>
                <span className="font-semibold">
                  ${userData.totalInvested.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* IPO Section */}
          {!showIPOForm ? (
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Issue IPO</CardTitle>
                <CardDescription>
                  Create a new investment opportunity for others to invest in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => setShowIPOForm(true)}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Submit IPO
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Submit IPO</CardTitle>
                <CardDescription>Fill out the details for your IPO</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleIPOSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Taylor Swift, Climate Change, etc."
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what people are investing in..."
                      rows={3}
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image">Image Link (Optional)</Label>
                    <Input
                      id="image"
                      type="url"
                      value={formData.imageLink}
                      onChange={(e) => setFormData({ ...formData, imageLink: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-1 bg-gradient-primary hover:opacity-90">
                      Submit IPO
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
        </div>
      </DialogContent>
    </Dialog>
  );
};