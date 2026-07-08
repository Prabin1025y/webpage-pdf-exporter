import { NextFunction, Request, Response } from "express";
import { verifyToken } from "./auth-jwt";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { pool } from "./db";

type Role = "USER" | "ADMIN";

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
    };
}

export const requireAuth =
    (requiredRoles?: Role[]) =>
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const token = req.cookies?.access_token;
            console.log(req.cookies)
            if (!token) {
                throw new UnauthorizedError("Unauthorized");
            }

            let payload: any;
            try {
                payload = await verifyToken(token);
            } catch (_) {
                throw new UnauthorizedError("Unauthorized");
            }

            const userId = payload?.sub as string | undefined;
            const role = payload?.role as Role | undefined;

            if (!userId || !role) {
                throw new UnauthorizedError("Unauthorized");
            }

            if (requiredRoles && !requiredRoles.includes(role)) {
                throw new ForbiddenError("Unauthorized");
            }

            const result = await pool.query(
                `
                    SELECT id, email, role, name
                    FROM "User"
                    WHERE id = $1
                `,
                [userId],
            );

            const user = result.rows[0] || null;

            console.log("user", user);

            if (!user) {
                throw new ForbiddenError("Forbidden");
            }

            req.user = user;

            next();
        } catch (error) {
            console.log(error)
            next(error);
        }
    };

export default requireAuth;
