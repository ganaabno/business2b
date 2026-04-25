import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, test } from "node:test";
import express, { type RequestHandler } from "express";
import type { AppRole } from "../../shared/types/auth.js";
import { createToursRouter } from "./tours.routes.js";

let activeServer: Server | null = null;

afterEach(async () => {
  if (!activeServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    activeServer?.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  activeServer = null;
});

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const roleHeader = Array.isArray(req.headers["x-role"])
      ? req.headers["x-role"][0]
      : req.headers["x-role"];

    const role = String(roleHeader || "").trim() as AppRole;
    if (role) {
      (req as express.Request & { user?: unknown }).user = {
        id: `test-${role}`,
        role,
        organizationId: null,
      };
    }

    next();
  });

  const ok: RequestHandler = (_req, res) => {
    res.status(200).json({ ok: true });
  };

  app.use(
    "/api/v1/tours",
    createToursRouter({
      listTourDestinationsController: ok,
      searchToursController: ok,
      getGlobalToursProxyController: ok,
      getGlobalOrdersProxyController: ok,
      getGlobalToursSyncStatusController: ok,
      syncGlobalToursController: ok,
      pushGlobalTourController: ok,
      ensureGlobalTourBookableController: ok,
      syncGlobalPriceRowController: ok,
      syncGlobalPriceRowCanonicalController: ok,
    }),
  );

  activeServer = await new Promise<Server>((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.once("error", reject);
  });

  const port = (activeServer.address() as AddressInfo).port;
  return `http://127.0.0.1:${port}`;
}

async function requestStatus(input: {
  baseUrl: string;
  method: "GET" | "POST";
  path: string;
  role?: AppRole;
}) {
  const response = await fetch(`${input.baseUrl}${input.path}`, {
    method: input.method,
    headers: {
      ...(input.role ? { "x-role": input.role } : {}),
      "content-type": "application/json",
    },
    body: input.method === "POST" ? "{}" : undefined,
  });

  return response.status;
}

test("tours sync routes enforce role access matrix", async () => {
  const baseUrl = await startServer();

  const roles: AppRole[] = ["admin", "manager", "subcontractor", "agent"];

  const assertMatrix = async (input: {
    method: "GET" | "POST";
    path: string;
    expectedByRole: Record<AppRole, number>;
  }) => {
    for (const role of roles) {
      const status = await requestStatus({
        baseUrl,
        method: input.method,
        path: input.path,
        role,
      });

      assert.equal(
        status,
        input.expectedByRole[role],
        `${input.method} ${input.path} should return ${input.expectedByRole[role]} for ${role}`,
      );
    }
  };

  await assertMatrix({
    method: "POST",
    path: "/api/v1/tours/sync/global",
    expectedByRole: {
      admin: 200,
      manager: 200,
      subcontractor: 403,
      agent: 403,
    },
  });

  await assertMatrix({
    method: "POST",
    path: "/api/v1/tours/sync/global/price-row",
    expectedByRole: {
      admin: 200,
      manager: 200,
      subcontractor: 403,
      agent: 403,
    },
  });

  await assertMatrix({
    method: "POST",
    path: "/api/v1/tours/sync/global/price-row/canonical",
    expectedByRole: {
      admin: 200,
      manager: 200,
      subcontractor: 200,
      agent: 200,
    },
  });

  await assertMatrix({
    method: "POST",
    path: "/api/v1/tours/sync/global/ensure-bookable",
    expectedByRole: {
      admin: 200,
      manager: 200,
      subcontractor: 200,
      agent: 200,
    },
  });

  const unauthorizedStatus = await requestStatus({
    baseUrl,
    method: "POST",
    path: "/api/v1/tours/sync/global/price-row",
  });
  assert.equal(unauthorizedStatus, 401);
});
