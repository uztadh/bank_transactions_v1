const { logger } = require("../logger");

const handleError = err => logger.error(err);

/*
operational errors, marked as so, are 'trusted errors'
ie errors already sort of expected to occur, logging suffices
logging ought to suffice.
For further info: https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/errorhandling/operationalvsprogrammererror.md
*/
const markAsOperationalError = err => {
    err.isOperationalError = true;
    return err;
};

const isUntrustedError = err => !err.isOperationalError;

module.exports = { handleError, markAsOperationalError, isUntrustedError };
