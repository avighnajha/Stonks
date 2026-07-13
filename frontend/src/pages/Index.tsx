import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Explore } from '@/pages/Explore';
import { Portfolio } from '@/pages/Portfolio';
import { Trending } from '@/pages/Trending';
import { StockDetail } from '@/pages/StockDetail';
import Approvals from '@/pages/Approvals';

const Index = () => {
  const [activeTab, setActiveTab] = useState('explore');
  const [selectedStock, setSelectedStock] = useState(null);
  const [viewMode, setViewMode] = useState<'main' | 'stock'>('main');

  const handleStockClick = (stock: any) => {
    setSelectedStock(stock);
    setViewMode('stock');
  };

  const handleBackToMain = () => {
    setViewMode('main');
    setSelectedStock(null);
  };

  const renderContent = () => {
    if (viewMode === 'stock' && selectedStock) {
      return <StockDetail stock={selectedStock} onBack={handleBackToMain} />;
    }

    switch (activeTab) {
      case 'explore':
        return <Explore onStockClick={handleStockClick} />;
      case 'portfolio':
        return <Portfolio />;
      case 'trending':
        return <Trending onStockClick={handleStockClick} />;
      case 'approvals':
        return <Approvals />;
      default:
        return <Explore onStockClick={handleStockClick} />;
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </Layout>
    </div>
  );
};

export default Index;
