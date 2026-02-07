import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { JwtPayload, JwtPayloadSchema } from "../shared/jwt.schema";
import { ErrorCode } from "../shared/error-codes";

const SECRET = (process.env.JWT_SECURITY_KEY || "default_secret_unsafe").trim();

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .json({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: "No token provided",
      });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, SECRET);
    const parsed = JwtPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return res
        .status(401)
        .json({
          code: ErrorCode.AUTH_UNAUTHORIZED,
          message: "Invalid token structure",
        });
    }
    (req as AuthenticatedRequest).user = parsed.data;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({
        code: ErrorCode.AUTH_TOKEN_EXPIRED,
        message: "Invalid or expired token",
      });
  }
};
