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

    //on errors resulting from transfer details eg insufficient balance
    //users are informed, otherwise, the error is thrown and either
    //handled by middleware or centrally
    const handleTransferErr = err => {
        if (err.isTransferErr)
            return Promise.resolve({ transfer_error: err.transferErrCode });
        else throw err;
    };

    return details =>
        debounceTx(details)
            .then(db.getClient)
            .then(checkDBClientErrs(insertTransfer(details)))
            .catch(handleTransferErr);
})();

module.exports = { handleTransfer };
