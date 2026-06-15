import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import axiosInstance from '@/api/axiosInstance';

type Position = {
  id: string;
  name: string;
  image?: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
};

type PortfolioData = {
  totalValue: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  availableBalance: number;
  positions: Position[];
};

const emptyPortfolio: PortfolioData = {
  totalValue: 0,
  totalInvested: 0,
  totalGainLoss: 0,
  totalGainLossPercent: 0,
  availableBalance: 0,
  positions: []
};

export const Portfolio = () => {
  const { user } = useAuth();
  const [portfolioData, setPortfolioData] = useState<PortfolioData>(emptyPortfolio);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchPortfolio = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/portfolio`);
        const data = res.data || {};
        if (!mounted) return;
        // map data defensively
        const mapped: PortfolioData = {
          totalValue: data.totalValue ?? 0,
          totalInvested: data.totalInvested ?? 0,
          totalGainLoss: data.totalGainLoss ?? 0,
          totalGainLossPercent: data.totalGainLossPercent ?? 0,
          availableBalance: data.availableBalance ?? data.cash ?? 0,
          positions: (data.positions || []).map((p: any) => ({
            id: p.id || p.assetId,
            name: p.name || p.assetName,
            image: p.image || '',
            shares: p.shares ?? p.quantity ?? 0,
            avgPrice: p.avgPrice ?? p.costBasis ?? 0,
            currentPrice: p.currentPrice ?? p.price ?? 0,
            invested: p.invested ?? 0,
            currentValue: p.currentValue ?? ((p.currentPrice ?? p.price ?? 0) * (p.shares ?? p.quantity ?? 0)),
            gainLoss: p.gainLoss ?? 0,
            gainLossPercent: p.gainLossPercent ?? 0
          }))
        };
        setPortfolioData(mapped);
      } catch (err) {
        // keep empty
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
    const onUpdated = () => { fetchPortfolio(); };
    window.addEventListener('portfolio:updated', onUpdated);
    return () => { mounted = false; };
  }, [user]);

  const isPositiveTotal = portfolioData.totalGainLoss >= 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Portfolio
        </h1>
        <p className="text-muted-foreground">
          Track your investment performance and holdings
        </p>
      </div>

      {/* Portfolio Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span>Total Value</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</p>
              <div className={`flex items-center space-x-1 text-sm ${
                isPositiveTotal ? 'text-success' : 'text-danger'
              }`}>
                {isPositiveTotal ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>
                  {isPositiveTotal ? '+' : ''}${portfolioData.totalGainLoss.toLocaleString()} 
                  ({portfolioData.totalGainLossPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>Total Invested</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">${portfolioData.totalInvested.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Across {portfolioData.positions.length} positions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <PieChart className="h-4 w-4 text-primary" />
              <span>Available Cash</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">${portfolioData.availableBalance.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Ready to invest</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>Your portfolio performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full flex justify-center">
            <svg width="320" height="160" className="overflow-visible">
              <defs>
                <linearGradient id="portfolioGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0,120 L 40,110 L 80,100 L 120,90 L 160,80 L 200,70 L 240,60 L 280,50 L 320,40"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                className="drop-shadow-sm"
              />
              <path
                d="M 0,120 L 40,110 L 80,100 L 120,90 L 160,80 L 200,70 L 240,60 L 280,50 L 320,40 L 320,160 L 0,160 Z"
                fill="url(#portfolioGradient)"
              />
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Holdings */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Your Holdings</CardTitle>
          <CardDescription>Individual positions in your portfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {portfolioData.positions.map((position) => {
            const isPositive = position.gainLoss >= 0;
            
            return (
              <div 
                key={position.id} 
                className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <img 
                    src={position.image} 
                    alt={position.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-border"
                  />
                  <div>
                    <h3 className="font-semibold">{position.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {position.shares} shares @ ${position.avgPrice.toFixed(2)} avg
                    </p>
                  </div>
                </div>
                
                <div className="text-right space-y-1">
                  <p className="font-semibold">${position.currentValue.toLocaleString()}</p>
                  <div className={`flex items-center justify-end space-x-1 text-sm ${
                    isPositive ? 'text-success' : 'text-danger'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}${Math.abs(position.gainLoss).toFixed(2)} 
                      ({position.gainLossPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};