import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import { searchToursController, syncGlobalToursController } from "./tours.controller.js";

export const toursRouter = Router();

toursRouter.get("/search", searchToursController);
toursRouter.post("/sync/global", authorize("tours:sync"), syncGlobalToursController);
