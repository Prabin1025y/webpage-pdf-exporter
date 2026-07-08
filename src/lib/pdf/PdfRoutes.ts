export class PdfRoutes {
    static note(noteId: string) {
        return new URL(
            `/internal/pdf/note/${noteId}`,
            process.env.APP_URL,
        ).toString();
    }
}
