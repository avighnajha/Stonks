import { useState, useMemo, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StockCard } from "@/components/StockCard";
import { NewsTicker } from "@/components/NewsTicker";
import mbappeStock from "@/assets/mbappe-stock.jpg";
import haterStock from "@/assets/hater-stock.jpg";
import elonStock from "@/assets/elon-stock.jpg";
import aiStock from "@/assets/ai-stock.jpg";
import axiosInstance from "@/api/axiosInstance";

// fallback mapping for assets without images
const defaultImages: Record<string, string> = {
  "Kylian Mbappé": mbappeStock,
  "Being a Hater": haterStock,
  "Elon Musk": elonStock,
  "Artificial Intelligence": aiStock,
};

const emojiFallbacks = [
  "🔥",
  "🌟",
  "🚀",
  "🎯",
  "💎",
  "✨",
  "🧠",
  "🦄",
  "🌈",
  "🎉",
  "😎",
  "👑",
];
const getEmojiFallback = (name: string) => {
  const sum = Array.from(name).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return emojiFallbacks[sum % emojiFallbacks.length];
};

const getAssetImage = (asset: any) => {
  if (asset.image) return asset.image;
  if (asset.imageUrl) return asset.imageUrl;
  if (defaultImages[asset.name]) return defaultImages[asset.name];
  return "";
};

const getAssetEmoji = (asset: any) => {
  if (asset.image || asset.imageUrl || defaultImages[asset.name]) return "";
  return getEmojiFallback(asset.name || "Concept");
};

type Asset = {
  id: string;
  name: string;
  image?: string;
  fallbackEmoji: string;
  price?: number;
  change?: number;
  changePercent?: number;
  data?: number[];
  initialPrice?: number;
  totalSupply?: number;
  description?: string;
};

interface ExploreProps {
  onStockClick: (stock: any) => void;
}

export const Explore = ({ onStockClick }: ExploreProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/trade/markets");
        const data = res.data?.assets || res.data || [];
        if (!mounted) return;
        const mapped: Asset[] = data.map((a: any) => {
          const price = Number(a.price ?? a.initial_price ?? a.lastPrice ?? 0);
          const values = a.history || a.prices || (price ? [price] : [0]);
          return {
            id: a.id || a.assetId || String(a.name),
            name: a.name || a.title || "Unknown",
            image: getAssetImage(a),
            fallbackEmoji:
              getAssetEmoji(a) || getEmojiFallback(a.name || "Concept"),
            price,
            change: Number(a.change ?? 0),
            changePercent: Number(a.changePercent ?? 0),
            data: values,
            initialPrice: Number(a.initial_price ?? 0),
            totalSupply: Number(a.total_supply ?? 0),
            description: a.description || "",
          };
        });
        setAssets(mapped);
        setError("");
      } catch (err) {
        if (mounted)
          setError("Market data unavailable. Displayed prices may be stale.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
    const timer = setInterval(fetchAssets, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const filteredStocks = useMemo(() => {
    const list = assets;
    if (!searchQuery.trim()) return list;
    return list.filter((stock) =>
      stock.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
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

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
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
              <div className="text-center py-12 text-muted-foreground">
                Loading...
              </div>
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

      {/* Breaking News */}
      <NewsTicker />

      {/* Categories */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            "People",
            "Ideas",
            "Concepts",
            "Trends",
            "Technology",
            "Sports",
            "Entertainment",
            "Politics",
          ].map((category) => (
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
