const express = require("express");
const logger = require("morgan");
const { api: apiRouter } = require("./api");
const errorManagement = require("./lib/errorManagement");

const app = express();

app.use(logger("short"));

app.use(apiRouter);

app.use((req, res) => {
    res.status(404);
    res.send("Not Found");
});

app.use(async (err, req, res, next) => {
    // first send response, then delegate error handling
    //to centralized error handling
    res.status(500);
    res.send("Error");
    await errorManagement.handleError(err);
});

module.exports = { app };
