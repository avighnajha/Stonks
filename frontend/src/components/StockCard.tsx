import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StockData {
  id: string;
  name: string;
  image: string;
  price: number;
  change: number;
  changePercent: number;
  data: number[];
}

interface StockCardProps {
  stock: StockData;
  onClick: (stock: StockData) => void;
}

export const StockCard = ({ stock, onClick }: StockCardProps) => {
  const isPositive = stock.change >= 0;
  
  // Simple line chart using SVG
  const generatePath = (data: number[]) => {
    if (data.length === 0) return '';
    
    const width = 120;
    const height = 40;
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

  return (
    <Card 
      className="bg-gradient-card border-border hover:bg-accent cursor-pointer transition-all duration-200 hover:shadow-card group"
      onClick={() => onClick(stock)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <img 
              src={stock.image} 
              alt={stock.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-border"
            />
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {stock.name}
              </h3>
              <p className="text-2xl font-bold">${stock.price.toFixed(2)}</p>
            </div>
          </div>
          
          {/* Mini Chart */}
          <div className="flex flex-col items-end space-y-2">
            <svg width="120" height="40" className="overflow-visible">
              <path
                d={generatePath(stock.data)}
                fill="none"
                stroke={isPositive ? 'hsl(var(--success))' : 'hsl(var(--danger))'}
                strokeWidth="2"
                className="drop-shadow-sm"
              />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className={`flex items-center space-x-1 ${
            isPositive ? 'text-success' : 'text-danger'
          }`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span className="font-medium">
              ${Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)
            </span>
          </div>
          <span className="text-sm text-muted-foreground">24h</span>
        </div>
      </CardContent>
    </Card>
  );
};