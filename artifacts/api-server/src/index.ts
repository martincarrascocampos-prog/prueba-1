import { createServer } from "node:http";
import app, { sessionMiddleware } from "./app";
import { initRealtime } from "./lib/realtime";
import { backfillLegacySessionWeights } from "./lib/sessionWeights";
import { ensureJustifiedAbsencesTable } from "./lib/justifiedAbsences";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Share a single HTTP server between Express and Socket.io so websocket
// upgrades arrive on the same port the proxy already forwards to.
const httpServer = createServer(app);
initRealtime(httpServer, sessionMiddleware);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // One-time, idempotent: sessions created before per-session weight snapshots
  // existed get a synthetic snapshot (consejeros at their original 0.75) so
  // current-weight edits never retro-change historical results.
  void backfillLegacySessionWeights();

  // Idempotent: production doesn't run drizzle push, so make sure the
  // label-only justified_absences table exists before routes reference it.
  void ensureJustifiedAbsencesTable();
});
