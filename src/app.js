const express = require("express");
const logger = require("morgan");
const { api: apiRouter } = require("./api");
const { handleError } = require("./lib/errors");

const app = express();

app.use(logger("short"));

app.use(apiRouter);

app.use(async (err, req, res, next) => {
    const isOperationalError = await handleError(err);
    if (!isOperationalError) {
        next(err);
    }
});

module.exports = { app };
