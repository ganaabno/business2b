import { Router } from "express";
import { requireAdmin } from "../auth/auth.middleware.js";
import * as controller from "./controller.js";

export const adminPriceConfigRouter = Router();

adminPriceConfigRouter.use(requireAdmin);

adminPriceConfigRouter.get("/destinations", controller.listDestinationsController);
adminPriceConfigRouter.get("/destinations/:id", controller.getDestinationController);
adminPriceConfigRouter.post("/destinations", controller.createDestinationController);
adminPriceConfigRouter.put("/destinations/:id", controller.updateDestinationController);
adminPriceConfigRouter.delete("/destinations/:id", controller.deleteDestinationController);

adminPriceConfigRouter.get("/price-configs", controller.listPriceConfigsController);
adminPriceConfigRouter.post("/price-configs", controller.createPriceConfigController);
adminPriceConfigRouter.put("/price-configs/:id", controller.updatePriceConfigController);
adminPriceConfigRouter.delete("/price-configs/:id", controller.deletePriceConfigController);

adminPriceConfigRouter.get("/car-types", controller.listCarTypesController);
adminPriceConfigRouter.post("/car-types", controller.createCarTypeController);
adminPriceConfigRouter.put("/car-types/:id", controller.updateCarTypeController);
adminPriceConfigRouter.delete("/car-types/:id", controller.deleteCarTypeController);

adminPriceConfigRouter.get("/flight-classes", controller.listFlightClassesController);
adminPriceConfigRouter.post("/flight-classes", controller.createFlightClassController);
adminPriceConfigRouter.put("/flight-classes/:id", controller.updateFlightClassController);
adminPriceConfigRouter.delete("/flight-classes/:id", controller.deleteFlightClassController);

adminPriceConfigRouter.get("/visa-fees", controller.listVisaFeesController);
adminPriceConfigRouter.post("/visa-fees", controller.createVisaFeeController);
adminPriceConfigRouter.put("/visa-fees/:id", controller.updateVisaFeeController);
adminPriceConfigRouter.delete("/visa-fees/:id", controller.deleteVisaFeeController);

adminPriceConfigRouter.get("/activities", controller.listOptionalActivitiesController);
adminPriceConfigRouter.post("/activities", controller.createOptionalActivityController);
adminPriceConfigRouter.put("/activities/:id", controller.updateOptionalActivityController);
adminPriceConfigRouter.delete("/activities/:id", controller.deleteOptionalActivityController);

adminPriceConfigRouter.get("/seasonal-pricing", controller.listSeasonalPricingController);
adminPriceConfigRouter.post("/seasonal-pricing", controller.createSeasonalPricingController);
adminPriceConfigRouter.put("/seasonal-pricing/:id", controller.updateSeasonalPricingController);
adminPriceConfigRouter.delete("/seasonal-pricing/:id", controller.deleteSeasonalPricingController);