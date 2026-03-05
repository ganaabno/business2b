import { Router } from "express";
import {
  createDepositIntentController,
  getSeatRequestPaymentsController,
  simulateSeatRequestPaymentController,
} from "./payments.controller.js";

export const paymentsRouter = Router();

paymentsRouter.post("/seat-requests/:id/deposit-intent", createDepositIntentController);
paymentsRouter.get("/seat-requests/:id/history", getSeatRequestPaymentsController);
paymentsRouter.post("/seat-requests/:id/test-pay", simulateSeatRequestPaymentController);
