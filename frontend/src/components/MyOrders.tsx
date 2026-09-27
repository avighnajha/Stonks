import { useEffect, useState } from "react";
import axios from "@/api/axiosInstance";
import { cancelOrder } from "@/api/trading.api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MyOrders({ assetId }: { assetId?: string }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const [before, setBefore] = useState<string | undefined>();
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const { data } = await axios.get("/trade/orders", {
          params: { before },
        });
        if (active) {
          setOrders(data);
          setError("");
        }
      } catch (e: any) {
        if (active)
          setError(e.response?.data?.message || "Could not load orders");
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
  }, [user?.id, before]);
  if (!user) return null;
  const cancel = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      await cancelOrder(id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const inspect = async (id: string) => {
    try {
      setDetail((await axios.get(`/trade/order/${id}`)).data);
    } catch {
      setError("Could not load execution details");
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>Order</th>
                <th>Side / type</th>
                <th>Price / protection</th>
                <th>Filled / requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter((o) => !assetId || o.asset_id === assetId)
                .map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-3" title={o.id}>
                      {o.id.slice(0, 8)}
                    </td>
                    <td>
                      {o.side} {o.type}
                    </td>
                    <td>{o.price}</td>
                    <td>
                      {(
                        Number(o.initial_quantity) -
                        Number(o.remaining_quantity)
                      ).toFixed(4)}{" "}
                      / {o.initial_quantity}
                    </td>
                    <td>{o.status}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => inspect(o.id)}
                      >
                        Details
                      </Button>
                      {["OPEN", "PARTIALLY_FILLED"].includes(o.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!busy}
                          onClick={() => cancel(o.id)}
                        >
                          {busy === o.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!orders.length && !error && <p>No orders yet.</p>}
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!before}
            onClick={() => setBefore(undefined)}
          >
            Latest
          </Button>
          <Button
            variant="outline"
            disabled={orders.length < 100}
            onClick={() => setBefore(orders[orders.length - 1]?.sequence)}
          >
            Older orders
          </Button>
        </div>
        {detail && (
          <div className="border rounded p-3">
            <div className="flex justify-between">
              <strong>Execution details</strong>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
            <p className="break-all text-xs">
              {detail.id} · {detail.status}
            </p>
            <p>
              Reserved cash: {detail.reserved_cash}; reserved units:{" "}
              {detail.reserved_quantity}
            </p>
            {detail.fills.length ? (
              detail.fills.map((f: any) => (
                <p key={f.id}>
                  {f.quantity} units at {f.price} ·{" "}
                  {new Date(f.timestamp).toLocaleString()}
                </p>
              ))
            ) : (
              <p>No fills.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
