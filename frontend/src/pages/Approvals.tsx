import { useEffect, useState } from 'react';
import axiosInstance from '@/api/axiosInstance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export const Approvals = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ initialPrice: '', totalSupply: '', creatorPercentage: '' });
  const { toast } = useToast();

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/assets/all');
      const data = res.data || [];
      const pending = (Array.isArray(data) ? data : []).filter((a) => a.status === 'pending');
      setAssets(pending);
    } catch (e) {
      toast({ title: 'Failed to load assets', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, []);

  const openApprove = (asset: any) => {
    setSelected(asset);
    setForm({ initialPrice: asset.initial_price ?? '', totalSupply: asset.total_supply ?? '', creatorPercentage: asset.creator_split_percentage ?? '' });
  };

  const close = () => { setSelected(null); setForm({ initialPrice: '', totalSupply: '', creatorPercentage: '' }); };

  const submitApprove = async () => {
    if (!selected) return;
    try {
      await axiosInstance.patch(`/assets/${selected.id}/approve`, {
        initialPrice: Number(form.initialPrice),
        totalSupply: Number(form.totalSupply),
        creatorPercentage: Number(form.creatorPercentage),
      });
      toast({ title: 'Approved', description: `${selected.name} approved.` });
      close();
      fetchAssets();
    } catch (e: any) {
      toast({ title: 'Approval failed', description: e?.response?.data?.message || e.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : assets.length === 0 ? (
            <div>No pending assets</div>
          ) : (
            <div className="space-y-4">
              {assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-background border-border rounded">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-sm text-muted-foreground">{a.description}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => openApprove(a)} className="bg-primary">Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-md bg-secondary border-border">
          <DialogHeader>
            <DialogTitle>Approve {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Initial Price ($)</Label>
              <Input value={form.initialPrice} onChange={(e) => setForm({...form, initialPrice: e.target.value})} />
            </div>
            <div>
              <Label>Total Supply (Shares)</Label>
              <Input value={form.totalSupply} onChange={(e) => setForm({...form, totalSupply: e.target.value})} />
            </div>
            <div>
              <Label>Creator Split (%)</Label>
              <Input value={form.creatorPercentage} onChange={(e) => setForm({...form, creatorPercentage: e.target.value})} />
            </div>
            <div className="flex space-x-2">
              <Button onClick={submitApprove} className="flex-1 bg-gradient-primary">Submit</Button>
              <Button variant="outline" onClick={close} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Approvals;
