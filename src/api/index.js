const express = require("express");
const { transferController } = require("./transfer");
const api = express.Router();

const asyncRouteWrapper = routerFn => (req, res, next) =>
    Promise.resolve(routerFn(req, res)).catch(next);

api.use(express.json());

api.post(
    "/transfer",
    asyncRouteWrapper(async (req, res) => {
        const { from, to, amount } = req.body;
        const transferDetails = { from, to, amount };
        const resObj = await transferController.handleTransfer(transferDetails);
        if (resObj.error) res.status(400);
        res.json(resObj);
    })
);

module.exports = { api };
