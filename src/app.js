const express = require("express");
const { api: apiRouter } = require("./api");
const { loggerMiddleware, traceMiddleware } = require("./lib/logger");
const errorManagement = require("./lib/errorManagement");

const app = express();

app.disable("x-powered-by");

app.use(traceMiddleware);
app.use(loggerMiddleware);
app.use(apiRouter);

//404 handler
app.use((req, res) => {
    res.sendStatus(404);
});

//err handler
app.use(async (err, req, res, next) => {
    res.sendStatus(500);
    errorManagement.handleError(err);
});

module.exports = { app };
