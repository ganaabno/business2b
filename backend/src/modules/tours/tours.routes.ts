import { Router, type RequestHandler } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  ensureGlobalTourBookableController,
  getGlobalOrdersProxyController,
  getGlobalToursProxyController,
  getGlobalToursSyncStatusController,
  listTourDestinationsController,
  pushGlobalTourController,
  syncGlobalPriceRowCanonicalController,
  searchToursController,
  syncGlobalPriceRowController,
  syncGlobalToursController,
} from "./tours.controller.js";

type ToursRouteHandlers = {
  listTourDestinationsController: RequestHandler;
  searchToursController: RequestHandler;
  getGlobalToursProxyController: RequestHandler;
  getGlobalOrdersProxyController: RequestHandler;
  getGlobalToursSyncStatusController: RequestHandler;
  syncGlobalToursController: RequestHandler;
  pushGlobalTourController: RequestHandler;
  ensureGlobalTourBookableController: RequestHandler;
  syncGlobalPriceRowController: RequestHandler;
  syncGlobalPriceRowCanonicalController: RequestHandler;
};

const defaultHandlers: ToursRouteHandlers = {
  listTourDestinationsController,
  searchToursController,
  getGlobalToursProxyController,
  getGlobalOrdersProxyController,
  getGlobalToursSyncStatusController,
  syncGlobalToursController,
  pushGlobalTourController,
  ensureGlobalTourBookableController,
  syncGlobalPriceRowController,
  syncGlobalPriceRowCanonicalController,
};

export function createToursRouter(overrides: Partial<ToursRouteHandlers> = {}) {
  const handlers = {
    ...defaultHandlers,
    ...overrides,
  };

  const router = Router();

  router.get("/search", handlers.searchToursController);
  router.get("/destinations", handlers.listTourDestinationsController);
  router.get("/global/proxy", handlers.getGlobalToursProxyController);
  router.get("/global/proxy/orders", handlers.getGlobalOrdersProxyController);
  router.get(
    "/sync/global/status",
    authorize("tours:sync"),
    handlers.getGlobalToursSyncStatusController,
  );
  router.post(
    "/sync/global",
    authorize("tours:sync"),
    handlers.syncGlobalToursController,
  );
  router.post(
    "/sync/global/push",
    authorize("tours:sync"),
    handlers.pushGlobalTourController,
  );
  router.post(
    "/sync/global/ensure-bookable",
    authorize("tours:sync:canonical"),
    handlers.ensureGlobalTourBookableController,
  );
  router.post(
    "/sync/global/price-row",
    authorize("tours:sync:raw"),
    handlers.syncGlobalPriceRowController,
  );
  router.post(
    "/sync/global/price-row/canonical",
    authorize("tours:sync:canonical"),
    handlers.syncGlobalPriceRowCanonicalController,
  );

  return router;
}

export const toursRouter = createToursRouter();
