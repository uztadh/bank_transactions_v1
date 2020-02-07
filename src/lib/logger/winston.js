const { createLogger, format, transports } = require("winston");
const morgan = require("morgan");
const { combine, timestamp, json } = format;

const getLoggerOpts = () => ({
    transports: [new transports.Console({ handleExceptions: false })],
    // fallback opts
    level: "info",
    format: combine(timestamp(), json()),
    defaultMeta: { service: "user-service" },
    exitOnError: false
});

const logger = createLogger(getLoggerOpts());

if (process.env.NODE_ENV !== "production") {
    logger.configure({
        ...getLoggerOpts(),
        level: "debug"
    });
}

logger.stream = {
    write: message => logger.info(message)
};

const loggerMiddleware = morgan("combined", { stream: logger.stream });

module.exports = { logger, loggerMiddleware };
