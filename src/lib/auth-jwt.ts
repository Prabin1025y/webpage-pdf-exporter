import { jwtVerify } from "jose";

export async function verifyInternalToken(token: string) {
    const secret = new TextEncoder().encode(process.env.JWT_INTERNAL_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload;
}
