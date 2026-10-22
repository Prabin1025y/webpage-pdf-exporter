import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { Page } from "puppeteer";
import { BrowserManager } from "./BrowserManager";
import { PdfToken } from "./PdfToken";
import { PdfRoutes } from "./PdfRoutes";
import { withTimeout } from "../withTimeout";
import { logger } from "../logger";

type GenerateNotePdfInput = {
    noteId: string;
    userId: string;
    userName: string | null; // no longer shown in the PDF; kept so callers don't break
    noteTitle?: string;
    folderName?: string;
    signal?: AbortSignal;
};

const SITE_URL = process.env.ETONNOTE_URL ?? "https://etonnote.vercel.app/";

// Page layout (mm)
const MARGIN = { top: 10, bottom: 12, side: 10 };

// Clickable area over "etonnote", in mm from the bottom-left of the page.
// Nudge these if the link doesn't line up with the text.
const LINK_BOX = { x1: 19, x2: 32, y1: 7, y2: 13 };

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

const esc = (value: unknown): string =>
    String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

const mmToPt = (mm: number) => (mm * 72) / 25.4;

function buildHeaderTemplate(title: string, folderName: string): string {
    return `
        <style>html,body{margin:0;padding:0}</style>
        <div style="
            box-sizing:border-box;
            height:${MARGIN.top - 5}mm;
            width:calc(100% - ${MARGIN.side * 2}mm);
            margin:0 ${MARGIN.side}mm;
            display:flex;
            align-items:flex-end;
            justify-content:flex-end;
            padding-bottom:2mm;
            font:9.5px Arial,Helvetica,sans-serif;
            color:#666;
            -webkit-print-color-adjust:exact;
        ">
            ${esc(title)}${esc(folderName) ? " | " + esc(folderName) : ""}
        </div>
    `;
}

function buildFooterTemplate(): string {
    return `
        <style>html,body{margin:0;padding:0}</style>
        <div style="
            box-sizing:border-box;
            height:${MARGIN.bottom - 5}mm;
            width:calc(100% - ${MARGIN.side * 2}mm);
            margin:0 ${MARGIN.side}mm;
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            padding-top:2mm;
            font:9.5px Arial,Helvetica,sans-serif;
            color:#666;
            -webkit-print-color-adjust:exact;
        ">
            <span style="font-size:7px;letter-spacing:.04em;color:#9a9aa3;padding-top:0.5mm;">
                created using <b style="font-size:8px;color:#663dc0;">etonnote</b>
            </span>
            <span>
                Page <span class="pageNumber"></span>
                of <span class="totalPages"></span>
            </span>
        </div>
    `;
}

/** Adds a clickable link over "etonnote" on every page. */
async function addFooterLink(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const pdf = await PDFDocument.load(pdfBytes);

    for (const page of pdf.getPages()) {
        const link = pdf.context.register(
            pdf.context.obj({
                Type: "Annot",
                Subtype: "Link",
                Rect: [
                    mmToPt(LINK_BOX.x1),
                    mmToPt(LINK_BOX.y1),
                    mmToPt(LINK_BOX.x2),
                    mmToPt(LINK_BOX.y2),
                ],
                Border: [0, 0, 0],
                A: {
                    Type: "Action",
                    S: "URI",
                    URI: PDFString.of(SITE_URL),
                },
            }),
        );

        const annots = page.node.Annots();
        if (annots) annots.push(link);
        else page.node.set(PDFName.of("Annots"), pdf.context.obj([link]));
    }

    return pdf.save();
}

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

        const title = input.noteTitle || "";
        const folderName = input.folderName || "";

        const rawPdf = await withTimeout(
            BrowserManager.withContext(async (context) => {
                const page = await context.newPage();

                await page.setExtraHTTPHeaders({
                    Authorization: `Bearer ${token}`,
                });

                const url = PdfRoutes.note(input.noteId);

                await this.navigate(page, url);

                if (input.signal?.aborted) {
                    throw new Error("Request aborted.");
                }

                await page.evaluate((t) => {
                    document.title = t;
                }, title);

                const pdf = await page.pdf({
                    printBackground: true,
                    format: "A4",
                    preferCSSPageSize: false, // margins come from the options below
                    margin: {
                        top: `${MARGIN.top}mm`,
                        right: `${MARGIN.side}mm`,
                        bottom: `${MARGIN.bottom}mm`,
                        left: `${MARGIN.side}mm`,
                    },
                    scale: 0.8,
                    displayHeaderFooter: true,
                    headerTemplate: buildHeaderTemplate(title, folderName),
                    footerTemplate: buildFooterTemplate(),
                });

                logger.info(
                    { requestId },
                    `Finished in ${Math.round(performance.now() - started)}ms`,
                );

                return pdf;
            }),
            60_000,
            "PDF generation timed out.",
        );

        // Make "etonnote" in the footer clickable
        return addFooterLink(rawPdf);
    }

    private static async navigate(page: Page, url: string) {
        const response = await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: 30000,
        });

        if (!response) {
            throw new Error("No response received");
        }

        if (!response.ok()) {
            throw new Error(`Navigation failed (${response.status()})`);
        }

        await page.waitForFunction(() => window.__PDF_READY__ === true, {
            timeout: 30_000,
        });
    }
}
