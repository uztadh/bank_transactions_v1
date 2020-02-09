require("dotenv").config();
const { Pool, types } = require("pg");

//parse numeric(12,2) from db to js floats
types.setTypeParser(1700, val => parseFloat(val));

const isProduction = process.env.NODE_ENV === "production";

const pgConnString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

const pool = new Pool({
    connectionString: isProduction ? process.env.DATABASE_URL : pgConnString,
    ssl: isProduction
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
    query,
    getClient
};
