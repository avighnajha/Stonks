import { useState } from 'react';
import { TrendingUp, TrendingDown, Flame, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StockCard } from '@/components/StockCard';
import mbappeStock from '@/assets/mbappe-stock.jpg';
import haterStock from '@/assets/hater-stock.jpg';
import elonStock from '@/assets/elon-stock.jpg';
import aiStock from '@/assets/ai-stock.jpg';

const trendingData = {
  hottest: [
    {
      id: '1',
      name: 'Kylian Mbappé',
      image: mbappeStock,
      price: 142.50,
      change: 5.20,
      changePercent: 3.79,
      data: [135, 138, 140, 139, 141, 143, 142.5, 145, 144, 142.5],
      volume: 15420,
      reason: 'Champions League performance'
    },
    {
      id: '3',
      name: 'Elon Musk',
      image: elonStock,
      price: 256.75,
      change: 12.45,
      changePercent: 5.10,
      data: [240, 245, 250, 248, 252, 255, 258, 260, 257, 256.75],
      volume: 28930,
      reason: 'SpaceX launch success'
    },
    {
      id: '4',
      name: 'Artificial Intelligence',
      image: aiStock,
      price: 189.20,
      change: 8.90,
      changePercent: 4.93,
      data: [175, 180, 185, 187, 190, 188, 189, 192, 190, 189.2],
      volume: 45670,
      reason: 'New AI breakthrough announced'
    }
  ],
  declining: [
    {
      id: '2', 
      name: 'Being a Hater',
      image: haterStock,
      price: 89.30,
      change: -2.10,
      changePercent: -2.30,
      data: [92, 91, 90, 89.5, 88, 89, 90.5, 89.8, 89.3, 89.3],
      volume: 8920,
      reason: 'Positive sentiment shift'
    }
  ]
};

interface TrendingProps {
  onStockClick: (stock: any) => void;
}

export const Trending = ({ onStockClick }: TrendingProps) => {
  const [selectedTab, setSelectedTab] = useState<'hot' | 'declining'>('hot');

  const currentData = selectedTab === 'hot' ? trendingData.hottest : trendingData.declining;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Trending Now
        </h1>
        <p className="text-muted-foreground">
          Most active investments and market movers
        </p>
      </div>

      {/* Market Pulse */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Flame className="h-5 w-5 text-primary" />
            <span>Market Pulse</span>
          </CardTitle>
          <CardDescription>Real-time market activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">127</p>
              <p className="text-sm text-muted-foreground">Active Traders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">$1.2M</p>
              <p className="text-sm text-muted-foreground">24h Volume</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">+5.6%</p>
              <p className="text-sm text-muted-foreground">Market Avg</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">342</p>
              <p className="text-sm text-muted-foreground">Total Assets</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Selection */}
      <div className="flex space-x-2">
        <Button
          variant={selectedTab === 'hot' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('hot')}
          className={selectedTab === 'hot' 
            ? "bg-gradient-success text-success-foreground" 
            : "bg-background border-border hover:bg-accent"
          }
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Hot Stocks ({trendingData.hottest.length})
        </Button>
        <Button
          variant={selectedTab === 'declining' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('declining')}
          className={selectedTab === 'declining' 
            ? "bg-gradient-danger text-danger-foreground" 
            : "bg-background border-border hover:bg-accent"
          }
        >
          <TrendingDown className="h-4 w-4 mr-2" />
          Declining ({trendingData.declining.length})
        </Button>
      </div>

      {/* Trending Stocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            {selectedTab === 'hot' ? (
              <>
                <Flame className="h-5 w-5 text-success" />
                <span>Hottest Investments</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5 text-danger" />
                <span>Declining Investments</span>
              </>
            )}
          </h2>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Updated 2 min ago</span>
          </div>
        </div>
        
        <div className="space-y-4">
          {currentData.map((stock, index) => (
            <Card key={stock.id} className="bg-gradient-card border-border hover:bg-accent cursor-pointer transition-all duration-200 hover:shadow-card group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                      <img 
                        src={stock.image} 
                        alt={stock.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-border"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {stock.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{stock.reason}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xl font-bold">${stock.price.toFixed(2)}</span>
                        <div className={`flex items-center space-x-1 ${
                          stock.change >= 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {stock.change >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          <span className="font-medium">
                            {stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Volume: {stock.volume.toLocaleString()}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => onStockClick(stock)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Market News */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Market News</CardTitle>
          <CardDescription>Latest updates affecting the market</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-background rounded-lg border border-border">
              <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Mbappé signs new endorsement deal</p>
                <p className="text-sm text-muted-foreground">Major brand partnership announced, driving investor confidence</p>
                <span className="text-xs text-muted-foreground">2 hours ago</span>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-background rounded-lg border border-border">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <div>
                <p className="font-medium">AI sector sees massive growth</p>
                <p className="text-sm text-muted-foreground">New breakthroughs in machine learning attract billions in investment</p>
                <span className="text-xs text-muted-foreground">4 hours ago</span>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-background rounded-lg border border-border">
              <div className="w-2 h-2 bg-danger rounded-full mt-2"></div>
              <div>
                <p className="font-medium">Social sentiment shifts positive</p>
                <p className="text-sm text-muted-foreground">Negative concepts see decline as market optimism grows</p>
                <span className="text-xs text-muted-foreground">6 hours ago</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};