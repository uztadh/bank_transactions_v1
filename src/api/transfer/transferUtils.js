const { clientErrs } = require("./transferErrors");

const timer = ms =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

const prTrace = label => val => {
    console.log(`${label}: ${val}`);
    return Promise.resolve(val);
};

const getCache = () => {
    let set = new Set();
    const checkSert = (key, expire) =>
        new Promise((resolve, reject) => {
            if (set.has(key)) return reject(clientErrs.DebounceReq);
            set.add(key);
            setTimeout(() => set.delete(key), expire);
            resolve();
        });
    return { checkSert };
};

const getTxKey = ({ from, to, amount }) => `${from}!${to}!${amount}`;

const debounceTx = (cache => transferDetails => {
    const txKey = getTxKey(transferDetails);
    const expire = 5000;
    return cache.checkSert(txKey, expire);
})(getCache());

module.exports = { debounceTx };
