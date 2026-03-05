import type { NextFunction, Request, Response } from "express";
import { can, type Action } from "./policy.js";

export function authorize(action: Action) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!can(user.role, action)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
