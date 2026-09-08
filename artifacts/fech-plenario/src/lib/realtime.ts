import { io, type Socket } from "socket.io-client";

// Must match the server's Socket.io path. The connection is same-origin and
// routes through Replit's reverse proxy, which dispatches "/api" to the API
// server. Paths are not rewritten, so the path must live under "/api".
const SOCKET_PATH = "/api/socket.io";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: SOCKET_PATH,
      withCredentials: true,
      // Reconnect indefinitely with capped backoff; until the socket is back,
      // the UI degrades gracefully to React Query polling.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}
