const { Pool, types } = require("pg");

//parse numeric(12,2) from db to js floats
types.setTypeParser(1700, val => parseFloat(val));

const pool = new Pool({
    host: "localhost",
    database: "bank_transfer_v1",
    port: 5432
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
    query,
    getClient
};
