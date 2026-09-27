import { useEffect, useState } from "react";
import axios from "@/api/axiosInstance";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function OrderBook({ assetId }: { assetId: string }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    setSnapshot(null);
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const { data } = await axios.get(`/trade/book/${assetId}`);
        if (active) {
          setSnapshot((old) =>
            !old || BigInt(data.cursor) >= BigInt(old.cursor) ? data : old,
          );
          setError("");
        }
      } catch {
        if (active)
          setError("Order book unavailable; displayed levels may be stale.");
      }
    };
    void load();
    const timer = setInterval(load, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [assetId, user?.id]);
  if (!user) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order book</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-6">
          {(["buys", "sells"] as const).map((side) => (
            <div key={side}>
              <h3 className="font-medium">
                {side === "buys" ? "Bids" : "Asks"}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Price</th>
                    <th className="text-right">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot?.book[side].slice(0, 10).map((level: any) => (
                    <tr key={level.price}>
                      <td>{level.price}</td>
                      <td className="text-right">{level.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snapshot && !snapshot.book[side].length && (
                <p className="text-sm text-muted-foreground">
                  No resting orders.
                </p>
              )}
            </div>
          ))}
        </div>
        {snapshot && (
          <p className="text-xs text-muted-foreground mt-3">
            Snapshot {snapshot.cursor} · up to 10 price levels · refreshes every
            2 seconds
          </p>
        )}
      </CardContent>
    </Card>
  );
}
