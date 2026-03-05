import type { AuthUser } from "../shared/types/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      rawBody?: Buffer;
    }
  }
}

export {};
