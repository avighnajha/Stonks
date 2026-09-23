import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./useAuth";
import axios, { API_BASE_URL } from "@/api/axiosInstance";

type Handler = (payload: any) => void;
// A replayable local feed, deliberately separate from the raw socket transport.
class MarketFeed {
  private handlers = new Map<string, Set<Handler>>();
  private latest = new Map<string, Map<string, any>>();
  private news: any[] = [];
  status = "connecting";
  on(name: string, fn: Handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(fn);
    if (name === "status") fn(this.status);
    else if (name === "global_news") this.news.forEach(fn);
    else this.latest.get(name)?.forEach(fn);
    return this;
  }
  off(name: string, fn?: Handler) {
    if (fn) this.handlers.get(name)?.delete(fn);
    else this.handlers.delete(name);
    return this;
  }
  state(status: string) {
    this.status = status;
    this.handlers.get("status")?.forEach((fn) => fn(status));
  }
  accept(event: any) {
    const name = (
      {
        trade: "newTrade",
        book: "order_book_update",
        news: "global_news",
      } as Record<string, string>
    )[event.type];
    if (!name) return;
    const payload = {
      ...event.payload,
      assetId: event.assetId,
      sequence: event.sequence,
      timestamp: event.timestamp,
    };
    if (name === "global_news") this.news = [...this.news, payload].slice(-50);
    else {
      if (!this.latest.has(name)) this.latest.set(name, new Map());
      this.latest.get(name)!.set(event.assetId, payload);
    }
    this.handlers.get(name)?.forEach((fn) => fn(payload));
  }
}

export default function useSocket() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<MarketFeed | null>(null);
  useEffect(() => {
    if (!user) {
      setFeed(null);
      return;
    }
    const local = new MarketFeed();
    setFeed(local);
    let active = true,
      busy = false,
      cursor: string | null = null;
    const controller = new AbortController();
    const recover = async () => {
      if (!active || busy) return;
      busy = true;
      try {
        if (cursor === null) {
          const { data } = await axios.get("/trade/feed-snapshot", {
            signal: controller.signal,
          });
          if (!active) return;
          data.events.forEach((e: any) => local.accept(e));
          cursor = data.cursor;
        }
        let more = true;
        while (active && more) {
          const { data } = await axios.get("/trade/events", {
            params: { after: cursor },
            signal: controller.signal,
          });
          if (!active) return;
          for (const event of data.events) {
            if (BigInt(event.sequence) > BigInt(cursor!)) {
              local.accept(event);
              cursor = event.sequence;
            }
          }
          cursor = data.nextCursor;
          more = data.hasMore;
        }
        if (active) local.state("synced");
      } catch {
        if (active) local.state("offline");
      } finally {
        busy = false;
      }
    };
    const socket = io(`${API_BASE_URL.replace(/\/$/, "")}/market`, {
      path: "/socket.io",
      auth: { token: localStorage.getItem("authToken") },
    });
    socket.on("connect", recover);
    // Socket delivery is a wakeup; REST replay supplies authoritative ordering and fills gaps.
    socket.on("exchange_event", recover);
    socket.on("disconnect", () => {
      local.state("recovering");
      void recover();
    });
    void recover();
    const timer = setInterval(recover, 2000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      socket.disconnect();
    };
  }, [user?.id]);
  return feed;
}
