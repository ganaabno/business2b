import { Router } from "express";
import { getProfileOverviewController } from "./profiles.controller.js";

export const profilesRouter = Router();

profilesRouter.get("/profile", getProfileOverviewController);
