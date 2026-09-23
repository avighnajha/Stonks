import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import axios from "@/api/axiosInstance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MyOrders } from "@/components/MyOrders";

export const Portfolio = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user) {
      setAccount(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const { data } = await axios.get("/trade/account");
        if (active) {
          setAccount(data);
          setError("");
        }
      } catch {
        if (active)
          setError("Account data unavailable. Displayed values may be stale.");
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    window.addEventListener("portfolio:updated", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("portfolio:updated", load);
    };
  }, [user?.id]);
  if (!user)
    return (
      <div className="container p-6">
        Sign in to view your account and orders.
      </div>
    );
  const positions = account?.positions || [],
    free = Number(account?.wallet.balance || 0),
    reserved = Number(account?.wallet.frozen_balance || 0);
  const holdings = positions.reduce(
    (sum: number, p: any) => sum + Number(p.currentValue),
    0,
  );
  const money = (n: number) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  return (
    <div className="container p-6 space-y-6">
      <h1 className="text-3xl font-bold">Portfolio</h1>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!account && !error && <p>Loading account…</p>}
      {account && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Account equity", free + reserved + holdings],
              ["Available cash", free],
              ["Reserved cash", reserved],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardHeader>
                  <CardTitle>{label}</CardTitle>
                </CardHeader>
                <CardContent>${money(Number(value))}</CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Positions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Owned</th>
                    <th>Reserved</th>
                    <th>Average cost</th>
                    <th>Marked value</th>
                    <th>Unrealized P&L</th>
                    <th>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p: any) => (
                    <tr key={p.assetId} className="border-t">
                      <td className="py-3">{p.name}</td>
                      <td>{p.quantity}</td>
                      <td>{p.reservedQuantity}</td>
                      <td>{money(Number(p.averageBuyPrice))}</td>
                      <td>{money(Number(p.currentValue))}</td>
                      <td>{money(Number(p.profitLoss))}</td>
                      <td>{money(Number(p.realizedPnl))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!positions.length && <p>No positions yet.</p>}
              <p className="text-xs text-muted-foreground mt-3">
                Values include reserved assets, marked at the last trade or
                initial listing price. Marked value is not guaranteed
                liquidation value.
              </p>
            </CardContent>
          </Card>
        </>
      )}
      <MyOrders />
    </div>
  );
};
