import { useState, useMemo, useEffect } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewsTicker } from "@/components/NewsTicker";
import axiosInstance from "@/api/axiosInstance";

type Asset = {
  id: string;
  name: string;
  image?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  initialPrice: number;
  totalSupply: number;
  description: string;
};
const money = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const Explore = ({
  onStockClick,
}: {
  onStockClick: (stock: Asset) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("volume");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await axiosInstance.get("/trade/markets");
        if (!active) return;
        setAssets(
          (data?.assets || data || []).map((a: any) => ({
            id: a.id || a.assetId,
            name: a.name,
            image: a.imageUrl || a.image,
            price: Number(a.price ?? a.initial_price ?? 0),
            change: Number(a.change ?? 0),
            changePercent: Number(a.changePercent ?? 0),
            volume: Number(a.volume ?? 0),
            initialPrice: Number(a.initial_price ?? 0),
            totalSupply: Number(a.total_supply ?? 0),
            description: a.description || "",
          })),
        );
        setError("");
        setUpdated(new Date());
      } catch {
        if (active)
          setError("Market data unavailable. Displayed prices may be stale.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const filtered = useMemo(
    () =>
      assets
        .filter((a) =>
          a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "gainers"
              ? b.changePercent - a.changePercent
              : sort === "losers"
                ? a.changePercent - b.changePercent
                : b.volume - a.volume,
        ),
    [assets, searchQuery, sort],
  );
  return (
    <div className="workspace">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Shared exchange / Real time</p>
          <h1 className="text-3xl font-semibold">Market</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Explore assets, inspect liquidity and participate in the market.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {updated
            ? `Updated ${updated.toLocaleTimeString()}`
            : "Connecting to market…"}
        </span>
      </header>
      {error && (
        <p
          role="alert"
          className="border border-destructive p-3 rounded text-destructive text-sm"
        >
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 border rounded-md bg-card divide-x divide-border">
        {[
          ["Listed assets", loading ? "—" : assets.length],
          [
            "24h traded value",
            loading
              ? "—"
              : `$${money(assets.reduce((n, a) => n + a.volume, 0))}`,
          ],
          [
            "Advancing / declining",
            loading
              ? "—"
              : `${assets.filter((a) => a.change > 0).length} / ${assets.filter((a) => a.change < 0).length}`,
          ],
          ["Market model", "Cash-backed spot"],
        ].map(([label, value]) => (
          <div key={label} className="p-4 min-w-0">
            <p className="eyebrow mb-3">{label}</p>
            <p className="text-lg md:text-xl font-medium break-words">
              {value}
            </p>
          </div>
        ))}
      </div>
      <section
        className="terminal-panel overflow-hidden"
        aria-label="Listed assets"
      >
        <div className="flex flex-wrap gap-3 justify-between border-b p-4">
          <div className="relative flex-1 max-w-md min-w-48">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search assets"
              placeholder="Search assets…"
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Sort assets"
            className="border rounded px-3 py-2 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="volume">Most traded</option>
            <option value="gainers">Top gainers</option>
            <option value="losers">Top decliners</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        {loading ? (
          <p role="status" className="p-12 text-center text-muted-foreground">
            Loading market…
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">
              {assets.length
                ? "No matching assets"
                : "The market is ready for its first listing"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {assets.length
                ? "Try another search."
                : "Approved assets will appear here. Experiments use their own isolated markets."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="text-right">Last price</th>
                  <th className="text-right">24h change</th>
                  <th className="text-right hidden lg:table-cell">
                    24h traded value
                  </th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="flex items-center gap-3 text-left hover:underline"
                        onClick={() => onStockClick(a)}
                      >
                        <span
                          aria-hidden
                          className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center border rounded bg-secondary font-mono text-xs"
                        >
                          {a.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium whitespace-normal min-w-20">
                          {a.name}
                        </span>
                      </button>
                    </td>
                    <td className="text-right font-mono">${money(a.price)}</td>
                    <td
                      className={`text-right font-mono ${a.change > 0 ? "text-success" : a.change < 0 ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {a.changePercent > 0 ? "+" : ""}
                      {a.changePercent.toFixed(2)}%
                    </td>
                    <td className="text-right font-mono hidden lg:table-cell">
                      ${money(a.volume)}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Trade ${a.name}`}
                        onClick={() => onStockClick(a)}
                      >
                        <span className="hidden sm:inline">Trade</span>
                        <ArrowUpRight className="h-4 w-4 sm:ml-2" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          {filtered.length} assets · Prices use the last trade or initial
          listing price. Traded value is price × quantity.
        </div>
      </section>
      <NewsTicker />
    </div>
  );
};
