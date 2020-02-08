const http = require("http");
const { app } = require("../../app");
const { logger } = require("../../lib/logger");
const errorManagement = require("../../lib/errorManagement");

const port = process.env.PORT || 3000;
app.set("port", port);

http.createServer(app).listen(app.get("port"), () => {
    logger.info(`app started on port ${app.get("port")}`);
});

process.on("unhandledRejection", err => {
    //fallback to uncaughtException handler
    throw err;
});

process.on("uncaughtException", err => {
    errorManagement.handleError(err);
    if (errorManagement.isUntrustedError(err)) process.exit(1);
});
