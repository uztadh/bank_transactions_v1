const pino = require("pino");
const expressPino = require("express-pino-logger");

const logger = pino({
    prettyPrint: true
});

if (process.env.NODE_ENV !== "production") {
    logger.level = "debug";
}

const loggerMiddleware = expressPino({ logger });

module.exports = { logger, loggerMiddleware };
