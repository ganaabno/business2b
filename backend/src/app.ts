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

export function createApp() {
  const app = express();

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
      b2bAdminTestModeEnabled: env.b2bAdminTestModeEnabled && !env.isProduction,
    });
  });

  app.use("/api/v1", requireAuth);
  app.use("/api/v1/tours", toursRouter);
  app.use("/api/v1/admin/users", usersRouter);

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

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    logger.error("Unhandled API error", error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
