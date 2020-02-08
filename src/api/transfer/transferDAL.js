const { transferErrors } = require("./transferErrors");
const { logger } = require("../../lib/logger");

//either resolves to id of transfer if successful or errors out
// caller should ensure from, to, amount are non null, non undefined
const insertTransfer = ({ from, to, amount }) => async client => {
    if (from === to) throw transferErrors.InvalidReceiver;
    const payload = {
        from: { id: from },
        to: { id: to },
        transfered: amount
    };
    try {
        logger.debug("beginning tx");
        await client.query("begin transaction isolation level read committed");

        logger.debug("checking amount");
        //check sender has enough balance for transfer
        const resSenderCheck = await client.query(
            `select balance from balances 
            where account_nr = $1 for update`,
            [from]
        );
        if (!resSenderCheck.rows[0]) throw transferErrors.InvalidSender;
        if (resSenderCheck.rows[0].balance < amount)
            throw transferErrors.InsufficientFunds;
        logger.debug("deducting from sender");
        //deduct from sender's account
        const resUpdateSender = await client.query(
            `update balances set balance = balance - $1 
            where account_nr = $2 and balance >= $1
            returning balance`,
            [amount, from]
        );
        payload.from.balance = resUpdateSender.rows[0].balance;

        logger.debug("adding to receiver");
        //add to receiver's account
        const resUpdateReceiver = await client.query(
            `update balances set balance = balance + $1 
            where account_nr = $2 returning account_nr`,
            [amount, to]
        );
        if (!resUpdateReceiver.rows[0]) throw transferErrors.InvalidReceiver;
        logger.debug("recording transaction");
        //record transaction
        const resInsertTx = await client.query(
            `insert into transactions(amount,account)
            values($1, $2) returning reference`,
            [amount, from]
        );
        payload.id = resInsertTx.rows[0].reference;

        //commit
        await client.query("commit");
        logger.debug("commited transaction");
        return payload;
    } catch (err) {
        await client.query("rollback");
        throw err;
    }
};

module.exports = { insertTransfer };
