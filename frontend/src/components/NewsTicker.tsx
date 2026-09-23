import { useEffect, useState } from "react";
import useSocket from "@/hooks/useSocket";
export const NewsTicker = () => {
  const feed = useSocket();
  const [items, setItems] = useState<any[]>([]),
    [status, setStatus] = useState("connecting");
  useEffect(() => {
    setItems([]);
    if (!feed) return;
    const add = (item: any) =>
      setItems((old) =>
        [item, ...old.filter((x) => x.sequence !== item.sequence)].slice(0, 50),
      );
    feed.on("global_news", add);
    feed.on("status", setStatus);
    return () => {
      feed.off("global_news", add);
      feed.off("status", setStatus);
    };
  }, [feed]);
  if (!feed) return null;
  return (
    <section className="border rounded p-3 space-y-2" aria-label="Market news">
      <div className="flex justify-between">
        <strong>Market news</strong>
        <span className="text-xs text-muted-foreground">
          {status === "synced"
            ? "Up to date"
            : "Reconnecting — news may be stale"}
        </span>
      </div>
      <div className="max-h-40 overflow-auto">
        {items.map((item) => (
          <p key={item.sequence} className="text-sm py-1">
            <time className="text-muted-foreground">
              {new Date(item.timestamp).toLocaleTimeString()}{" "}
            </time>
            {item.headline}{" "}
            <span className="text-xs">(sentiment {item.sentiment}/100)</span>
          </p>
        ))}
        {!items.length && (
          <p className="text-sm text-muted-foreground">No news yet.</p>
        )}
      </div>
    </section>
  );
};
