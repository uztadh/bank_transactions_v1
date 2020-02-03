const handleError = async err => {
    console.error(err);
    // await logger.logError(err);
};

const markAsOperationalError = err => {
    err.isOperationalError = true;
    return err;
};

module.exports = { handleError, markAsOperationalError };
