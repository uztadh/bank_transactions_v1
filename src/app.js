const express = require("express");
const { api: apiRouter } = require("./api");
const { loggerMiddleware } = require("./lib/logger");
const errorManagement = require("./lib/errorManagement");

const app = express();

app.use(loggerMiddleware);

/*
app.use(function(req, res, next) {
    const afterResponse = () => {
        console.log(res.status());
        res.removeListener("finish", afterResponse);
        res.removeListener("close", afterResponse);
        // action after response
    };

    res.on("finish", afterResponse);
    res.on("close", afterResponse);

    // action before request
    // eventually calling `next()`
    next();
});*/

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
