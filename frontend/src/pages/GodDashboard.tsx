import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useSocket from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { getAdminLeaderboard, getAdminMarketStats, getAdminOrderBook, getAdminAllTrades, getAdminPriceHistory, getApprovedAssets } from '@/api/admin.api';
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

const formatMoney = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const GodDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tradeLog, setTradeLog] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [visibleAssets, setVisibleAssets] = useState<Set<string>>(new Set());

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<any, Error>({
    queryKey: ['admin-market-stats'],
    queryFn: getAdminMarketStats,
  });

  const { data: leaderboard, isLoading: leaderboardLoading, error: leaderboardError } = useQuery<any[], Error>({
    queryKey: ['admin-leaderboard'],
    queryFn: getAdminLeaderboard,
  });

  // Get top 5 assets by volume
  const topAssets = useMemo(() => {
    if (!stats?.topAssetsByVolume) return [];
    return stats.topAssetsByVolume.slice(0, 5);
  }, [stats]);

  // Initialize visible assets when top assets change
  useEffect(() => {
    if (topAssets.length > 0 && visibleAssets.size === 0) {
      setVisibleAssets(new Set(topAssets.map((a: any) => a.assetId)));
    }
  }, [topAssets, visibleAssets.size]);

  // Fetch historical data for top assets
  const { data: priceHistories } = useQuery({
    queryKey: ['price-histories', topAssets.map((a: any) => a.assetId), timeframe],
    queryFn: async () => {
      if (topAssets.length === 0) return {};
      const promises = topAssets.map((asset: any) =>
        getAdminPriceHistory(asset.assetId, timeframe)
      );
      const results = await Promise.all(promises);
      const historyMap: Record<string, any[]> = {};
      topAssets.forEach((asset: any, index: number) => {
        historyMap[asset.assetId] = results[index] || [];
      });
      return historyMap;
    },
    enabled: topAssets.length > 0,
  });

  // Fetch all approved assets for order book selector
  const { data: approvedAssets } = useQuery({
    queryKey: ['approved-assets'],
    queryFn: getApprovedAssets,
  });

  const { data: orderBook, refetch: refetchOrderBook } = useQuery<any, Error>({
    queryKey: ['admin-order-book', selectedAsset],
    queryFn: () => (selectedAsset ? getAdminOrderBook(selectedAsset) : Promise.resolve({ buys: [], sells: [] })),
    enabled: !!selectedAsset,
  });

  const { data: allTrades, refetch: refetchAllTrades } = useQuery<any[], Error>({
    queryKey: ['admin-all-trades'],
    queryFn: getAdminAllTrades,
    enabled: false,
  });

  // Log errors
  if (statsError) console.error('Stats error:', statsError);
  if (leaderboardError) console.error('Leaderboard error:', leaderboardError);

  const statusText = useMemo(() => {
    if (!user) return 'Disconnected';
    if (user.role === 'admin') return 'Connected as ADMIN';
    return 'Connected';
  }, [user]);

  const topAssetId = useMemo(() => selectedAsset || stats?.topAssetsByVolume?.[0]?.assetId || null, [selectedAsset, stats]);

  useEffect(() => {
    if (!selectedAsset && topAssetId) {
      setSelectedAsset(topAssetId);
    }
  }, [topAssetId, selectedAsset]);

  useEffect(() => {
    if (selectedAsset) {
      refetchOrderBook();
    }
  }, [selectedAsset, refetchOrderBook]);

  useEffect(() => {
    if (!socket) return;

    const orderBookHandler = (payload: any) => {
      if (payload.assetId !== selectedAsset) return;
      if (payload.book) {
        refetchOrderBook();
      }
    };

    const tradeHandler = (payload: any) => {
      const timestamp = new Date().toLocaleTimeString();
      // Find asset name from approved assets
      const asset = approvedAssets?.find((a: any) => a.id === payload.assetId);
      const assetName = asset?.name || payload.assetId || 'Unknown';
      const text = `[${timestamp}] ${payload.side ?? 'TRADE'} EXECUTED: ${payload.quantity} ${assetName} @ ${payload.price}`;
      setTradeLog((prev) => [text, ...prev].slice(0, 30));
    };

    socket.on('order_book_update', orderBookHandler);
    socket.on('newTrade', tradeHandler);

    return () => {
      socket.off('order_book_update', orderBookHandler);
      socket.off('newTrade', tradeHandler);
    };
  }, [socket, selectedAsset, refetchOrderBook, approvedAssets]);

  const totalCash = useMemo(() => {
    if (!Array.isArray(leaderboard)) return 0;
    return leaderboard.reduce((sum: number, user: any) => sum + (Number(user.cash) || 0), 0);
  }, [leaderboard]);

  const marketIndexData = useMemo(() => {
    if (!priceHistories || Object.keys(priceHistories).length === 0) {
      return [];
    }

    // Get all unique timestamps across all assets
    const allTimestamps = new Set<string>();
    Object.values(priceHistories).forEach((history: any[]) => {
      history.forEach((point: any) => {
        allTimestamps.add(new Date(point.timestamp).toISOString());
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Build chart data with each asset as a separate line
    return sortedTimestamps.map((timestamp) => {
      const dataPoint: any = { timestamp: new Date(timestamp).toLocaleTimeString() };
      topAssets.forEach((asset: any) => {
        const history = priceHistories[asset.assetId] || [];
        const point = history.find((p: any) => new Date(p.timestamp).toISOString() === timestamp);
        dataPoint[asset.assetId] = point ? point.close : null;
      });
      return dataPoint;
    });
  }, [priceHistories, topAssets]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const selectedAgentTrades = useMemo(() => {
    if (!selectedAgent || !Array.isArray(allTrades)) return [];
    return allTrades
      .filter((trade) => trade.buyer_id === selectedAgent.userId || trade.seller_id === selectedAgent.userId)
      .slice(0, 10);
  }, [selectedAgent, allTrades]);

  useEffect(() => {
    if (selectedAgent) {
      refetchAllTrades();
    }
  }, [selectedAgent, refetchAllTrades]);

  const activeAgents = Array.isArray(leaderboard) ? leaderboard.length : 0;
  const mostVolatile = stats?.topGainers?.[0]?.assetId || stats?.topLosers?.[0]?.assetId || 'N/A';

  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      {error && (
        <div className="container mx-auto px-4 mb-4">
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
            Error: {error}
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 space-y-6">
        <div className="rounded-3xl border border-border bg-secondary p-6 shadow-sm shadow-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="hover:bg-accent">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Mission Control</p>
                <h1 className="mt-2 text-4xl font-semibold">God Mode Dashboard</h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                  Monitor trader performance, order book health, and live execution events across the exchange.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground">
                <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />
                {statusText}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="border-border hover:bg-accent">Pause Simulation</Button>
                <Button className="bg-destructive text-white hover:bg-destructive/90">Flush Order Book</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>24H Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{statsLoading ? '...' : formatMoney(stats?.volume24h || 0)}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>Total System Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{leaderboardLoading ? '...' : formatMoney(totalCash)}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{leaderboardLoading ? '...' : activeAgents}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>Most Volatile Asset</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{statsLoading ? '...' : mostVolatile}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[60%_40%]">
          <div className="space-y-4">
            <Card className="bg-secondary border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Top Assets Price History</CardTitle>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5m">5m</SelectItem>
                      <SelectItem value="15m">15m</SelectItem>
                      <SelectItem value="1h">1h</SelectItem>
                      <SelectItem value="4h">4h</SelectItem>
                      <SelectItem value="1d">1d</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={marketIndexData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="timestamp" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                    {topAssets.map((asset: any, index: number) => (
                      visibleAssets.has(asset.assetId) && (
                        <Line
                          key={asset.assetId}
                          type="monotone"
                          dataKey={asset.assetId}
                          stroke={colors[index % colors.length]}
                          strokeWidth={2}
                          dot={false}
                          name={asset.assetId.substring(0, 8)}
                        />
                      )
                    ))}
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      onClick={(e: any) => {
                        const assetId = String(e.dataKey);
                        const newVisible = new Set(visibleAssets);
                        if (newVisible.has(assetId)) {
                          newVisible.delete(assetId);
                        } else {
                          newVisible.add(assetId);
                        }
                        setVisibleAssets(newVisible);
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-secondary border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Live Order Book</CardTitle>
                  <Select value={selectedAsset || ''} onValueChange={setSelectedAsset}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {(approvedAssets || []).map((asset: any) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name || asset.id.substring(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedAsset ? (
                  <p className="text-muted-foreground text-center py-8">Select an asset to view its order book</p>
                ) : (
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="flex-1 rounded-3xl border border-emerald-500/30 p-3">
                      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-emerald-400">
                        <span>Buy Wall</span>
                        <span>Top {orderBook?.buys?.length || 0}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {(orderBook?.buys || []).map((row: any) => (
                          <div key={row.id} className="flex justify-between rounded-2xl bg-emerald-500/5 px-3 py-2">
                            <span>{Number(row.remaining_quantity).toFixed(2)} @</span>
                            <span>{formatMoney(Number(row.price))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 rounded-3xl border border-rose-500/30 p-3">
                      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-rose-400">
                        <span>Sell Wall</span>
                        <span>Top {orderBook?.sells?.length || 0}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {(orderBook?.sells || []).map((row: any) => (
                          <div key={row.id} className="flex justify-between rounded-2xl bg-rose-500/5 px-3 py-2">
                            <span>{Number(row.remaining_quantity).toFixed(2)} @</span>
                            <span>{formatMoney(Number(row.price))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-black border border-white/10 text-white">
            <CardHeader>
              <CardTitle>Live System Terminal</CardTitle>
            </CardHeader>
            <CardContent className="h-[560px] overflow-y-auto rounded-3xl bg-slate-950/90 p-4 font-mono text-sm text-slate-200">
              {tradeLog.length === 0 ? (
                <p className="text-muted-foreground">Waiting for trade execution events...</p>
              ) : (
                <div className="space-y-2">
                  {tradeLog.map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">{line}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>Top Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(stats?.topAssetsByVolume || []).map((asset: any) => (
                  <button
                    key={asset.assetId}
                    type="button"
                    onClick={() => setSelectedAsset(asset.assetId)}
                    className="flex w-full items-center justify-between rounded-3xl border border-border bg-background/80 px-4 py-3 text-left hover:border-primary hover:bg-primary/5"
                  >
                    <div>
                      <div className="font-medium">{asset.assetId}</div>
                      <div className="text-xs text-muted-foreground">Volume: {formatMoney(Number(asset.volume))}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">Select</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary border-border">
            <CardHeader>
              <CardTitle>Agent Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-muted-foreground">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Cash</th>
                      <th className="px-4 py-3">Portfolio</th>
                      <th className="px-4 py-3">Net worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(leaderboard) && leaderboard.map((agent: any, index: number) => (
                      <tr
                        key={agent.userId}
                        className="cursor-pointer border-t border-border hover:bg-primary/5"
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{agent.name}</td>
                        <td className="px-4 py-3">{formatMoney(Number(agent.cash) || 0)}</td>
                        <td className="px-4 py-3">{formatMoney(Number(agent.portfolioValue) || 0)}</td>
                        <td className="px-4 py-3">{formatMoney(Number(agent.netWorth) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedAgent ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-4xl space-y-6 rounded-3xl bg-secondary border border-border p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Agent Profile: {selectedAgent.name}</h2>
                  <p className="text-sm text-muted-foreground">Liquid cash, portfolio exposure, and recent trade activity.</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedAgent(null)}>Close</Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle>Net Worth</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{formatMoney(Number(selectedAgent.netWorth) || 0)}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Liquid Cash: {formatMoney(Number(selectedAgent.cash) || 0)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle>Portfolio Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold">{formatMoney(Number(selectedAgent.portfolioValue) || 0)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle>Latest Trades</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedAgentTrades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent trades found yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedAgentTrades.map((trade: any) => (
                          <div key={trade.id} className="rounded-2xl bg-muted p-3">
                            <div className="flex items-center justify-between text-sm font-medium">
                              <span>{trade.asset_id}</span>
                              <span>{trade.timestamp ? new Date(trade.timestamp).toLocaleString() : 'N/A'}</span>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {trade.buyer_id === selectedAgent.userId ? 'Bought' : 'Sold'} {trade.quantity} @ {formatMoney(Number(trade.price))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle>Holdings Insight</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">This profile is derived from the leaderboard snapshot and recent trade history.</p>
                    <div className="mt-4 rounded-3xl bg-muted p-4 text-sm">
                      <p>Cash: {formatMoney(Number(selectedAgent.cash) || 0)}</p>
                      <p className="mt-2">Portfolio: {formatMoney(Number(selectedAgent.portfolioValue) || 0)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GodDashboard;
