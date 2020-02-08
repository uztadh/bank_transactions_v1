# SOLUTION FOR BANK TRANSACTIONS CODING CHALLENGE

## Setting up Postgres

The following are the table definitions underlying the bank's data:

```sql
create table balances (
    account_nr serial primary key,
    balance numeric(12,2)
);

create table transactions(
    reference serial primary key,
    amount numeric(12,2),
    account int references balances not null
);
```

Additional constraints, such as on the minimum balance allowed, could (and should) be added, but again I'm working with the assumption that the database layer is off-limits for the API rewrite.

Just to have some data to play around with, I inserted a couple of accounts as follows:

```sql
insert into balances(balance)
values (100),(100),(100);
```

The next step is setting up the connection from node.js to postgres. The node-postgres/[`pg`](https://node-postgres.com/) library is perfect client library for this, since it's very minimal but also flexible given that it supports both callbacks and async/await. I followed the project structure that the node-postgres documentation suggests [here](https://node-postgres.com/guides/project-structure) by having a _central_ file for connection and configuration

Since I intended to use async/await style through out the rest of the program, it sufficed to export data-access functions that returned promises. `query` isn't used at all so far but it doesn't hurt to have it there. `getClient` though is key, since each bank transfer transaction requires its own client instance; due to the way postgres handles transactions, using a connection pool will not work

```javascript
const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
    query,
    getClient
};
```

Worth noting is that `pg` explicitly avoids type-conversions in cases where even slight innacuracies may be introduced instead returning the values as strings. Such is the case with the `numeric` datatype which is used to store account balances in the `balances` table. The `pg` library though provides an interface through which we can define our own data-type conversions. Since the program is going to be checking whether a sender's balance is above a certain threshold before approving the transfer, type conversion for `numeric` values is added:

```javascript
//parse numeric(12,2) from db to js floats
types.setTypeParser(1700, val => parseFloat(val));
```

For further details as to how and why the data-type conversion is set as so, check `node-pg-types` documentation [here](https://github.com/brianc/node-pg-types)

Finally, also checked in all the sql files (under the `db/sql/` directory) relevant to the database. This serves two purposes: one, to enable other programmers to recreate the database layer; two, for quick documentation. Using them for documentation though without keeping the files up to date can lead to innacuracies whereby a change is made to the db (e.g. adding a collumn to a table), but that is not reflected in the sql files.

## Overview: The SQL bank transfer procedure

The `runTransferSQL` handles all the bank transfer '_sql stuff_'. From a caller's perspective, it takes in the transfer details consisting of `from`, `to` and `amount` details, and returns either the transaction payload if successful, or throws an error.

In future, `runTransferSQL` should only handle transfer sql stuff and leave the construction of the transaction result payload to some other function particularly when the payload starts being more complex, nested and involving queries tangential to the actual money transfer.

As for the errors, we'll talk more about how they are structured later on but for now, there are two kinds of errors that `runTransferSQL` can throw: pre-defined client errors (eg those arising from the user's input) and non-user errors (such as the database connection failing for some reason mid-transaction).

And now, for the actual code. Let's start with the `runTransferSQL` signature:

```javascript
//either resolves to id of transfer if successful or errors out
const runTransferSQL = ({ from, to, amount }) => async client => {
    // ... function body
};
```

The function is curried. First, the object containing the transfer details(from, to & amount) is fixed and an async function expecting the client (via which it sends the sql commands) is then returned.

Let's see why. The first version of this function was responsible for both creating an instance of `client` , releasing it, watching out for any errors arising, on top of all the 'sql bank transfer stuff'. As such, it was quite tangled given that it's taking on multiple concerns. Therefore, on rewrite, the intention to have `runTransferSQL` be limited to the 'sql transfer stuff' and have some other part of the program manage the `client` instance including any `client` related errors arising.

Here's the line where `runTransferSQL` is invoked:

```javascript
checkClientErrs(runTransferSQL(details));
```

The transfer `details` are fixed and then `checkClientErrs` is responsible for invoking the function that is returned.

Let's go to `checkClientErrs`. It's short enough that the entire code can be included:

```javascript
const checkClientErrs = runSQL => client =>
    new Promise((resolve, reject) => {
        client.on("error", reject);
        runSQL(client)
            .then(resolve)
            .catch(reject)
            .finally(() => client.release());
    });
```

As you can see, `checkClientErrs` too is curried. This isn't as necessary as in the case of `runTransferSQL` but it's convenient for time being. The first argument then ends up being the function returned from `runTransferSQL` and later on, the `client` is fixed. Right now it might seem jambled but, spoiler alert, when we get to the `handleTransfer` function that pipes every async thing together, hopefully it will all make sense.

On `checkClientErrs`, it could set up the `client` instance by itself and in future rewrites, I might end up having it as so. But for now, I intended for it to have one task and that is to watch out for errors arising from the `client` instance. Well, it does have another task which is to release the `client` regardless of whether `runSQL` throws an error or is successful, and I haven't yet come up with a way of delegating this elsewhere.

Another benefit for currying `runTransferSQL` in the way I did is that, when `checkClientErrs` invokes it, `checkClientErrs` doesn't have to care about which arguments are passed to `runSQL` beyond a `client` instance. Therefore, `checkClientErrs` can potentially be reused with other `runSQL` functions that encapsulate SQL transactions. `checkClientErrs` returns a promise, this will make sense once we get to the function that brings in everything together, `handleTransfer`.

## Details: The SQL bank transfer procedure

Now, back to `runTransferSQL`. The transaction isolation level used is **read committed**. Even though this is the default in Postgres, it's made explicit to make the intentions and assumptions regarding the entire procedure much clearer to whoever reads the code.

From a glance, `runTransferSQL` checks whether the sender's balance is sufficient; it then deducts the amount from their account and adds to the receiver's account. Finally, it records the transaction by inserting into the `transactions` table.

With regards to concurrency issues, while a lock is used on the sender's row (for reasons explained below), I don't think the receiver's row needs to be locked explicitly through out the entirety of the transaction. As per the postgres documentation, the guarantees the _read committed_ isolation level provides ensure that updates to the selected rows only use the 'latest' committed balance values and during the updates, other similar concurrent updates wait for our transaction to either commit and rollback.

For the lock used; Unless absolutely necessary, such as in [this](https://layerci.com/blog/postgres-is-the-answer/) case, I'm not a big fan of using locks in postgres. I find them more complex and I always have that nagging feeling that I've made some subtle concurrency error somewhere. That being said, I've used one in `runTransferSQL`, half-heartedly. This is so that errors arising from an invalid sender id can be distinguished from errors arising from an insufficient balance. If it were up to me, I'd push such a check to the database level (using a _plpgsql_ function) but as stated in the introduction, I'm working under the assumption that the database layer is off-limits. A better solution though is to assume that some other part of the application (eg the user authorization middleware) will ensure that the _sender's id_ is valid and once that's in place, the `select ... for update` query can be removed.

## Debouncing transfer calls

One of the requirements is that to put checks in place for whenever customers tap on the "pay/transfer" button more than once by accident. A quick solution I opted for is to use _debouncing_. I got the idea from front-end development whereby _debouncing_ logic is used to prevent an event-handler such as those listening for scroll movements from being called too many times within a narrow time-frame thus leading to performance issues.

Before getting into how the _debouncing_ is implemented, it's worth pointing out that I don't think this is the right place to have the debouncing logic. If anything, with having it at the API route handler, it's more of a throttle. However, given the scope of the exercise, I included it here for the sake of completeness.

In my opinion, debouncing transfer requests should be handled at two levels, the database level and the UI level. First, the database model should be designed such that a transfer is separated further into two parts: the transfer _request_ and the transfer confirmation. Regardless of how many transfer requests are sent in, e.g. from the user mistakenly doing so, a user can only confirm one transfer request at a time. The rest of the unconfirmed requests are then timed out and the user has to do a separate transfer request, if they really were being deliberate. Additionally, confirming a transfer request is made idempotent in that a user can confirm the same request multiple times but it's only processed once. This is the approach I use in my second version of the solution where I assume I can also rewrite the database models for the bank. Secondly, debouncing ought to be handled also at the UI level. The UI should make it explicit to a user that they are attempting to send in the same transfer multiple times.

Now, for the implementation. The debouncing mainly relies on a specialized cache. This cache should supply a procedure `checkSert`, which atomically checks whether a key is present and if not, inserts the key with the given expiry time. The underlying cache can be _anything_, even redis but for the time being, the standard library `Set` is used. When a transfer comes in, it's hashed and the hash is _checkSerted_. If it passes the check, then it's assumed that a previous equivalent transfer has just been sent in in let's say the past 5 seconds. Therefore this transfer is debounced and the user is informed of the same. Since the transfer request payload isn't too large for now, the hashing function `getTXKey` simply appends the strings. Overall, we end up with the following. Note that the `checkSert` method should be asynchronous/ return a promise both for performance reasons and since it'll be composed with other asynchronous functions:

```javascript
const getTXKey = (from, to, amount) => `${from}!${to}!${amount}`;

const debounceTx = (cache => ({ from, to, amount }) => {
    const txKey = getTXKey(from, to, amount);
    const timeoutMs = 5000;
    return cache.checkSert(txKey, timeoutMs);
})(getCache());
```

## Handling errors in `handleTransfer`

On errors: there are two kinds of errors to handle, errors arising from user's input, and what I can call 'internal errors' e.g db connection fails mid-transaction or I made a coding mistake somewhere. As much as possible, I want to avoid exposing internal errors to users, one for security reasons and two, for users, such information is not helpful or actionable.

When a user errror is instantiated, a `isClientError` property set to true is added. Therefore, all `handleTxError` has to do is to check the value of this property and if it's falsey, the error is overwritten with a generic 'internal error' object:

```javascript

const handleTxError = err => {    // ...    let errMessage = err.isClientError ? err.message : "Internal error";    return Promise.resolve({ error: errMessage });};
```

## Bringing everything together: `handleTransfer`

Finally, the raison d'être, `handleTransfer`.

I've detailed `checkClientErrs`, `runTransferSQL` and `debounceTx`. What `handleTransfer` does is compose all these functions together. In addition, it uses `getClient` to instantiate a client for the transaction and `handleTxError` to catch and swallow any error arising through out the entire endeavour. The caller of the function should not have to worry about handling any error: they either get a payload object indicating the transfer is successful, or a payload object that indicates an error occured and which kind of error it was. The caller can then serialize the object into JSON and send it to the user. That's all there is to it!

```javascript
const handleTransfer = details => {
    return debounceTx(details)
        .then(db.getClient)
        .then(checkClientErrs(runTransferSQL(details)))
        .catch(handleTxError);
};
```

REFERENCES

1. https://clakech.github.io/cls-hooked-sample/

https://www.npmjs.com/package/autocannon

NodeJS logging made right, cls, winston, pino: https://itnext.io/nodejs-logging-made-right-117a19e8b4ce

Assign ‘TransactionId’ to each log statement: https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/production/assigntransactionid.md
