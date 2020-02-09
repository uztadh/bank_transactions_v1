const express = require("express");
const { logger } = require("../lib/logger");
const { transferControllers } = require("./transfer");
const api = express.Router();

const asyncRouteWrapper = routerFn => (req, res, next) =>
    Promise.resolve(routerFn(req, res)).catch(next);

const parseJSONMiddleware = (() => {
    const parseJSON = express.json({
        strict: true,
        limit: "200b"
    });
    return (req, res, next) =>
        parseJSON(req, res, err => (err ? res.sendStatus(400) : next()));
})();

api.use(parseJSONMiddleware);

api.post(
    "/transfer",
    asyncRouteWrapper(async (req, res) => {
        const transferDetails = req.body;
        const result = await transferControllers.handleTransfer(
            transferDetails
        );
        if (result.transferError) res.status(400);
        res.json(result);
    })
);

module.exports = { api };
