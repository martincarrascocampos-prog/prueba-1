import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

// Always trust proxy — app runs behind Replit's reverse proxy in both dev and production
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgSession = connectPgSimple(session);

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && isProduction) {
  logger.error("SESSION_SECRET is required in production");
  process.exit(1);
}

// Exported so the Socket.io server can reuse the exact same session
// middleware to authenticate websocket connections via the session cookie.
export const sessionMiddleware: RequestHandler = session({
  store: new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: sessionSecret ?? "dev-secret-not-for-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? "none" : "lax",
  },
});

app.use(sessionMiddleware);

app.use("/api", router);

export default app;
