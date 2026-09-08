import { useEffect, useState } from "react";
import { getSocket } from "@/lib/realtime";

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

/**
 * Track the global Socket.io connection state for the realtime layer.
 *
 * This reuses the shared socket singleton (the same connection the
 * `useSessionLive` / `useLobbyLive` hooks ride on) and reports a coarse status
 * the UI can surface as a "live / reconnecting" badge. While disconnected the
 * app still works via React Query polling — this only signals freshness.
 */
export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(() =>
    getSocket().connected ? "connected" : "reconnecting",
  );

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("reconnecting");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onReconnectFailed = () => setStatus("disconnected");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    setStatus(socket.connected ? "connected" : "reconnecting");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  return status;
}
