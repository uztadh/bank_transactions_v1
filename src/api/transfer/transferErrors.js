const clientErr = err => {
    err.isUserError = true;
    err.userErrorCode = err.message;
    return err;
};

/*
function UserError(errorCode) {
    Error.call(this);
    if (!userErrorCodes.has(errorCode) ) errorCode = userErrorCodes.
    this.code = errorCode;
    this.isUserError = true;
}
UserError.prototype = Object.create(Error.prototype);
UserError.prototype.constructor = UserError;

const userErrorCodes = new Map({
    insufficientFunds: "Insufficient_Funds",
    invalidSender: "Invalid_Sender",
    invalidReceiver: "Invalid_Receiver",
    debounceRequest: "Debounce_Request"
})
*/

const InsufficientFunds = clientErr(new Error("Insufficient_Funds"));
const InvalidSender = clientErr(new Error("Invalid_Sender"));
const InvalidReceiver = clientErr(new Error("Invalid_Receiver"));
const DebounceReq = clientErr(new Error("Debounce_Request"));

module.exports.clientErrs = {
    InsufficientFunds,
    InvalidSender,
    InvalidReceiver,
    DebounceReq
};
