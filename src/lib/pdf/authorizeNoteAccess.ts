import { pool } from "../db";
import { ForbiddenError } from "../errors";

export async function authorizeNoteAccess(userId: string, noteId: string) {

    const result = await pool.query(`
            SELECT * 
            FROM "Note"
            WHERE "authorId" = $1 AND id = $2;
        `,[userId, noteId])

    const note = result.rows[0] || null;

    const authorized = !!note;

    if (!authorized) throw new ForbiddenError("Forbidden");

    return note;
}
