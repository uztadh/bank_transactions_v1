const db = require("./db");

const ErrInternalError = new Error("Internal error");

const ErrInsufficientFunds = new Error("Insufficient funds");
const ErrInvalidSender = new Error("Invalid Sender account number");
const ErrInvalidReceiver = new Error("Invalid Receiver account number");
const ErrDebounceReq = new Error("Repeated transfer");
const ErrTestError = new Error("Sample generic error for dev only");

const clientErrors = new Set([
    ErrInsufficientFunds,
    ErrInvalidSender,
    ErrInvalidReceiver,
    ErrDebounceReq,
    ErrTestError
]);

const timer = ms =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

//either resolves to id of transfer if successful or errors out
const dbTransfer = async (client, from, to, amount) => {
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

        //commit
        await client.query("commit");
        return {
            id: resInsertTx.rows[0].reference, //tx id for sender
            balance: resUpdateSender.rows[0].balance //senders balance after transfer
        };
    } catch (err) {
        await client.query("rollback");
        throw err;
    }
};
const getCache = (timeoutMs = 1000) => {
    let set = new Set();
    const add = key => {
        set.add(key);
        setTimeout(() => set.delete(key), timeoutMs);
    };
    const has = key => set.has(key);
    return { add, has };
};

const getTXKey = (from, to, amount) => `${from}!${to}!${amount}`;

const debounceTx = (cache => (from, to, amount) =>
    new Promise((resolve, reject) => {
        const txKey = getTXKey(from, to, amount);
        if (cache.has(txKey)) reject(ErrDebounceReq);
        else {
            cache.add(txKey);
            resolve();
        }
    }))(getCache());

const handleTransfer = (from, to, amount) => {
    return debounceTx(from, to, amount)
        .then(db.getClient)
        .then(
            client =>
                new Promise((resolve, reject) => {
                    client.on("error", reject);
                    dbTransfer(client, from, to, amount)
                        .then(resolve)
                        .catch(reject)
                        .finally(() => client.release());
                })
        )
        .then(({ id, balance }) =>
            Promise.resolve({
                id,
                from: { id: from, balance },
                to: { id: to },
                transfered: amount
            })
        )
        .catch(err => {
            //log error
            let errMessage = clientErrors.has(err)
                ? err.message
                : ErrInternalError.message;
            return Promise.resolve({ error: errMessage });
        });
};

const main = async () => {
    let res = await Promise.all(
        Array(5)
            .fill([3, 1, 10])
            .map(args => handleTransfer(...args))
    );
    console.log(res);
};

main().catch(err => {
    console.log("MAIN_ERR");
    console.error(err);
});
