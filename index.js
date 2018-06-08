process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const Logger = require('./lib/Logger.js');
const {Apis} = require('bitsharesjs-ws');
const {PrivateKey,TransactionBuilder} = require('bitsharesjs');
const config = require('./config.json');

let apiNode = config.api_node;
let threshold = config.missed_block_threshold;
let interval = config.checking_interval ;
let password= config.telegram_password;
let backupKey = config.backup_key;
let timeWindow = config.reset_period;
let witness = config.witness_id;
let token = config.telegram_token;
let privKey = config.private_key;
let retries = config.retries_threshold;
let auto_stats = config.recap_time;

let paused = false;
let pKey = PrivateKey.fromWif(privKey);
let logger = new Logger(config.debug_level);
var to;
const bot = new TelegramBot(token, {polling: true});

var admin_id = "";
var total_missed = 0;
var start_missed = 0;
var node_retries=0;
var window_start=0;
var checking=false;

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
        window_start=Date.now();
        bot.sendMessage(chatId, "Session missed block counter set to 0.");
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});

bot.onText(/\/new_key (.+)/, (msg, match) => {

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
bot.onText(/\/recap (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const recap = match[1];
    if (admin_id == chatId) {
        auto_stats = recap;
        if (auto_stats>0) {
            bot.sendMessage(chatId, "Recap time period set to: "+auto_stats+" minutes.");
        }else{
            bot.sendMessage(chatId, "Recap disabled.");
        }
    } else {
        bot.sendMessage(chatId, "You need to authenticate first.");
    }

});
bot.onText(/\/window (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const wind = match[1];
    if (admin_id == chatId) {
        timeWindow = wind;
        bot.sendMessage(chatId, "Missed block reset time window set to: "+timeWindow+"s");
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
        bot.sendMessage(chatId, "Checking interval set to: " + interval + 's.\n'+
                                "Node failed connection attempt notification threshold set to: " + retries+'.\n'+
                                "Missed block threshold set to: "+threshold+'.\n'+
                                "Missed block reset time window set to: "+timeWindow+"s."+
                                "API node set to: "+apiNode+'.\n'+
                                "Backup signing key set to: "+backupKey+'.\n'+
                                "Recap time period set to: "+auto_stats+' minutes.\n'+
                                "Total missed blocks: "+total_missed+'.\n'+
                                "Missed blocks in current time window: "+(total_missed - start_missed)+'.');
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
                tr.broadcast().then(() => {
                    logger.log('Signing key updated');
                    bot.sendMessage(chatId, "Signing key updated. Use /new_key to set the next backup key.");
                    window_start=Date.now();
                    start_missed = total_missed;
                    if (paused || !checking) {
                        Apis.close();
                    }
                },() => {
                    logger.log('Could not broadcast update_witness tx.');
                    bot.sendMessage(chatId, "Could not broadcast update_witness tx. Please check!");                    
                    if (paused || !checking) {
                        Apis.close();
                    }
                });
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
        window_start=Date.now();
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
var lastupdate=0;

function checkWitness() {

    if (!paused) {
        checking=true;
        Apis.instance(apiNode, true).init_promise.then(() => {
            node_retries=0;
            logger.log('Connected to API node: ' + apiNode);
            Apis.instance().db_api().exec('get_objects', [
                [witness], false
            ]).then((witness) => {
                if (first) {
                    start_missed = witness[0].total_missed;
                    window_start=Date.now();
                    first = false;
                }
                if ((admin_id!=0) && (auto_stats>0)) {
                    if (Math.floor((Date.now()-lastupdate)/60000)>=auto_stats) {
                        lastupdate=Date.now();
                        bot.sendMessage(admin_id, "Checking interval set to: " + interval + 's.\n'+
                                                    "Node failed connection attempt notification threshold set to: " + retries+'.\n'+
                                                    "Missed block threshold set to: "+threshold+'.\n'+
                                                    "Missed block reset time window set to: "+timeWindow+"s."+
                                                    "API node set to: "+apiNode+'.\n'+
                                                    "Backup signing key set to: "+backupKey+'.\n'+
                                                    "Recap time period set to: "+auto_stats+' minutes.\n'+
                                                    "Total missed blocks: "+total_missed+'.\n'+
                                                    "Missed blocks in current time window: "+(total_missed - start_missed)+'.');
                    }
                }
                total_missed = witness[0].total_missed;
                if (Math.floor((Date.now()-window_start)/1000)>=timeWindow) {
                    window_start=Date.now();
                    start_missed=total_missed;
                }
                let missed = total_missed - start_missed;
                witness_account = witness[0].witness_account;
                logger.log('Total missed blocks: ' + total_missed);
                logger.log('Missed since time window start: ' + missed);
                if (missed > threshold) {
                    logger.log('Missed blocks since time window start (' + missed + ') greater than threshold (' + threshold + '). Notifying...');
                    logger.log('Switching to backup witness server.');                    
                    bot.sendMessage(admin_id, 'Missed blocks since start (' + missed + ') greater than threshold (' + threshold + ').');
                    bot.sendMessage(admin_id, 'Switching to backup witness server.');
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
                        tr.broadcast().then(() => {
                            logger.log('Signing key updated');
                            bot.sendMessage(chatId, "Signing key updated. Use /new_key to set the next backup key.");
                            first = true;
                            to=setTimeout(checkWitness, interval*1000);                        
                            Apis.close();
                            checking=false;
                        },() => {
                            logger.log('Could not broadcast update_witness tx.');
                            bot.sendMessage(chatId, "Could not broadcast update_witness tx. Please check!");
                            //first = true;
                            to=setTimeout(checkWitness, interval*1000);                        
                            Apis.close();
                            checking=false;
                        });
                    });

                } else {
                    logger.log('Status: OK');
                    to=setTimeout(checkWitness, interval*1000);                    
                    Apis.close();
                    checking=false;
                }
            });
        
        }, () => {        
        
            node_retries++;
            logger.log('API node unavailable.');
            if (node_retries>retries) {
                logger.log('Unable to connect to API node for '+node_retries+' times. Notifying...');
                bot.sendMessage(admin_id, 'Unable to connect to API node for '+node_retries+' times. Please check.');
            }
            to=setTimeout(checkWitness, interval*1000);            
        
            Apis.close();
            checking=false;
        });
    }
}