const Logger = require('./lib/Logger.js');
const {Apis} = require('bitsharesjs-ws');
const {PrivateKey,TransactionBuilder} = require('bitsharesjs');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');

let apiNode = config.api_node;
let threshold = config.missed_block_threshold;
let interval = config.checking_interval * 1000;
let backupKey = config.backup_key;
let witness = config.witness_id;
let token = config.telegram_token;
let privKey = config.private_key;

let pKey = PrivateKey.fromWif(privKey);
let logger = new Logger(config.debug_level);
const bot = new TelegramBot(token, {polling: true});

var admin_id = "";
var total_missed = 0;
var start_missed = 0;

bot.onText(/\/pass (.+)/, (msg, match) => {

    const chatId = msg.from.id;
    const password = match[1];

    if (password == config.telegram_password) {
        bot.sendMessage(chatId, 'Password accepted.');
        admin_id = chatId;
    } else {
        bot.sendMessage(chatId, 'Password incorrect.');
    }

});
bot.onText(/\/reset/, (msg, match) => {

    const chatId = msg.chat.id;
    if (admin_id == chatId) {
        start_missed = 0;
        bot.sendMessage(chatId, "Session missed block counter set to 0.");
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});

bot.onText(/\/new_key  (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const key = match[1];
    if (admin_id == chatId) {
        backupKey = key;
        bot.sendMessage(chatId, "Backup signing key set to: "+backupKey);
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/new_node (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const node = match[1];
    if (admin_id == chatId) {
        apiNode = node;
        bot.sendMessage(chatId, "API node set to: "+apiNode);
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/threshold (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const thresh = match[1];
    if (admin_id == chatId) {
        threshold = thresh;
        bot.sendMessage(chatId, "Missed block threshold set to: "+threshold);
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/interval (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_int = match[1];
    if (admin_id == chatId) {
        interval = thresnew_inth;
        bot.sendMessage(chatId, "Checking interval set to: "+threshold+'s.');
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/stats/, (msg, match) => {

    const chatId = msg.chat.id;

    if (admin_id == chatId) {
        bot.sendMessage(chatId, "Checking interval set to: " + threshold + 's.');
        bot.sendMessage(chatId, "Missed block threshold set to: "+threshold);
        bot.sendMessage(chatId, "API node set to: "+apiNode);
        bot.sendMessage(chatId, "Backup signing key set to: "+backupKey);

    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
logger.log('Starting witness health monitor');
let first = true;
checkWitness();
var witness_account;

function checkWitness() {

    Apis.instance(apiNode, true).init_promise.then(() => {
        logger.log('Connected to API node: ' + apiNode);
        Apis.instance().db_api().exec('get_objects', [
            [witness], false
        ]).then((witness) => {
            if (first) {
                start_missed = witness[0].total_missed;
                first = false;
            }
            total_missed = witness[0].total_missed;
            let missed = total_missed - start_missed;
            witness_account = witness[0].witness_account;
            logger.log('Total missed blocks: ' + total_missed);
            logger.log('Missed since health monitor start: ' + missed);
            if (missed > threshold) {
                logger.log('Missed blocks since start (' + missed + ') greater than threshold (' + theshold + ').');
                logger.log('Switching to backup witness server.');
                let tr = new TransactionBuilder();
                tr.add_type_operation("witness_update", {
                    fee: {
                        amount: 0,
                        asset_id: '1.3.0'
                    },
                    witness: witness,
                    witness_account: witness_account,
                    new_url: '',
                    new_signing_key: backupKey
                });

                tr.set_required_fees().then(() => {
                    tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
                    tr.broadcast();
                    logger.log('Signing key updated');
                    first = true;
                    setTimeout(checkWitness, interval);
                });

            } else {
                logger.log('Status: OK');
                setTimeout(checkWitness, interval);
            }
        });
    }, () => {
        logger.log('API node unavailable.');
        setTimeout(checkWitness, interval);
    });
}