const Logger = require('./lib/Logger.js');
const {Apis} = require('bitsharesjs-ws');
const {PrivateKey,TransactionBuilder} = require('bitsharesjs');
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');

let apiNode = config.api_node;
let threshold = config.missed_block_threshold;
let interval = config.checking_interval ;
let password= config.telegram_password;
let backupKey = config.backup_key;
let witness = config.witness_id;
let token = config.telegram_token;
let privKey = config.private_key;
let retries = config.retries_threshold;
let paused = false;
let pKey = PrivateKey.fromWif(privKey);
let logger = new Logger(config.debug_level);
var to;
const bot = new TelegramBot(token, {polling: true});

var admin_id = "";
var total_missed = 0;
var start_missed = 0;
var node_retries=0;

bot.onText(/\/pass (.+)/, (msg, match) => {

    const chatId = msg.from.id;
    const pass = match[1];

    if (pass == password) {
        bot.sendMessage(chatId, 'Password accepted.');
        admin_id = chatId;
    } else {
        bot.sendMessage(chatId, 'Password incorrect.');
    }

});
bot.onText(/\/changepass (.+)/, (msg, match) => {

    const chatId = msg.from.id;
    const pass = match[1];

    if (admin_id == chatId) {
        password=pass;
        bot.sendMessage(chatId, 'Password changed. Please authenticate again with /pass <new-password>.');
        admin_id = 0;
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/reset/, (msg, match) => {

    const chatId = msg.chat.id;
    if (admin_id == chatId) {
        start_missed = total_missed;        
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
bot.onText(/\/retries (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const ret = match[1];
    if (admin_id == chatId) {
        retries = ret;
        bot.sendMessage(chatId, "Failed node connection attempt notification threshold set to: "+retries);
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/interval (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_int = match[1];
    if (admin_id == chatId) {
        interval = new_int;
        bot.sendMessage(chatId, "Checking interval set to: "+interval+'s.');
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/stats/, (msg, match) => {

    const chatId = msg.chat.id;

    if (admin_id == chatId) {
        bot.sendMessage(chatId, "Checking interval set to: " + interval + 's.');
        bot.sendMessage(chatId, "Node failed connection attempt notification threshold set to: " + retries);
        bot.sendMessage(chatId, "Missed block threshold set to: "+threshold);
        bot.sendMessage(chatId, "API node set to: "+apiNode);
        bot.sendMessage(chatId, "Backup signing key set to: "+backupKey);

    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/pause/, (msg, match) => {

    const chatId = msg.chat.id;

    if (admin_id == chatId) {
        paused=true;
        bot.sendMessage(chatId, "Witness monitoring paused. Use /resume to resume monitoring.");

    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/switch/, (msg, match) => {

    const chatId = msg.chat.id;

    if (admin_id == chatId) {
        bot.sendMessage(chatId, "Attempting to update signing key...");
        logger.log('Received key update request.');
        Apis.instance(apiNode, true).init_promise.then(() => {
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
                bot.sendMessage(chatId, "Signing key updated. Use /new_key to set the next backup key.");
                logger.log('Signing key updated');
                Apis.close();
            });
        },() => {
            logger.log('Could not update signing key.');
            bot.sendMessage(chatId, "Could not update signing key. Please check!");
        });
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/resume/, (msg, match) => {

    const chatId = msg.chat.id;

    if (admin_id == chatId) {
        paused=false;
        try {
            clearTimeout(to);
            to=setTimeout(checkWitness, interval*1000);
        }catch(e){
            to=setTimeout(checkWitness, interval*1000);
        }
        bot.sendMessage(chatId, "Witness monitoring resumed.");
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
        node_retries=0;
        if (paused) {            
            Apis.close();
        }else{
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
                    logger.log('Missed blocks since start (' + missed + ') greater than threshold (' + threshold + '). Notifying...');
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
                        to=setTimeout(checkWitness, interval*1000);                        
                        Apis.close();
                    });

                } else {
                    logger.log('Status: OK');
                    to=setTimeout(checkWitness, interval*1000);                    
                    Apis.close();
                }
            });
        }
    }, () => {        
        if (paused){
        }else{
            node_retries++;
            logger.log('API node unavailable.');
            if (node_retries>retries) {
                logger.log('Unable to connect to API node for '+node_retries+' times. Notifying...');
                bot.sendMessage(admin_id, 'Unable to connect to API node for '+node_retries+' times. Please check.');
            }
            to=setTimeout(checkWitness, interval*1000);            
        }
        Apis.close();
    });
}