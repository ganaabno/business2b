import express from "express";
import { ApiError } from "./shared/http/errors.js";
import { logger } from "./shared/logger.js";
import { requireAuth } from "./modules/auth/auth.middleware.js";
import { organizationsRouter } from "./modules/organizations/organizations.routes.js";
import { seatRequestsRouter } from "./modules/seatRequests/seatRequests.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { toursRouter } from "./modules/tours/tours.routes.js";
import { monitoringRouter } from "./modules/monitoring/monitoring.routes.js";
import { profilesRouter } from "./modules/profiles/profiles.routes.js";
import { bindingRequestsRouter } from "./modules/bindingRequests/bindingRequests.routes.js";
import { paymentWebhookController } from "./modules/payments/payments.controller.js";
import { env } from "./config/env.js";
import { seatAccessRequestsRouter } from "./modules/seatAccessRequests/seatAccessRequests.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { globalTasksRouter } from "./modules/globalTasks/globalTasks.routes.js";
import { adminPriceConfigRouter } from "./modules/adminPriceConfig/routes.js";
import { chatRouter } from "./modules/chat/routes.js";

type PgErrorLike = {
  code?: string;
  message?: string;
};

const B2B_SCHEMA_ERROR_CODES = new Set(["42P01", "42703", "42883"]);
const B2B_SCHEMA_HINT =
  "B2B database schema is not ready. Run `npm run db:b2b:apply` (Supabase UUID schema) or `npm run db:b2b:legacy-bootstrap` (legacy text-ID schema).";

function isB2BSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const pgError = error as PgErrorLike;
  if (!B2B_SCHEMA_ERROR_CODES.has(String(pgError.code || ""))) {
    return false;
  }

  const message = String(pgError.message || "").toLowerCase();
  return [
    "seat_requests",
    "seat_access_requests",
    "seat_request_payment",
    "v_seat_request_monitoring",
    "organizations",
    "organization_members",
    "organization_contracts",
    "payment_milestone_code",
    "app_role",
  ].some((needle) => message.includes(needle));
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  const normalizeOrigin = (value: string) =>
    value.trim().replace(/\/$/, "").toLowerCase();
  const allowedOrigins = new Set(
    env.corsAllowedOrigins
      .map((origin) => normalizeOrigin(origin))
      .filter((origin) => origin.length > 0),
  );
  const allowAllOrigins = env.corsAllowAllOrigins || allowedOrigins.has("*");

  app.use((req, res, next) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const isHttps = req.secure || forwardedProto === "https";

    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );

    if (isHttps) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }

    const origin =
      typeof req.headers.origin === "string" ? req.headers.origin : "";
    const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
    const isAllowedOrigin =
      !origin ||
      allowAllOrigins ||
      (normalizedOrigin && allowedOrigins.has(normalizedOrigin));

    if (origin && isAllowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );

    if (req.method === "OPTIONS") {
      return res.sendStatus(isAllowedOrigin ? 204 : 403);
    }

    return next();
  });

  app.use(
    express.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "gtrip-b2b-api" });
  });

  if (env.b2bSeatRequestFlowEnabled) {
    app.post("/api/v1/payments/webhooks/:provider", paymentWebhookController);
  }

  app.get("/api/v1/feature-flags", (_req, res) => {
    res.json({
      b2bRoleV2Enabled: env.b2bRoleV2Enabled,
      b2bSeatRequestFlowEnabled: env.b2bSeatRequestFlowEnabled,
      b2bMonitoringEnabled: env.b2bMonitoringEnabled,
      b2bGroupPolicyEnabled: env.b2bGroupPolicyEnabled,
      b2bGroupPolicyEnforce: env.b2bGroupPolicyEnforce,
      b2bSerialEnforcementEnabled: env.b2bSerialEnforcementEnabled,
    });
  });

  app.use("/api/v1", requireAuth);
  app.use("/api/v1/tours", toursRouter);
  app.use("/api/v1/admin/users", usersRouter);
  app.use("/api/v1/admin/price-config", adminPriceConfigRouter);
  app.use("/api/v1/chat", chatRouter);
  app.use("/api/v1/global-tasks", globalTasksRouter);

  if (env.b2bRoleV2Enabled) {
    app.use("/api/v1/organizations", organizationsRouter);
    app.use("/api/v1/me", profilesRouter);
    app.use("/api/v1/binding-requests", bindingRequestsRouter);
  }

  if (env.b2bSeatRequestFlowEnabled) {
    app.use("/api/v1/seat-access-requests", seatAccessRequestsRouter);
    app.use("/api/v1/seat-requests", seatRequestsRouter);
    app.use("/api/v1/payments", paymentsRouter);
  }

  if (env.b2bMonitoringEnabled) {
    app.use("/api/v1/monitoring", monitoringRouter);
  }

  app.use(
    (
      error: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      void next;
      if (error instanceof ApiError) {
        logger.warn("API request rejected", {
          method: req.method,
          path: req.originalUrl,
          statusCode: error.statusCode,
          error: error.message,
        });
        return res.status(error.statusCode).json({ error: error.message });
      }

      if (isB2BSchemaError(error)) {
        logger.error("B2B schema readiness error", error);
        return res.status(503).json({ error: B2B_SCHEMA_HINT });
      }

      logger.error("Unhandled API error", error);
      return res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
