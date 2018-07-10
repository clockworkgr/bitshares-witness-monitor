var assert = require('assert');
var validate_config = require('../lib/ValidateConfig.js')

const valid_config = {
    "witness_id": "1.6.123",
    "api_node": "wss://bitshares.org",
    "private_key": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "missed_block_threshold": 3,
    "checking_interval": 10,
    "reset_period": 300,
    "witness_signing_keys": [ 
        "BTSXXXXXXXXXXXXXXXXXXXXXXX", 
        "TESTXXXXXXXXXXXXXXXXXXXXXX"
    ],
    "recap_time": 60,
    "debug_level": 3,
    "telegram_token": "XXXXXXX:YYYYYYYYYY",
    "telegram_authorized_users": ["1234"],
    "retries_threshold": 3,
    "feeds_to_check" : ["HERTZ", "USD"],
    "feed_publication_threshold": 60,
    "feed_checking_interval": 10
}


describe('#validate_config()', function() {
    it('should not find errors', function() {
        assert.equal(validate_config(valid_config), undefined, "Should be a valid config.");
    });

    for (let field in valid_config) {
        if (!['feeds_to_check'].includes(field)) {
            it(`should detect no ${field}`, function() {
                var config = Object.assign({}, valid_config);
                delete config[field];
                const validation_result = validate_config(config);
                assert(field in validation_result);
            });
        }
    }

    it('should detect bad witness_id format', function() {
        var config = Object.assign({}, valid_config);
        config.witness_id = 'witness.me';
        assert('witness_id' in validate_config(config));
    });

    it('should detect bad api_node format', function() {
        var config = Object.assign({}, valid_config);
        config.api_node = 'http://bitshares.org/rpc';
        assert('api_node' in validate_config(config));
    });

    it('should detect empty private keys', function() {
        var config = Object.assign({}, valid_config);
        config.private_key = '';
        assert('private_key' in validate_config(config));
    });

    it('should detect invalid missed block threshold', function() {
        var config = Object.assign({}, valid_config);
        config.missed_block_threshold = 0;
        assert('missed_block_threshold' in validate_config(config));
    });

    it('should detect not enough signing keys (as array)', function() {
        var config = Object.assign({}, valid_config);
        config.witness_signing_keys = ['BTSXXXXXXXXXX'];
        assert('witness_signing_keys' in validate_config(config));
    });

    it('should detect not enough signing keys (as string)', function() {
        var config = Object.assign({}, valid_config);
        config.witness_signing_keys = 'BTSXXXXXXXXXX';
        assert('witness_signing_keys' in validate_config(config));
    });

    it('should detect bad signing keys', function() {
        var config = Object.assign({}, valid_config);
        config.witness_signing_keys = [ 'BTSXXXXXXXXXX', 'BTCXXXXXXXX'];
        assert('witness_signing_keys' in validate_config(config));
    });

});