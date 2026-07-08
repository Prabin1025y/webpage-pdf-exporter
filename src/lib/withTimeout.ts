export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message: string = "Operation timed out.",
): Promise<T> {
    let timer: NodeJS.Timeout;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(message));
                }, ms);
            }),
        ]);
    } finally {
        clearTimeout(timer!);
    }
}
