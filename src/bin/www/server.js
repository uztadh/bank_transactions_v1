const http = require("http");
const { app } = require("../../app");
const errorManagement = require("../../lib/errorManagement");

const port = 3000;
app.set("port", port);

http.createServer(app).listen(app.get("port"), () => {
    console.log(`app started on port ${app.get("port")}`);
});

process.on("unhandledRejection", err => {
    //fallback to uncaughtException handler
    throw err;
});

process.on("uncaughtException", err => {
    errorManagement.handleError(err).then(
        () => {
            if (errorManagement.isUntrustedError(err)) process.exit(1);
        },
        //shouldnt reach here, handle error should 'absorb' all errors
        () => process.exit(1)
    );
});
