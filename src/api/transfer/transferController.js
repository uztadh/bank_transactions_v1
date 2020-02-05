const db = require("../../lib/db");
const { debounceTx, prTrace } = require("./transferUtils");
const { insertTransfer } = require("./transferDAL");

const handleTransfer = (() => {
    const checkDBClientErrs = runSQL => client =>
        new Promise((resolve, reject) => {
            client.on("error", reject);
            runSQL(client)
                .then(resolve)
                .catch(reject)
                .finally(() => client.release());
        });

    const handleTransferErr = err => {
        if (!err.isTransferErr) console.error(err);
        let error = err.isTransferErr ? err.transferErrCode : "InternalError";
        return Promise.resolve({ error });
    };

    return details =>
        debounceTx(details)
            .then(db.getClient)
            .then(checkDBClientErrs(insertTransfer(details)))
            .catch(handleTransferErr);
})();

module.exports = { handleTransfer };
