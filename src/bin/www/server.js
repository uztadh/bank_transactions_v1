const http = require("http");
const { app } = require("../../app");

const port = 3000;
app.set("port", port);

http.createServer(app).listen(app.get("port"), () => {
    console.log(`app started on port ${app.get("port")}`);
});
