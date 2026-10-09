import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense, useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Explore } from "@/pages/Explore";
import { Portfolio } from "@/pages/Portfolio";
const StockDetail = lazy(() =>
  import("@/pages/StockDetail").then((m) => ({ default: m.StockDetail })),
);
import Approvals from "@/pages/Approvals";
const Research = lazy(() =>
  import("@/pages/Research").then((m) => ({ default: m.Research })),
);

const Index = () => {
  const [params, setParams] = useSearchParams();
  const activeTab = params.get("tab") || "research";
  const setActiveTab = (tab: string) => {
    setViewMode("main");
    setSelectedStock(null);
    setParams({ tab });
  };
  const [selectedStock, setSelectedStock] = useState(null);
  const [viewMode, setViewMode] = useState<"main" | "stock">("main");

  useEffect(() => {
    setViewMode("main");
    setSelectedStock(null);
  }, [activeTab]);

  const handleStockClick = (stock: any) => {
    setSelectedStock(stock);
    setViewMode("stock");
  };

  const handleBackToMain = () => {
    setViewMode("main");
    setSelectedStock(null);
  };

  const renderContent = () => {
    if (viewMode === "stock" && selectedStock) {
      return <StockDetail stock={selectedStock} onBack={handleBackToMain} />;
    }

    switch (activeTab) {
      case "research":
        return <Research />;
      case "explore":
        return <Explore onStockClick={handleStockClick} />;
      case "portfolio":
        return <Portfolio />;
      case "trending":
        return <Explore onStockClick={handleStockClick} />;
      case "approvals":
        return (
          <ProtectedRoute requiredRole="admin">
            <Approvals />
          </ProtectedRoute>
        );
      default:
        return <Explore onStockClick={handleStockClick} />;
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        <Suspense
          fallback={
            <p className="workspace text-muted-foreground">
              Loading workspace�
            </p>
          }
        >
          {renderContent()}
        </Suspense>
      </Layout>
    </div>
  );
};

export default Index;
