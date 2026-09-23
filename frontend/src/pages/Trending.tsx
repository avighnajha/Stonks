import { useEffect, useState } from "react";
import axios from "@/api/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const Trending = ({
  onStockClick,
}: {
  onStockClick: (stock: any) => void;
}) => {
  const [assets, setAssets] = useState<any[]>([]),
    [error, setError] = useState(""),
    [mode, setMode] = useState<"volume" | "gainers" | "losers">("volume");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await axios.get("/trade/markets");
        if (active) {
          setAssets(
            data.map((a: any) => ({
              ...a,
              price: Number(a.price),
              change: Number(a.change),
              changePercent: Number(a.changePercent),
              volume: Number(a.volume),
              totalSupply: Number(a.total_supply),
              image: a.imageUrl,
              data: [],
            })),
          );
          setError("");
        }
      } catch {
        if (active)
          setError("Market data unavailable. Displayed values may be stale.");
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const rows = assets
    .filter((a) =>
      mode === "gainers"
        ? a.change > 0
        : mode === "losers"
          ? a.change < 0
          : true,
    )
    .sort((a, b) =>
      mode === "volume"
        ? b.volume - a.volume
        : mode === "gainers"
          ? b.changePercent - a.changePercent
          : a.changePercent - b.changePercent,
    );
  return (
    <div className="container p-6 space-y-6">
      <h1 className="text-3xl font-bold">Market activity</h1>
      <p className="text-muted-foreground">
        Executed notional volume and price changes over 24 hours.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {(["volume", "gainers", "losers"] as const).map((m) => (
          <Button
            key={m}
            variant={mode === m ? "default" : "outline"}
            onClick={() => setMode(m)}
          >
            {m}
          </Button>
        ))}
      </div>
      {rows.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle>{a.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between gap-3">
            <div>
              <p>
                ${a.price.toFixed(2)} · {a.changePercent.toFixed(2)}%
              </p>
              <p className="text-sm text-muted-foreground">
                24h volume ${a.volume.toLocaleString()}
              </p>
            </div>
            <Button onClick={() => onStockClick(a)}>View market</Button>
          </CardContent>
        </Card>
      ))}
      {!rows.length && !error && <p>No matching market activity yet.</p>}
    </div>
  );
};
