"use strict";
const pino = require("pino");
const cls = require("cls-hooked");
const cuid = require("cuid");
const { getReqResDetails } = require("./utils");

let logger = pino({
    prettyPrint: true,
    mixin() {
        const ns = cls.getNamespace("app");
        return { traceID: ns.get("traceID") };
    }
});

if (process.env.NODE_ENV !== "production") {
    logger.level = "debug";
}

const traceMiddleware = (() => {
    const ns = cls.createNamespace("app");
    return (req, res, next) => {
        ns.bindEmitter(req);
        ns.bindEmitter(res);

        ns.run(() => {
            const traceID = cuid();
            ns.set("traceID", traceID);
            next();
        });
    };
})();

let loggerMiddleware = (req, res, next) => {
    const start = Date.now();
    const afterResponse = () => {
        res.removeListener("finish", afterResponse);
        res.removeListener("close", afterResponse);
        const log = {
            timeReqReceived: start,
            //...getReqResDetails(req, res),
            responseTime: Date.now() - start
        };
        logger.info(log);
    };

    res.on("finish", afterResponse);
    res.on("close", afterResponse);

    next();
};

module.exports = { logger, loggerMiddleware, traceMiddleware };
