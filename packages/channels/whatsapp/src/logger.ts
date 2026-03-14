import { createLogger, format, transports } from "winston";

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length
        ? " " + JSON.stringify(meta)
        : "";
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    }),
  ),
  transports: [new transports.Console()],
});
