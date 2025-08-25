import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StockCard } from '@/components/StockCard';
import mbappeStock from '@/assets/mbappe-stock.jpg';
import haterStock from '@/assets/hater-stock.jpg';
import elonStock from '@/assets/elon-stock.jpg';
import aiStock from '@/assets/ai-stock.jpg';

// Mock data for trending stocks
const trendingStocks = [
  {
    id: '1',
    name: 'Kylian Mbappé',
    image: mbappeStock,
    price: 142.50,
    change: 5.20,
    changePercent: 3.79,
    data: [135, 138, 140, 139, 141, 143, 142.5, 145, 144, 142.5]
  },
  {
    id: '2', 
    name: 'Being a Hater',
    image: haterStock,
    price: 89.30,
    change: -2.10,
    changePercent: -2.30,
    data: [92, 91, 90, 89.5, 88, 89, 90.5, 89.8, 89.3, 89.3]
  },
  {
    id: '3',
    name: 'Elon Musk',
    image: elonStock,
    price: 256.75,
    change: 12.45,
    changePercent: 5.10,
    data: [240, 245, 250, 248, 252, 255, 258, 260, 257, 256.75]
  },
  {
    id: '4',
    name: 'Artificial Intelligence',
    image: aiStock,
    price: 189.20,
    change: 8.90,
    changePercent: 4.93,
    data: [175, 180, 185, 187, 190, 188, 189, 192, 190, 189.2]
  }
];

interface ExploreProps {
  onStockClick: (stock: any) => void;
}

export const Explore = ({ onStockClick }: ExploreProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return trendingStocks;
    
    return trendingStocks.filter(stock =>
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

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
            {filteredStocks.map((stock) => (
              <StockCard 
                key={stock.id} 
                stock={stock} 
                onClick={onStockClick}
              />
            ))}
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