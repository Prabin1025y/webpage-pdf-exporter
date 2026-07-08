import { LoggerOptions } from "pino";

const isDev = process.env.NODE_ENV === "development";

export const loggerConfig: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",

    transport: isDev
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  translateTime: "HH:MM:ss",
                  ignore: "pid,hostname",
              },
          }
        : undefined,
};