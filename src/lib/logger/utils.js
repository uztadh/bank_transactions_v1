const getReqResDetails = (req, res) => ({
    connection: {
        address: req.connection.remoteAddress,
        port: req.connection.remotePort
    },
    req: {
        method: req.method,
        url: req.path,
        https: req.secure,
        headers: req.headers
    },
    res: {
        statusCode: res.statusCode,
        headers: res.getHeaders()
    }
});

module.exports = { getReqResDetails };
