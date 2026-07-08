import { readFileSync } from "fs";
import path from "path";
import { Page } from "puppeteer";
import { BrowserManager } from "./BrowserManager";
import { PdfToken } from "./PdfToken";
import { PdfRoutes } from "./PdfRoutes";
import { withTimeout } from "../withTimeout";
import { logger } from "../logger";

type GenerateNotePdfInput = {
    noteId: string;
    userId: string;
    userName: string | null;
    noteTitle?: string;
    signal?: AbortSignal;
};

export class PdfService {
    static async generateNote(
        input: GenerateNotePdfInput,
    ): Promise<Uint8Array> {
        if (input.signal?.aborted) {
            throw new Error("Request aborted.");
        }

        // For Logging
        const requestId = crypto.randomUUID();
        const started = performance.now();

        const token = await PdfToken.create({
            purpose: "pdf",
            noteId: input.noteId,
            userId: input.userId,
        });

        return withTimeout(
            BrowserManager.withContext(async (context) => {
                const page = await context.newPage();

                await page.setExtraHTTPHeaders({
                    Authorization: `Bearer ${token}`,
                });

                const url = PdfRoutes.note(input.noteId);
                logger.info({ url }, "url constructed");

                page.on("console", (msg) =>
                    console.log(`[${msg.type()}] ${msg.text()}`),
                );

                await this.navigate(page, url);
                logger.info("finished navigation");

                if (input.signal?.aborted) {
                    throw new Error("Request aborted.");
                }

                await page.evaluate((title) => {
                    document.title = title || "Your Note";
                }, input.noteTitle);

                const logoPath = path.join(process.cwd(), "public", "logo.png");
                const logoBuffer = readFileSync(logoPath);
                const logoDataUrl = `data:image/png;base64,${logoBuffer.toString("base64")}`;

                logger.info(
                    { requestId },
                    `Finished in ${Math.round(performance.now() - started)}ms`,
                );

                return page.pdf({
                    printBackground: true,
                    format: "A4",
                    preferCSSPageSize: true,
                    margin: {
                        top: "40px",
                        right: "0mm",
                        bottom: "40px",
                        left: "10px",
                    },
                    scale: 0.8,

                    displayHeaderFooter: true,
                    headerTemplate: `
                        <div style="
                        width: 100%;
                        padding: 0 40px;
                        font-size: 10px;
                        color: #1b1b1b;
                        text-align: end;
                        ">
                        <span>Author: ${input.userName || ""}</span>
                        </div>
                    `,

                    footerTemplate: `
                        <div style="
                        width:100%;
                        font-size:15px;
                        padding:0 40px;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        color:#666;
                        ">
                        <div style="display: flex; gap: 5px; align-items:center;">
                        <img src="${logoDataUrl}" alt="logo" style="width: 20px; height: 20px;">
                        <span style="color: #663dc0;"><span style="font-weight: bold;">Eton</span> Note</span>
                        </div>

                        <span>
                            Page
                            <span class="pageNumber"></span>
                            of
                            <span class="totalPages"></span>
                        </span>
                        </div>
                    `,
                });
            }),
            30_000,
            "PDF generation timed out.",
        );
    }

    private static async navigate(page: Page, url: string) {
        console.log("inside navigate first");
        const response = await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
        });
        console.log("inside navigate second");

        if (!response) {
            throw new Error("No response received");
        }

        if (!response.ok) {
            throw new Error(`Navigation failed (${response.status()})`);
        }

        await page.waitForFunction(() => window.__PDF_READY__ === true, {
            timeout: 30_000,
        });
        console.log("inside navigate last");
    }
}
