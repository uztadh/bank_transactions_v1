const db = require("./db");

const clientErr = err => {
    err.isClientError = true;
    return err;
};

const ErrInsufficientFunds = clientErr(new Error("Insufficient funds"));
const ErrInvalidSender = clientErr(new Error("Invalid Sender account nr"));
const ErrInvalidReceiver = clientErr(new Error("Invalid Receiver account nr"));
const ErrDebounceReq = clientErr(new Error("Repeated transfer"));

const timer = ms =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

//either resolves to id of transfer if successful or errors out
const runTransferSQL = ({ from, to, amount }) => async client => {
    if (from === to) throw ErrInvalidReceiver;
    const payload = {
        from: { id: from },
        to: { id: to },
        transfered: amount
    };
    try {
        await client.query("begin transaction isolation level read committed");

        //check sender has enough balance for transfer
        const resSenderCheck = await client.query(
            `select balance from balances 
            where account_nr = $1 for update`,
            [from]
        );
        if (!resSenderCheck.rows[0]) throw ErrInvalidSender;
        if (resSenderCheck.rows[0].balance < amount) throw ErrInsufficientFunds;

        //deduct from sender's account
        const resUpdateSender = await client.query(
            `update balances set balance = balance - $1 
            where account_nr = $2 and balance >= $1
            returning balance`,
            [amount, from]
        );
        payload.from.balance = resUpdateSender.rows[0].balance;

        //add to receiver's account
        const resUpdateReceiver = await client.query(
            `update balances set balance = balance + $1 
            where account_nr = $2 returning account_nr`,
            [amount, to]
        );
        if (!resUpdateReceiver.rows[0]) throw ErrInvalidReceiver;

        //record transaction
        const resInsertTx = await client.query(
            `insert into transactions(amount,account)
            values($1, $2) returning reference`,
            [amount, from]
        );
        payload.id = resInsertTx.rows[0].reference;

        //commit
        await client.query("commit");
        return payload;
    } catch (err) {
        await client.query("rollback");
        throw err;
    }
};
const getCache = (timeoutMs = 1000) => {
    let set = new Set();
    const checkSert = key =>
        new Promise((resolve, reject) => {
            if (set.has(key)) return reject(ErrDebounceReq);
            set.add(key);
            setTimeout(() => set.delete(key), timeoutMs);
            resolve();
        });
    return { checkSert };
};

const getTXKey = (from, to, amount) => `${from}!${to}!${amount}`;

const prTrace = label => val => {
    console.log(`${label}: ${val}`);
    return Promise.resolve(val);
};

const debounceTx = (cache => ({ from, to, amount }) => {
    const txKey = getTXKey(from, to, amount);
    return cache.checkSert(txKey);
})(getCache());

const handleTxError = err => {
    //log error
    let errMessage = err.isClientError ? err.message : "Internal error";
    return Promise.resolve({ error: errMessage });
};

const checkClientErrs = runSQL => client =>
    new Promise((resolve, reject) => {
        client.on("error", reject);
        runSQL(client)
            .then(resolve)
            .catch(reject)
            .finally(() => client.release());
    });

const handleTransfer = details => {
    return debounceTx(details)
        .then(db.getClient)
        .then(checkClientErrs(runTransferSQL(details)))
        .catch(handleTxError);
};

const main = async () => {
    let res = await Promise.all(
        Array(3)
            .fill([{ from: 1, to: 1, amount: 10 }])
            .map(args => handleTransfer(...args))
    );
    console.log(res);
};

main().catch(err => {
    console.log("MAIN_ERR");
    console.error(err);
});
