# SOLUTION FOR NAMSHI BANK TRANSACTIONS CODING CHALLENGE

challenge description [link](https://github.com/namshi/coding-challenges/blob/master/transactions-at-the-bank.md)

1. add express

2. document what's there so far

3. testing

4. refactor cache , debounce

5. add best practices



## Setting up postgres

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



Just to have some data to play around with, I inserted a couple of accouns as follows:

```sql
insert into balances(balance)
values (100),(100),(100);
```

The next step is setting up the connection from node.js to postgres. The node-postgres/[`pg`](https://node-postgres.com/) library is perfect client library for this, since it's very minimal but also flexible given that it supports both callbacks and async/await.



I followed the project structure that  the node-postgres documentation suggests [here](https://node-postgres.com/guides/project-structure) by having a *central* file through which all the database interactions will go through. It mainly handles connecting to postgres and setting up the functions for other parts of the program to use when interacting with postgres. 

For starters, I hardcoded the db connection config parameters in the `db/index.js`:  this is changed later on:

```javascript
const pool = new Pool({
    host: "localhost",
    database: "bank_transfer_v1",
    port: 5432
});
```



Since I intended to use async/await style through out the rest of the program, it sufficed to export data-access functions that returned promises. `query` isn't used at all so far but it doesn't hurt to have it there. `getClient` though is key, since each bank transfer transaction requires its own client instance and due to the way postgres handles transactions, using a connection pool will not work

```javascript
const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
    query,
    getClient
};

```



Worth noting is that  `pg` explicitly avoids type-conversions in cases where even slight innacuracies may be introduced instead returning the values as strings. Such is the case with the `numeric` datatype which is used to store account balances in the `balances` table. The `pg` library though provides an interface through which we can define our own data-type conversions. Since the program is going to be checking whether a sender's balance is above a certain threshold before approving the transfer, type conversion for `numeric` values is added:

```javascript
//parse numeric(12,2) from db to js floats
types.setTypeParser(1700, val => parseFloat(val));
```

For further details as to how and why the data-type conversion is set as so, check `node-pg-types` documentation  [here](https://github.com/brianc/node-pg-types)



Finally, also checked in all the sql files (under the `db/sql/` directory) relevant to the database. This serves two purposes: one, to enable other programmers to recreate the database layer; two, for quick documentation. Using them for documentation though without keeping the files up to date can lead to innacuracies whereby a change is made to the db (e.g. adding a collumn to a table), but that is not reflected in the sql files.



### Overview: The SQL bank transfer procedure

The `runTransferSQL` handles all the '*sql stuff*' required for carrying out a transfer. From a caller's perspective, it takes in the transfer details consisting of `from`, `to` and `amount` details, and returns either the transaction payload if successful, or throws an error.



In future, `runTransferSQL` should only handle transfer sql stuff and leave the construction of the transaction `payload` to some other function particularly when the payload starts being more complex, nested and involving queries tangential to the actual money transfer.



As for the errors, we'll talk more about how they are structured later on but for now, there are two kinds of errors that `runTransferSQL` can throw: pre-defined client errors (eg those arising from the user's input) and non-user errors (such as the database connection failing for some reason mid-transaction).



And now, for the actual code. Let's start with the `runTransferSQL` signature:

```javascript

//either resolves to id of transfer if successful or errors out
const runTransferSQL = ({ from, to, amount }) => async client => {
    // ... function body
};
```

The function is curried. First, the object containing the transfer details(from, to & amount) is fixed and an async function expecting the client (via which it sends the sql commands) is then returned. 



Let's see why. The first version of this function was responsible for both creating an instance of `client` , releasing it, watching out for any errors arising, on top of all the 'sql transfer stuff'. As such, it was quite tangled given that it's taking on multiple concerns. Therefore, on rewrite, the intention to have `runTransferSQL` be limited to the 'sql transfer stuff' and have some other part of the program manage the `client` instance including any `client` related errors arising.



Here's the line where `runTransferSQL` is invoked:

```javascript
checkClientErrs(runTransferSQL(details))
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

On  `checkClientErrs`, it could set up the `client` instance by itself and in future rewrites, I might end up having it as so. But for now, I intended for it to have one task and that is to watch out for errors arising from the `client` instance. Well, it does have another task which is to release the `client` regardless of whether `runSQL` throws an error or is successful, and I haven't yet come up with a way of delegating this elsewhere. 

Another benefit for currying `runTransferSQL` in the way I did is that, when `checkClientErrs` invokes it, `checkClientErrs` doesn't have to care about which arguments are passed to `runSQL` beyond a `client` instance. Therefore, `checkClientErrs` can potentially be reused with other `runSQL` functions that encapsulate SQL transactions. `checkClientErrs` returns a promise, this will make sense once we get to `handleTransfer`.

## Details: The SQL bank transfer procedure

Now, back to `runTransferSQL`. The transaction isolation used is **read committed**. Even though this is the default in Postgres, it's made explicit to make the intentions and assumptions regarding the entire procedure much clearer to whoever reads the code.



From a glance, `runTransferSQL` checks whether the sender's balance is sufficient; it then deducts the amount from their account and adds to the receiver's account. Finally, it records the transaction by inserting into the `transactions` table.



With regards to concurrency issues, while a lock is used on the sender's row (for reasons explained below), I don't think the receiver's row needs to be locked explicitly through out the entirety of the transaction - as per the postgres documentation, the guarantees the *read committed* isolation level provides ensure that updates to the selected rows only use the 'latest' committed balance values and during the updates, other similar concurrent updates wait for our transaction to either commit and rollback.



As for the lock used, unless absolutely necessary, such as in [this]() case, I'm not a big fan of using locks in postgres. I find them more complex and I always have that nagging feeling that I've made some subtle concurrency error somewhere. That being said, as you've seen, I've used one in `runTransferSQL`, half-heartedly. This is so that errors arising from an invalid sender id can be distinguished from errors arising from an insufficient balance. If it were up to me, I'd push such a check to the database level (using a *plpgsql* function) but as stated in the introduction, I'm working under the assumption that the database layer is off-limits. A better solution though is to assume that some other part of the application (eg the user authorization middleware) will ensure that the *sender's id* is valid and once that's in place, the `select ... for update` query can be removed.

## Debouncing transfer calls

One of the requirements is that there are checks in place mishaps arising from customers tapping on the "pay/transfer" button twice by accident. There are a lot of aspects to be considered. For example, how can one distinguish a deliberate 're-tap' from accidental ones.



A quick solution I opted for is to use *debouncing*. I got the idea from front-end development whereby *debouncing* logic is used to prevent an event-handler such as those 'listening' for scroll movements from being called too many times within a narrow time-frame thus leading to performance issues. 



Before getting into how the *debouncing* is implemented, it's worth pointing out that I don't think this is the right place to have the debouncing logic. If anything, it's more of an API calls throttle. However, given the scope of the exercise, I included it here for the sake of completeness. In my opinion, debouncing transfer requests should be handled at two levels: First, the database model should be designed such that a transfer is separated into two parts: the transfer *request* and the transfer confirmation. Regardless of how many transfer requests are sent in e.g. from the user mistakenly doing so, a user can only confirm one transfer request at a time. The rest of the unconfirmed requests are then timed out and the user has to do a separate transfer request if they really were being deliberate. Additionally, confirming a transfer request is made idempotent in that a user can confirm the same request multiple times but it's only processed once. This is the approach I use in my second version of the solution where I assume I can also rewrite the database models for the bank. Secondly,  debouncing ought to be implemented at the UI level. The UI should make it explicit to a user that they are attempting to send in the same transfer multiple times.



Now, for the implementation.



## Handling errors in `handleTransfer`

There are two kinds of errors to handle, errors arising from user's input and errors arising from my programming mishaps and, eg db connection. As much as possible, I want to avoid exposing internal errors to users, one for security reasons and two, for users such information is not actionable.





I'm not going to pretend that I arrived at this on the first try, in fact my first [attempt](https://github.com/nagamocha3000/bank_transactions_v1/commit/4fd01aa729b8bd7a5595a6ceffff4b8245e49cf4#diff-bd9c9dcd314f2d7df52935b3a6a4d504) was quite unwieldy. However, as I was working through Eric Eliott's Composing Software book, a particular section really gave me one of those Aha! moments - composing async functions into a sort of pipe. I already had some idea of what it would take to compose synchronous functions and how making each function pure simplifies reasoning and debugging, it just never occured to me to apply the same approach to async functions. Therefore I rewrote it here and there

The first version of `handleTransfer`



The great thing though is that I learned more about chaining promises from writing, rewriting and cleaning up `handleTransfer` than from weeks of reading from various blog posts.
