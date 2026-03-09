"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const API_WS = process.env.NEXT_PUBLIC_API_WS || "http://localhost:3000";

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    _socket = io(API_WS, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return _socket;
}

interface UseSocketOptions {
  userId?: string;
  eventId?: string;
  onQueueUpdate?: (data: { totalInQueue: number }) => void;
  onQueueEnter?: () => void;
  onQueueSoon?: () => void;
  onSoldOut?: () => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    socket.on("connect", () => {
      if (options.userId) {
        socket.emit("register", { userId: options.userId });
      }
      if (options.eventId) {
        socket.emit("join_event_room", { eventId: options.eventId });
      }
    });

    if (options.onQueueUpdate) {
      socket.on("queue:update", options.onQueueUpdate);
    }
    if (options.onQueueEnter) {
      socket.on("queue:enter", options.onQueueEnter);
    }
    if (options.onQueueSoon) {
      socket.on("queue:soon", options.onQueueSoon);
    }
    if (options.onSoldOut) {
      socket.on("queue:sold_out", options.onSoldOut);
    }

    return () => {
      socket.off("queue:update");
      socket.off("queue:enter");
      socket.off("queue:soon");
      socket.off("queue:sold_out");
      socket.off("connect");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.userId, options.eventId]);

  const sendHeartbeat = useCallback((userId: string, eventId: string) => {
    socketRef.current?.emit("heartbeat", { userId, eventId });
  }, []);

  return { socket: socketRef.current, sendHeartbeat };
}
