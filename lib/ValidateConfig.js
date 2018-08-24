var validate = require("validate.js");

validate.validators.signing_keys = function(value, options, key, attributes) {
    if (!validate.isArray(value)) {
        return 'should be an array';
    }
    if (value.length < 2) {
        return 'should contains at least 2 keys';
    }

    for (let key of value) {
        if (!(/TEST.*/.test(key) || /BTS.*/.test(key))) {
            return 'is badly formated as it should start by TEST of BTS'
        }
    }
}
validate.validators.feed_configuration = function(value, options, key, attributes) {
    if (!validate.isObject(value) || validate.isArray(value)) {
        return 'should be an map of asset_name -> threshold';
    }

    const errors = Object.keys(value).filter(k => !validate.isInteger(value[k]) || value[k] <= 0)
    if (errors.length > 0) {
        return `thresholds for ${errors.join(', ')} should be integer`
    } 
}

var constraints = {
    "witness_id": {
        presence: { allowEmpty: false },
        format: {
            pattern: /1\.6\.\d+/,
            message: 'should match 1.6.XXX'
        }
    },
    "api_node": {
        presence: { allowEmpty: false },
        format: {
            pattern: /wss?:\/\/.*/,
            message: 'should be a Websocket url: ws://xxxx, or wss://xxxx'
        }
    },
    "private_key": { presence: { allowEmpty: false } },
    "missed_block_threshold": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    },
    "checking_interval": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    },
    "reset_period": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    },
    "witness_signing_keys": { 
        presence: { allowEmpty: false },
        signing_keys: true
    },
    "recap_time": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThanOrEqualTo: 0
        }
    },
    "debug_level": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThanOrEqualTo: 0,
            lessThanOrEqualTo: 3
        }
    },
    "telegram_token": {
        presence: { allowEmpty: false },
        format: {
            pattern: /.*:.*/,
            message: 'should be a valid Telegram token that match: bot_id:token'
        }
    },
    "telegram_authorized_users": { presence: { allowEmpty: false } },
    "retries_threshold": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    },
    "feeds_to_check" : {
        feed_configuration: true    
    },
    "feed_checking_interval": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    },
    "stale_blockchain_threshold": {
        presence: true,
        numericality: {
            onlyInteger: true,
            greaterThan: 0
        }
    }
}

function validate_config(config) {
    return validate(config, constraints);
}


module.exports = validate_config;