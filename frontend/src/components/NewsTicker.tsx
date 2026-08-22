import { useEffect, useState, useRef } from 'react';
import useSocket from '@/hooks/useSocket';

interface NewsItem {
  assetId: string;
  headline: string;
  sentiment: number;
  timestamp: string;
}

export const NewsTicker = () => {
  const socket = useSocket();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) {
      console.log('[NewsTicker] Socket not available');
      return;
    }

    console.log('[NewsTicker] Socket object available, waiting for connection...');

    const handleGlobalNews = (payload: NewsItem) => {
      console.log('[NewsTicker] Received global_news event:', payload);
      setNewsItems((prev) => [payload, ...prev].slice(0, 50));
    };

    const setupListeners = () => {
      console.log('[NewsTicker] Setting up listeners');
      console.log('[NewsTicker] Socket ID:', socket.id);
      console.log('[NewsTicker] Socket connected:', socket.connected);

      socket.on('global_news', handleGlobalNews);

      // Test if we can receive any event
      socket.on('newTrade', (data) => {
        console.log('[NewsTicker] Received newTrade event (test):', data);
      });

      // Listen to ALL events for debugging
      socket.onAny((eventName, ...args) => {
        console.log('[NewsTicker] Received ANY event:', eventName, args);
      });
    };

    const handleConnect = () => {
      console.log('[NewsTicker] Socket connected event fired');
      console.log('[NewsTicker] Socket ID after connect:', socket.id);
      console.log('[NewsTicker] Socket connected after connect:', socket.connected);
      setupListeners();
    };

    const handleDisconnect = () => {
      console.log('[NewsTicker] Socket disconnected event fired');
    };

    const handleConnectError = (err: any) => {
      console.error('[NewsTicker] Socket connection error:', err);
    };

    // Set up connection event listeners first
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // If already connected, set up listeners immediately
    if (socket.connected) {
      console.log('[NewsTicker] Socket already connected, setting up listeners immediately');
      setupListeners();
    }

    return () => {
      console.log('[NewsTicker] Cleaning up socket listeners');
      socket.off('global_news', handleGlobalNews);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('newTrade');
    };
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [newsItems]);

  return (
    <div className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg shadow-xl">
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-slate-800 bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-200">Breaking News</h3>
        </div>
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-2"
        >
          {newsItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Waiting for breaking news...</p>
          ) : (
            newsItems.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="flex gap-2 text-sm">
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-1">
                  <span className="text-slate-300 font-medium">{item.assetId}:</span>
                  <span className="text-slate-400 ml-1">{item.headline}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
