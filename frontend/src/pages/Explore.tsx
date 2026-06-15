import { useState, useMemo, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockCard } from '@/components/StockCard';
import mbappeStock from '@/assets/mbappe-stock.jpg';
import haterStock from '@/assets/hater-stock.jpg';
import elonStock from '@/assets/elon-stock.jpg';
import aiStock from '@/assets/ai-stock.jpg';
import axiosInstance from '@/api/axiosInstance';

// fallback mapping for assets without images
const defaultImages: Record<string, string> = {
  'Kylian Mbappé': mbappeStock,
  'Being a Hater': haterStock,
  'Elon Musk': elonStock,
  'Artificial Intelligence': aiStock
};

const trendingStocksFallback = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Kylian Mbappé',
    image: mbappeStock,
    price: 142.5,
    change: 5.2,
    changePercent: 3.79,
    data: [135, 138, 140, 139, 141, 143, 142.5, 145, 144, 142.5]
  }
];

type Asset = {
  id: string;
  name: string;
  image?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  data?: number[];
};

interface ExploreProps {
  onStockClick: (stock: any) => void;
}

export const Explore = ({ onStockClick }: ExploreProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get('/assets/approved');
        const data = res.data?.assets || res.data || [];
        if (!mounted) return;
        const mapped: Asset[] = data.map((a: any) => ({
          id: a.id || a.assetId || String(a.name),
          name: a.name || a.title || 'Unknown',
          image: a.image || defaultImages[a.name] || '',
          price: a.price || a.lastPrice || 0,
          change: a.change || 0,
          changePercent: a.changePercent || 0,
          data: a.history || a.prices || [0]
        }));
        setAssets(mapped.length ? mapped : trendingStocksFallback);
      } catch (err) {
        setAssets(trendingStocksFallback);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
    return () => { mounted = false; };
  }, []);

  const filteredStocks = useMemo(() => {
    const list = assets.length ? assets : trendingStocksFallback;
    if (!searchQuery.trim()) return list;
    return list.filter(stock => stock.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, assets]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Explore Investments
        </h1>
        <p className="text-muted-foreground">
          Discover trending people, ideas, and concepts to invest in
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for people, ideas, concepts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary border-border h-12"
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-background border-border"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Trending Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Trending Now</h2>
          <span className="text-sm text-muted-foreground">
            {filteredStocks.length} results
          </span>
        </div>
        
        {filteredStocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stocks found matching "{searchQuery}"</p>
            <p className="text-sm mt-1">Try searching for something else</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
              filteredStocks.map((stock) => (
                <StockCard 
                  key={stock.id} 
                  stock={stock as any} 
                  onClick={onStockClick}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['People', 'Ideas', 'Concepts', 'Trends', 'Technology', 'Sports', 'Entertainment', 'Politics'].map((category) => (
            <Button 
              key={category}
              variant="outline" 
              className="h-12 bg-secondary border-border hover:bg-accent hover:border-primary"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};