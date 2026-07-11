import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import { PdfService } from "./lib/pdf/PdfService";
import { ForbiddenError, UnauthorizedError } from "./lib/errors";
import requireAuth, { AuthRequest } from "./lib/requireAuth";

const app = express();
dotenv.config();
const PORT = process.env.PORT || 5001;

// Middleware to parse JSON requests
app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        credentials: true,
        origin: process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ?? [],
        methods: ["POST", "GET"],
        exposedHeaders: ["Content-Disposition"],
    }),
);

// Root route
app.get("/", async (req: Request, res: Response) => {
    res.json({
        message: "Hello, Express + TypeScript! dfd",
    });
});

app.post(
    "/pdf",
    requireAuth(),
    async (req: AuthRequest, res: Response) => {
        try {
            const { noteId, noteTitle } = req.body;

            if (!noteId) {
                return res.status(400).json({ message: "noteId is required" });
            }

            const user = req.user;

            if (!user) throw new UnauthorizedError("Please log in first");


            const pdf = await PdfService.generateNote({
                noteId,
                userName: user.name,
                noteTitle,
                userId: user.id,
                signal: req.signal,
            });

            return res
                .status(200)
                .contentType("application/pdf")
                .set(
                    "Content-Disposition",
                    `attachment; filename="${noteTitle}.pdf"`,
                )
                .send(Buffer.from(pdf));
        } catch (err) {
            console.error(err);

            if (err instanceof UnauthorizedError) {
                return res
                    .status(401)
                    .json({ message: err.message || "Unauthorized" });
            } else if (err instanceof ForbiddenError) {
                return res
                    .status(403)
                    .json({ message: err.message || "Forbidden" });
            }

            return res.status(500).json({ message: "Internal Server Error" });
        }
    },
);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
