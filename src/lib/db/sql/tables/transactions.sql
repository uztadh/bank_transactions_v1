create table transactions(
    reference serial primary key,
    amount numeric(12,2),
    account int references balances not null
);