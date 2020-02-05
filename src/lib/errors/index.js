const handleError = async err => {
    console.error(err);
    // await logger.logError(err);
};

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

module.exports = { handleError, markAsOperationalError };
