const { transferErrors } = require("./transferErrors");
const { logger } = require("../../lib/logger");

const timer = ms =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

//for debugging
const prTrace = label => val => {
    logger.debug(`${label}: ${val}`);
    return Promise.resolve(val);
};

const getCache = () => {
    let set = new Set();
    const checkSert = (key, expire) =>
        new Promise((resolve, reject) => {
            if (set.has(key)) return reject(transferErrors.DebounceRequest);
            set.add(key);
            setTimeout(() => set.delete(key), expire);
            resolve();
        });
    return { checkSert };
};

const getTxKey = ({ from, to, amount }) => `${from}!${to}!${amount}`;

const debounceTx = (cache => (transferDetails = {}) => {
    const txKey = getTxKey(transferDetails);
    const expire = 5000;
    return cache.checkSert(txKey, expire).then(() => transferDetails);
})(getCache());

module.exports = { debounceTx, prTrace, logger };
