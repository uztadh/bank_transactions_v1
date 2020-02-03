const db = require("../../lib/db");
const { debounceTx } = require("./transferUtils");
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

    const handleErr = err => {
        if (!err.isClientError) console.error(err);
        let error = err.isUserError ? err.userErrorCode : "Internal_Error";
        return Promise.resolve({ error });
    };

    return details =>
        debounceTx(details)
            .then(db.getClient)
            .then(checkDBClientErrs(insertTransfer(details)))
            .catch(handleErr);
})();

module.exports = { handleTransfer };
