export {};

declare global {
    interface Window {
        __PDF_READY__?: boolean;
    }
}