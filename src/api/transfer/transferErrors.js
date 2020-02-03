const { markAsOperationalError } = require("../../lib/errors");

function TransferError(transferErrCode) {
    Error.call(this);
    //Error.captureStackTrace(this);
    this.isTransferErr = true;
    this.transferErrCode = transferErrCode;
}
TransferError.prototype = Object.create(Error.prototype);
TransferError.prototype.constructor = TransferError;

const transferErrCodes = [
    "InsufficientFunds",
    "InvalidSender",
    "InvalidReceiver",
    "DebounceRequest"
];
const transferErrors = Object.freeze(
    transferErrCodes.reduce(
        (acc, errCode) => ({
            ...acc,
            [errCode]: markAsOperationalError(new TransferError(errCode))
        }),
        Object.create(null)
    )
);

module.exports = {
    transferErrors
};
