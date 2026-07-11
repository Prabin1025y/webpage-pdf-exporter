import { NextFunction, Request, Response } from "express";
import { verifyInternalToken } from "./auth-jwt";
import { ForbiddenError, UnauthorizedError } from "./errors";

type Role = "USER" | "ADMIN";

export interface AuthRequest extends Request {
    user?: {
        id: string;
        name: string | null;
        role: Role;
    };
}

export const requireAuth =
    (requiredRoles?: Role[]) =>
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const auth_header = req.header("Authorization");
            if (!auth_header) {
                throw new UnauthorizedError(
                    "No Authorization Token Header Found",
                );
            }
            const splittedHeader = auth_header?.split(" ");

            if (splittedHeader[0].trim() !== "Bearer") {
                throw new UnauthorizedError("Invalid Token Type");
            }

            const token = splittedHeader[1].trim();

            if (!token) {
                throw new UnauthorizedError("Unauthorized");
            }

            let payload: any;
            try {
                payload = await verifyInternalToken(token);
            } catch (err) {
                console.log(err)
                throw new UnauthorizedError("Unauthorized");
            }

            const userId = payload?.userId as string | undefined;
            const role = payload?.role as Role | undefined;
            const userName = payload?.username as string | undefined;

            if (!userId || !role) {
                throw new UnauthorizedError("Unauthorized");
            }

            if (requiredRoles && !requiredRoles.includes(role)) {
                throw new ForbiddenError("Unauthorized");
            }

            req.user = {
                id: userId,
                role,
                name: userName || null,
            };

            next();
        } catch (error) {
            console.log(error);
            next(error);
        }
    };

export default requireAuth;
