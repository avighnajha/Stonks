import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || '';
    const url = base ? `${base.replace(/\/$/, '')}/market` : '/market';
    const s = io(url, { path: '/socket.io', transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => {
      // connection established
    });

    s.on('connect_error', (err) => {
      // optionally handle connect errors
      console.warn('Socket connect error', err);
    });

    s.on('disconnect', (reason) => {
      // handle disconnect reason if needed
      console.debug('Socket disconnected', reason);
    });

    return () => {
      if (s) {
        s.disconnect();
      }
      setSocket(null);
    };
  }, []);

  return socket;
}
