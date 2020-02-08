const express = require("express");
const { api: apiRouter } = require("./api");
const { loggerMiddleware, traceMiddleware } = require("./lib/logger");
const errorManagement = require("./lib/errorManagement");

const app = express();

app.use(traceMiddleware);
app.use(loggerMiddleware);
app.use(apiRouter);
app.use((req, res) => {
    res.sendStatus(404);
});

app.use(async (err, req, res, next) => {
    // first send response, then delegate error handling
    //to centralized error handling
    res.sendStatus(500);
    errorManagement.handleError(err);
});

module.exports = { app };
