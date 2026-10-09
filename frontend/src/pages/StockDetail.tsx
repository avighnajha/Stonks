import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MyOrders } from "@/components/MyOrders";
import { OrderBook } from "@/components/OrderBook";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import useSocket from "@/hooks/useSocket";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import tradingApi from "@/api/trading.api";
import axiosInstance from "@/api/axiosInstance";

interface StockDetailProps {
  stock: any;
  onBack: () => void;
}

export const StockDetail = ({ stock, onBack }: StockDetailProps) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [orderKind, setOrderKind] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState("");
  const [currentData, setCurrentData] = useState<
    { time: number; price: number }[]
  >([]);

  const timeframes = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
  const [currentPrice, setCurrentPrice] = useState<number>(
    stock?.price ?? stock?.initialPrice ?? 0,
  );
  const [currentChange, setCurrentChange] = useState<number>(
    stock?.change ?? 0,
  );
  const [currentChangePercent, setCurrentChangePercent] = useState<number>(
    stock?.changePercent ?? 0,
  );
  const isPositive = currentChange >= 0;
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = (payload: any) => {
      if (!payload) return;
      if (payload.assetId !== stock.id) return;
      const newPrice = Number(payload.price);
      const oldPrice = (stock.price || 0) - (stock.change || 0);
      const change = newPrice - oldPrice;
      const changePercent = oldPrice ? (change / oldPrice) * 100 : 0;
      setCurrentPrice(newPrice);
      setCurrentChange(change);
      setCurrentChangePercent(changePercent);
    };

    socket.on("newTrade", handler);
    return () => {
      socket.off("newTrade", handler);
    };
  }, [socket, stock.id, stock.price, stock.change]);

  useEffect(() => {
    // whenever stock changes, reset current price to the provided value
    setCurrentPrice(stock?.price ?? stock?.initialPrice ?? 0);
    setCurrentChange(stock?.change ?? 0);
    setCurrentChangePercent(stock?.changePercent ?? 0);
  }, [stock]);

  const marketCap = currentPrice * (stock?.totalSupply ?? 0);
  const formattedMarketCap =
    marketCap > 0
      ? `$${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "N/A";

  useEffect(() => {
    let active = true;
    const settings: Record<string, [number, string]> = {
      "1D": [1, "5m"],
      "1W": [7, "1h"],
      "1M": [30, "1d"],
      "3M": [90, "1d"],
      "1Y": [365, "1d"],
      ALL: [3650, "1d"],
    };
    const [days, timeframe] = settings[selectedTimeframe];
    setChartLoading(true);
    setCurrentData([]);
    setChartError("");
    const load = async () => {
      try {
        const { data } = await axiosInstance.get(`/trade/history/${stock.id}`, {
          params: { days, timeframe },
        });
        if (active) {
          setCurrentData(
            data
              .map((p: any) => ({
                time: new Date(p.bucket ?? p.timestamp ?? p.time).getTime(),
                price: Number(p.close ?? p.price),
              }))
              .filter(
                (p: { time: number; price: number }) =>
                  Number.isFinite(p.time) && Number.isFinite(p.price),
              ),
          );
          setChartError("");
        }
      } catch {
        if (active) setChartError("Price history unavailable");
      } finally {
        if (active) setChartLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [stock.id, selectedTimeframe]);
  const handleTrade = () => {
    if (sending.current || !user) return;
    (async () => {
      const amount = parseFloat(tradeAmount);
      if (!amount || amount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid amount",
          variant: "destructive",
        });
        return;
      }

      sending.current = true;
      setSubmitting(true);
      try {
        const assetAmount = Number(tradeAmount);
        const price = Number(limitPrice || currentPrice);
        const payload = { assetAmount, price, type: orderKind };

        const response =
          tradeType === "buy"
            ? await tradingApi.buyAsset(stock.id, payload as any)
            : await tradingApi.sellAsset(stock.id, payload as any);

        // Refresh portfolio and wallet, then notify listeners
        try {
          await axiosInstance.get("/portfolio");
        } catch (e) {
          // ignore
        }

        try {
          const w = await axiosInstance.get("/wallet/balance");
          const wallet = w.data;
          const currentUserRaw = localStorage.getItem("user");
          if (currentUserRaw) {
            const currentUser = JSON.parse(currentUserRaw);
            currentUser.balance = wallet?.balance ?? currentUser.balance;
            localStorage.setItem("user", JSON.stringify(currentUser));
          }
        } catch (e) {
          // ignore
        }

        // Emit event so Portfolio can refresh if open
        window.dispatchEvent(new CustomEvent("portfolio:updated"));

        const wasPlaced =
          response.status === "OPEN" || response.status === "PARTIALLY_FILLED";
        const filled = Number(response.filledQuantity ?? 0);
        const verb = tradeType === "buy" ? "Purchase" : "Sale";

        if (wasPlaced && filled === 0) {
          toast({
            title: "Order placed",
            description: `${verb} order for ${amount} ${stock.name} has been placed on the book.`,
          });
        } else if (wasPlaced && filled > 0) {
          const remaining = assetAmount - filled;
          toast({
            title: "Order partially filled",
            description: `${verb} ${filled} ${stock.name} and placed ${remaining} on the order book.`,
          });
        } else if (response.status === "CANCELLED") {
          toast({
            title: "Market order complete",
            description: `Filled ${filled}; unused quantity cancelled.`,
          });
        } else {
          toast({
            title: `${tradeType === "buy" ? "Bought" : "Sold"}!`,
            description: `${tradeType === "buy" ? "Purchased" : "Sold"} ${amount} of ${stock.name}.`,
          });
        }

        setTradeAmount("");
      } catch (err: any) {
        toast({
          title: "Trade failed",
          description: err?.message || "Please try again",
          variant: "destructive",
        });
      } finally {
        sending.current = false;
        setSubmitting(false);
      }
    })();
  };

  const isUuid = (id: any) => {
    if (!id || typeof id !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    );
  };

  if (!stock) return null;

  return (
    <div className="workspace">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          aria-label="Back to market"
          className="bg-secondary border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center space-x-3">
          <div
            aria-hidden
            className="hidden sm:flex w-12 h-12 items-center justify-center rounded border bg-card font-mono"
          >
            {stock.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{stock.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-medium font-mono">
                ${currentPrice.toFixed(2)}
              </span>
              <div
                className={`flex items-center space-x-1 ${
                  isPositive ? "text-success" : "text-danger"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {isPositive ? "+" : ""}${currentChange.toFixed(2)} (
                  {currentChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="min-w-0 space-y-4">
          {/* Chart */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <CardTitle>Price Chart</CardTitle>
                <div className="flex space-x-1">
                  {timeframes.map((timeframe) => (
                    <Button
                      key={timeframe}
                      variant={
                        selectedTimeframe === timeframe ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedTimeframe(timeframe)}
                      className={
                        selectedTimeframe === timeframe
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
              <div className="h-72 md:h-80 w-full min-w-0">
                {currentData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={currentData}
                      margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) =>
                          selectedTimeframe === "1D"
                            ? new Date(v).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : new Date(v).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                        }
                        tick={{ fill: "#99999f", fontSize: 11 }}
                        minTickGap={50}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        width={65}
                        tick={{ fill: "#99999f", fontSize: 11 }}
                        tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                      />
                      <Tooltip
                        labelFormatter={(v) =>
                          new Date(Number(v)).toLocaleString()
                        }
                        formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                        contentStyle={{
                          background: "#19191c",
                          border: "1px solid #303034",
                          borderRadius: 4,
                        }}
                      />
                      <Line
                        type="linear"
                        dataKey="price"
                        stroke={
                          isPositive
                            ? "hsl(var(--success))"
                            : "hsl(var(--danger))"
                        }
                        strokeWidth={1.5}
                        dot={currentData.length === 1}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    {chartLoading
                      ? "Loading price history�"
                      : chartError || "No trades in this period."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {chartError && <p role="alert">{chartError}</p>}
          <OrderBook assetId={stock.id} />

          <div className="terminal-panel p-5">
            <p className="eyebrow mb-2">About this asset</p>
            <p className="text-sm text-muted-foreground">
              {stock.description ||
                "An approved asset on the shared simulated exchange."}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Marked capitalization: {formattedMarketCap}
            </p>
          </div>
        </div>
        {/* Trading Section */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Trade {stock.name}</CardTitle>
            <CardDescription>
              Buy or sell shares in this investment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button
                variant={tradeType === "buy" ? "default" : "outline"}
                onClick={() => setTradeType("buy")}
                className={
                  tradeType === "buy"
                    ? "flex-1 bg-primary text-primary-foreground"
                    : "flex-1 bg-background border-border hover:bg-accent"
                }
              >
                Buy
              </Button>
              <Button
                variant={tradeType === "sell" ? "default" : "outline"}
                onClick={() => setTradeType("sell")}
                className={
                  tradeType === "sell"
                    ? "flex-1 bg-primary text-primary-foreground"
                    : "flex-1 bg-background border-border hover:bg-accent"
                }
              >
                Sell
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Quantity (Shares)</Label>
              <Input
                id="amount"
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                placeholder="Enter number of shares"
                className="bg-background border-border"
              />
            </div>

            <div className="flex space-x-2">
              <Button
                variant={orderKind === "MARKET" ? "default" : "outline"}
                onClick={() => setOrderKind("MARKET")}
                className={
                  orderKind === "MARKET"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }
              >
                Market
              </Button>
              <Button
                variant={orderKind === "LIMIT" ? "default" : "outline"}
                onClick={() => setOrderKind("LIMIT")}
                className={
                  orderKind === "LIMIT"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }
              >
                Limit
              </Button>
            </div>

            {
              <div className="space-y-2">
                <Label htmlFor="limitPrice">
                  {orderKind === "LIMIT"
                    ? "Limit price"
                    : tradeType === "buy"
                      ? "Maximum buy price"
                      : "Minimum sell price"}{" "}
                  ($)
                </Label>
                <Input
                  id="limitPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={String(currentPrice)}
                  className="bg-background border-border"
                />
              </div>
            }

            <Button
              onClick={handleTrade}
              className="w-full"
              disabled={
                !tradeAmount ||
                submitting ||
                !user ||
                !isUuid(stock.id) ||
                (orderKind === "LIMIT" && !limitPrice)
              }
            >
              {tradeType === "buy" ? "Buy" : "Sell"} {stock.name}
            </Button>
            {!user && <p className="text-sm">Sign in to trade.</p>}
            {orderKind === "MARKET" && (
              <p className="text-sm text-muted-foreground">
                Fills immediately within your price protection. Any remainder is
                cancelled.
              </p>
            )}
            {!isUuid(stock.id) && (
              <p className="text-sm text-muted-foreground mt-2">
                Trading disabled for this item (invalid asset id)
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <MyOrders assetId={stock.id} />
    </div>
  );
};
