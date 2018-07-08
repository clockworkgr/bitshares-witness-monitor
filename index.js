process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const Logger = require('./lib/Logger.js');
const {Apis} = require('bitsharesjs-ws');
const {PrivateKey,TransactionBuilder} = require('bitsharesjs');
const config = require('./config.json');

const logger = new Logger(config.debug_level);
const bot = new TelegramBot(config.telegram_token, {polling: true});
const pKey = PrivateKey.fromWif(config.private_key);

var paused = false;
var check_witness_promise;
var admin_id = null;
var total_missed = null;
var start_missed = null;
var node_retries = 0;
var window_start = 0;
var checking = false;
var witness_account;
var lastupdate = 0;

function isAuthenticated(chatId) {
    if (admin_id != chatId) {
        bot.sendMessage(chatId, "You need to authenticate first.");
        return false;
    }
    return true;
}

function reset_missed_block_window() {
    start_missed = total_missed;        
    window_start = Date.now();
}

function update_signing_key(recipient_id) {
    let tr = new TransactionBuilder();
    tr.add_type_operation('witness_update', {
        fee: {
            amount: 0,
            asset_id: '1.3.0'
        },
        witness: config.witness_id,
        witness_account: witness_account,
        new_url: '',
        new_signing_key: config.backup_key
    });

    return tr.set_required_fees().then(() => {
            tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
            return tr.broadcast();
        })
        .then(() => {
            logger.log('Signing key updated');
            bot.sendMessage(recipient_id, 'Signing key updated. Use /new_key to set the next backup key.');
            reset_missed_block_window();
        }).catch(() => {
            logger.log('Could not broadcast update_witness tx.');
            bot.sendMessage(recipient_id, 'Could not broadcast update_witness tx. Please check!');                    
        });
    
}

function send_recap(recipient_id) {
    bot.sendMessage(recipient_id, `Checking interval: \`${config.checking_interval} sec\`
Node failed connection attempt notification threshold: \`${config.retries_threshold}\`
Missed block threshold: \`${config.missed_block_threshold}\`
Missed block reset time window: \`${config.reset_period} sec\`
API node: \`${config.api_node}\`
Backup signing key: \`${config.backup_key}\`
Recap time period: \`${config.recap_time} min\`
Total missed blocks: \`${total_missed}\`
Missed blocks in current time window: \`${total_missed - start_missed}\``,{
            parse_mode: "Markdown"
        });

}

bot.on('polling_error', (error) => {
    logger.error(error);
});


bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.from.id, 'Hello, please authentificate first with `/pass`.', 
        { parse_mode: "Markdown" });
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.from.id, 
`\`/pass <your_configured_telegram_pass>\` : Required to authenticate, otherwise no command will work.
\`/changepass <new_password>\`: Update your telegram access password and requires you to authenticate again using \`/pass\`
\`/stats\`: Return the current configuration and statistics of the monitoring session.
\`/switch\`: IMMEDIATELY update your signing key to the currently configured backup key.
\`/new_key <BTS_public_signing_key>\`: Set a new backup key in place of the configured one.
\`/new_node wss://<api_node_url>\`: Set a new API node to connect to.
\`/threshold X\`: Set the missed block threshold before updating signing key to X blocks.
\`/interval Y\`: Set the checking interval to every Y seconds.
\`/interval Y\`: Set the checking interval to every Y seconds.
\`/window Z\` : Set the time until missed blocks counter is reset to Z seconds.
\`/recap T\` : Set the auto-notification interval of latest stats to every T minutes. Set to 0 to disable.
\`/retries N\` : Set the threshold for failed API node connection attempts to N times before notifying you in telegram.
\`/reset\` : Reset the missed blocks counter in the current time-window.
\`/pause\` : Pause monitoring.
\`/resume\`: Resume monitoring.`, 
        { parse_mode: "Markdown" });
});

bot.onText(/\/pass (.+)/, (msg, match) => {

    const chatId = msg.from.id;
    const pass = match[1];

    if (pass == config.telegram_password) {
        admin_id = chatId;
        bot.sendMessage(chatId, `Password accepted. New admin is ${admin_id}`);
    } else {
        bot.sendMessage(chatId, 'Password incorrect.');
    }

});

bot.onText(/\/changepass (.+)/, (msg, match) => {

    const chatId = msg.from.id;
    const pass = match[1];

    if (isAuthenticated(chatId)) {
        config.telegram_password = pass;
        bot.sendMessage(chatId, 'Password changed. Please authenticate again with /pass <new-password>.');
        admin_id = null;
    }

});

bot.onText(/\/reset/, (msg, match) => {

    const chatId = msg.chat.id;

    if (isAuthenticated(chatId)) {
        reset_missed_block_window();
        bot.sendMessage(chatId, 'Session missed block counter set to 0.');
    }

});

bot.onText(/\/new_key (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const key = match[1];

    if (isAuthenticated(chatId)) {
        config.backup_key = key;
        bot.sendMessage(chatId, `Backup signing key set to: ${config.backup_key}`);
    }

});

bot.onText(/\/new_node (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const node = match[1];

    if (isAuthenticated(chatId)) {
        config.api_node = node;
        bot.sendMessage(chatId, `API node set to: ${config.api_node}`);
    }

});

bot.onText(/\/threshold (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const thresh = match[1];

    if (isAuthenticated(chatId)) {
        config.missed_block_threshold = thresh;
        bot.sendMessage(chatId, `Missed block threshold set to: ${config.missed_block_threshold}`);
    }

});

bot.onText(/\/recap (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const recap = match[1];

    if (isAuthenticated(chatId)) {
        config.recap_time = recap;
        if (config.recap_time > 0) {
            bot.sendMessage(chatId, `Recap time period set to: ${config.recap_time} minutes.`);
        } else {
            bot.sendMessage(chatId, 'Recap disabled.');
        }
    }
});

bot.onText(/\/window (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const wind = match[1];

    if (isAuthenticated(chatId)) {
        config.reset_period = wind;
        bot.sendMessage(chatId, `Missed block reset time window set to: ${config.reset_period}s`);
    }

});

bot.onText(/\/retries (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const ret = match[1];

    if (isAuthenticated(chatId)) {
        config.retries_threshold = ret;
        bot.sendMessage(chatId, `Failed node connection attempt notification threshold set to: ${config.retries_threshold}`);
    }

});

bot.onText(/\/interval (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_int = match[1];
    
    if (isAuthenticated(chatId)) {
        config.checking_interval = new_int;
        bot.sendMessage(chatId, `Checking interval set to: ${config.checking_interval}s.`);
    }
 
});

bot.onText(/\/stats/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (isAuthenticated(chatId)) {
        send_recap(chatId);
    }
    
});

bot.onText(/\/pause/, (msg, match) => {

    const chatId = msg.chat.id;

    if (isAuthenticated(chatId)) {
        paused = true;
        bot.sendMessage(chatId, 'Witness monitoring paused. Use /resume to resume monitoring.');
    }

});

bot.onText(/\/switch/, (msg, match) => {

    const chatId = msg.chat.id;

    if (isAuthenticated(chatId)) {
        bot.sendMessage(chatId, 'Attempting to update signing key...');
        logger.log('Received key update request.');
        Apis.instance(config.api_node, true).init_promise.then(() => {
            return update_signing_key(chatId);
        }).catch(() => {
            logger.log('Could not update signing key.');
            bot.sendMessage(chatId, 'Could not update signing key. Please check!');
        }).then(() => {
            if (paused || !checking) {
                return Apis.close();
            }
        });
    }

});
bot.onText(/\/resume/, (msg, match) => {

    const chatId = msg.chat.id;

    if (isAuthenticated(chatId)) {
        paused = false;
        window_start = Date.now();
        try {
            clearTimeout(check_witness_promise);
        } finally {
            check_witness_promise = setTimeout(checkWitness, config.checking_interval * 1000);
        }
        bot.sendMessage(chatId, 'Witness monitoring resumed.');
    }


});

logger.log('Starting witness health monitor');
checkWitness();

function checkWitness() {

    if (!paused) {
        checking = true;
        Apis.instance(config.api_node, true).init_promise.then(() => {
            node_retries = 0;
            logger.log('Connected to API node: ' + config.api_node);
            return Apis.instance().db_api().exec('get_objects', [
                [config.witness_id], false
            ]).then((witness) => {
                witness_account = witness[0].witness_account;
                total_missed = witness[0].total_missed;

                const should_reset_window = Math.floor((Date.now() - window_start) / 1000) >= config.reset_period 
                if (start_missed === null || should_reset_window) {
                    reset_missed_block_window()
                }

                if ((admin_id != null) && (config.recap_time > 0)) {
                    if (Math.floor((Date.now() - lastupdate) / 60000) >= config.recap_time) {
                        lastupdate = Date.now();
                        send_recap(admin_id);
                    }
                }

                let missed = total_missed - start_missed;
                logger.log('Total missed blocks: ' + total_missed);
                logger.log('Missed since time window start: ' + missed);
                if (missed > config.missed_block_threshold) {
                    logger.log(`Missed blocks since time window start (${missed}) greater than threshold (${config.missed_block_threshold}). Notifying...`);
                    logger.log('Switching to backup witness server.');                    
                    bot.sendMessage(admin_id, `Missed blocks since start (${missed}) greater than threshold (${config.missed_block_threshold}).`);
                    bot.sendMessage(admin_id, 'Switching to backup witness server.');
                    return update_signing_key();
                } else {
                    logger.log('Status: OK');
                }
            });
        
        }).catch(() => {        

            node_retries++;
            logger.log('API node unavailable.');
            if (node_retries > config.retries_threshold) {
                logger.log('Unable to connect to API node for ' + node_retries + ' times. Notifying...');
                bot.sendMessage(admin_id, 'Unable to connect to API node for ' + node_retries + ' times. Please check.');
            }
        }).then(() => {
            check_witness_promise = setTimeout(checkWitness, config.checking_interval * 1000);            
            return Apis.close(); 
        }).then(() => checking = false); 
    }
}