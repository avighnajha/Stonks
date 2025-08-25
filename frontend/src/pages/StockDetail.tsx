import { useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface StockDetailProps {
  stock: any;
  onBack: () => void;
}

export const StockDetail = ({ stock, onBack }: StockDetailProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const { toast } = useToast();

  const timeframes = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
  const isPositive = stock?.change >= 0;
  
  // Mock extended data for different timeframes
  const mockData = {
    '1D': stock?.data || [],
    '1W': [120, 125, 130, 128, 135, 140, 138, 142, 139, 141, 143, 142.5, 145, 144, 142.5],
    '1M': [100, 110, 120, 115, 125, 135, 130, 140, 138, 142.5],
    '3M': [80, 90, 100, 110, 120, 130, 125, 140, 142.5],
    '1Y': [60, 80, 100, 120, 140, 142.5],
    'ALL': [40, 60, 80, 100, 120, 140, 142.5]
  };

  const currentData = mockData[selectedTimeframe as keyof typeof mockData];

  const generatePath = (data: number[]) => {
    if (data.length === 0) return '';
    
    const width = 300;
    const height = 200;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  const handleTrade = () => {
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: `${tradeType === 'buy' ? 'Bought' : 'Sold'}!`,
      description: `${tradeType === 'buy' ? 'Purchased' : 'Sold'} $${amount} of ${stock.name}`,
    });
    
    setTradeAmount('');
  };

  if (!stock) return null;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onBack}
          className="bg-secondary border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center space-x-3">
          <img 
            src={stock.image} 
            alt={stock.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-border"
          />
          <div>
            <h1 className="text-2xl font-bold">{stock.name}</h1>
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-bold">${stock.price.toFixed(2)}</span>
              <div className={`flex items-center space-x-1 ${
                isPositive ? 'text-success' : 'text-danger'
              }`}>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {isPositive ? '+' : ''}${stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Price Chart</CardTitle>
            <div className="flex space-x-1">
              {timeframes.map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={selectedTimeframe === timeframe ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={selectedTimeframe === timeframe 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background border-border hover:bg-accent"
                  }
                >
                  {timeframe}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full flex justify-center">
            <svg width="300" height="200" className="overflow-visible">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--danger))'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={isPositive ? 'hsl(var(--success))' : 'hsl(var(--danger))'} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={generatePath(currentData)}
                fill="none"
                stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--danger))'}
                strokeWidth="3"
                className="drop-shadow-sm"
              />
              <path
                d={`${generatePath(currentData)} L 300,200 L 0,200 Z`}
                fill="url(#chartGradient)"
              />
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>About {stock.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            {stock.name === 'Kylian Mbappé' && 
              "French professional footballer who plays as a forward. Known for his dribbling abilities, exceptional pace, and finishing, Mbappé is considered one of the best players in the world. Investment in Mbappé represents betting on his continued success, marketability, and global influence in sports and entertainment."
            }
            {stock.name === 'Being a Hater' && 
              "An abstract concept representing the cultural phenomenon of negativity and criticism. This investment tracks the social and economic impact of 'hater culture' across social media platforms, entertainment, and public discourse. High volatility expected due to trending topics and viral moments."
            }
            {stock.name === 'Elon Musk' && 
              "Entrepreneur and business magnate known for founding and leading companies like Tesla, SpaceX, and X (formerly Twitter). Investment in Musk tracks his influence on technology markets, social media trends, and innovation sectors including electric vehicles, space exploration, and artificial intelligence."
            }
            {stock.name === 'Artificial Intelligence' && 
              "The broad concept of machine learning and AI technology development. This investment represents the collective growth and adoption of AI across industries including healthcare, finance, entertainment, and automation. Closely tied to major tech companies and breakthrough developments."
            }
          </p>
          
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Investors</p>
                <p className="font-semibold">2,847</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Market Cap</p>
                <p className="font-semibold">$12.4M</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Section */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Trade {stock.name}</CardTitle>
          <CardDescription>Buy or sell shares in this investment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Button
              variant={tradeType === 'buy' ? 'default' : 'outline'}
              onClick={() => setTradeType('buy')}
              className={tradeType === 'buy' 
                ? "flex-1 bg-success hover:bg-success/90 text-success-foreground" 
                : "flex-1 bg-background border-border hover:bg-accent"
              }
            >
              Buy
            </Button>
            <Button
              variant={tradeType === 'sell' ? 'default' : 'outline'}
              onClick={() => setTradeType('sell')}
              className={tradeType === 'sell' 
                ? "flex-1 bg-danger hover:bg-danger/90 text-danger-foreground" 
                : "flex-1 bg-background border-border hover:bg-accent"
              }
            >
              Sell
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              placeholder="Enter amount to invest"
              className="bg-background border-border"
            />
          </div>
          
          <Button 
            onClick={handleTrade} 
            className={`w-full ${
              tradeType === 'buy' 
                ? 'bg-gradient-success hover:opacity-90' 
                : 'bg-gradient-danger hover:opacity-90'
            } text-white`}
            disabled={!tradeAmount}
          >
            {tradeType === 'buy' ? 'Buy' : 'Sell'} {stock.name}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};