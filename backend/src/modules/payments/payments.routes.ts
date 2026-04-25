import { Router } from "express";
import {
  checkQPayInvoiceStatusController,
  createQPayInvoiceIntentController,
  createDepositIntentController,
  getSeatRequestPaymentsController,
} from "./payments.controller.js";

export const paymentsRouter = Router();

paymentsRouter.post("/seat-requests/:id/deposit-intent", createDepositIntentController);
paymentsRouter.post("/seat-requests/:id/qpay-invoice", createQPayInvoiceIntentController);
paymentsRouter.post("/seat-requests/:id/qpay-status", checkQPayInvoiceStatusController);
paymentsRouter.get("/seat-requests/:id/history", getSeatRequestPaymentsController);
