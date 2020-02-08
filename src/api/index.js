const express = require("express");
const { logger } = require("../lib/logger");
const { transferControllers } = require("./transfer");
const api = express.Router();

const asyncRouteWrapper = routerFn => (req, res, next) =>
    Promise.resolve(routerFn(req, res)).catch(next);

const parseJSONMiddleware = (() => {
    const parseJSON = express.json({
        strict: true,
        limit: "1kb"
    });
    return (req, res, next) =>
        parseJSON(req, res, err => (err ? res.sendStatus(400) : next()));
})();

api.use(parseJSONMiddleware);

api.post(
    "/transfer",
    asyncRouteWrapper(async (req, res) => {
        const transferDetails = req.body;
        const resObj = await transferControllers.handleTransfer(
            transferDetails
        );
        res.json(resObj);
    })
);

module.exports = { api };
