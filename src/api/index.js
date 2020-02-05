const express = require("express");
const { transferControllers } = require("./transfer");
const api = express.Router();

const asyncRouteWrapper = routerFn => (req, res, next) =>
    Promise.resolve(routerFn(req, res)).catch(next);

api.use(express.json());

api.post(
    "/transfer",
    asyncRouteWrapper(async ({ body: tranferDetails } = {}, res) => {
        const resObj = await transferControllers.handleTransfer(tranferDetails);
        res.json(resObj);
    })
);

module.exports = { api };
