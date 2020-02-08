const Joi = require("@hapi/joi");
const { transferErrors } = require("./transferErrors");

const accountNumSchema = Joi.number()
    .min(1)
    .required();

const transferDetailsSchema = Joi.object().keys({
    from: accountNumSchema,
    to: accountNumSchema,
    amount: Joi.number()
        .greater(0)
        .required()
});

const validate = (tranferDetails = {}) =>
    new Promise((resolve, reject) => {
        const { error, value } = transferDetailsSchema.validate(tranferDetails);
        if (error || value.to === value.from) {
            reject(transferErrors.InvalidDetails);
        } else resolve(value);
    });

module.exports = { validate };
