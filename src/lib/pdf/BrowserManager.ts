import puppeteer, { Browser, BrowserContext, LaunchOptions } from "puppeteer";
import { logger } from "../logger";

export class BrowserManager {
    private static browser: Browser | null = null;
    private static browserPromise: Promise<Browser> | null = null;

    private static getLaunchOptions(): LaunchOptions {
        return {
            headless: true,
            timeout: 15000,
            args: ['--no-sandbox'],
        };
    }

    private static async launch(): Promise<Browser> {
        logger.info("Launching a new browser.");
        const browser = await puppeteer.launch(this.getLaunchOptions());

        browser.on("disconnected", () => {
            this.browser = null;
            this.browserPromise = null;
        });

        return browser;
    }

    private static async getBrowser(): Promise<Browser> {
        if (this.browser) {
            logger.info("Cached Browser Found. Using it.");
            return this.browser;
        }

        if (this.browserPromise) return this.browserPromise;

        this.browserPromise = this.launch();

        try {
            this.browser = await this.browserPromise;
            return this.browser;
        } finally {
            this.browserPromise = null;
        }
    }

    static async withContext<T>(fn: (context: BrowserContext) => Promise<T>) {
        const browser = await this.getBrowser();
        const context = await browser.createBrowserContext();
        logger.info("New context created");

        try {
            return await fn(context);
        } finally {
            logger.info("Context closed");
            await context.close();
        }
    }

    static async shutdown() {
        if (!this.browser) return;
        logger.info("Shutting down the browser");

        await this.browser.close();

        this.browser = null;
        this.browserPromise = null;
    }
}
