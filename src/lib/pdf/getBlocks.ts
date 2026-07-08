import { pool } from "../db";

export async function getBlocksFromNoteId(noteId: string) {
    const result = await pool.query(
        `
            SELECT * FROM "Block" WHERE "noteId" = $1
        `,
        [noteId],
    );

    const blocks = result.rows;

    const blocksSorted = blocks.sort((a, b) => a.order - b.order);

    return blocksSorted;
}
