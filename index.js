process.env["NTBA_FIX_319"] = 1;
const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
const config = require('./config.json');
const Logger = require('./lib/Logger.js');
const WitnessMonitor = require('./lib/WitnessMonitor.js')

const logger = new Logger(config.debug_level);
const bot = new TelegramBot(config.telegram_token, {polling: true});

function checkAuthorization(chatId) {
    if (config.telegram_authorized_users.includes(chatId)) {
        bot.sendMessage(chatId, `You (${chatId}) are not authorized.`);
        return false;
    }
    return true;
}

function send_stats(recipient_id) {
    const current_stats = witness_monitor.current_statistics();
    let stats = [
        `Total missed blocks: \`${current_stats.total_missed}\``,
        `Missed blocks in current time window: \`${current_stats.window_missed}\``,
        `Current signing key: \`${current_stats.signing_key}\``,
        `Feed publications: `
    ]
    current_stats.feed_publications.forEach(feed_stat => {
        stats.push(`  - ${feed_stat.toString()}`)
    });
    bot.sendMessage(recipient_id, stats.join('\n'), { parse_mode: 'Markdown' });
}

function send_settings(recipient_id) {
    const settings = [
        `API node: \`${config.api_node}\``,
        `Witness monitored: \`${config.witness_id}\``,
        `Checking interval: \`${config.checking_interval} sec\``,
        `Node failed connection attempt notification threshold: \`${config.retries_threshold}\``,
        `Missed block threshold: \`${config.missed_block_threshold}\``,
        `Missed block reset time window: \`${config.reset_period} sec\``,
        `Public signing keys: ${config.witness_signing_keys.map(k => '`' + k + '`').join(', ')}`,
        `Recap time period: \`${config.recap_time} min\``,
        `Feeds to check: \`${config.feeds_to_check}\``,
        `Feed publication treshold: \`${config.feed_publication_threshold} min\``,
        `Feed check interval: \`${config.feed_checking_interval} min\``,
    ];
    bot.sendMessage(recipient_id, settings.join('\n'), { parse_mode: 'Markdown' })
}

bot.on('polling_error', (error) => {
    logger.error(error);
});


bot.onText(/\/start/, (msg) => {

    const chatId = msg.from.id;

    if (config.telegram_authorized_users.includes(chatId)) {
        bot.sendMessage(chatId, `Hello ${msg.from.first_name}, type /help to get the list of commands.`);
    } else {
        bot.sendMessage(chatId, `Hello ${msg.from.first_name}, sorry but there is nothing for you here.`);
    }
});

bot.onText(/\/help/, (msg) => {
    const help = [
        `\`/stats\`: Return the current configuration and statistics of the monitoring session.`,
        `\`/switch\`: IMMEDIATELY update your signing key to the next available signing key.`,
        `\`/signing_keys <BTS_public_signing_key1> <BTS_public_signing_key2>\`: Set a new list of public keys.`,
        `\`/new_node wss://<api_node_url>\`: Set a new API node to connect to.`,
        `\`/threshold X\`: Set the missed block threshold before updating signing key to X blocks.`,
        `\`/interval Y\`: Set the checking interval to every Y seconds.`,
        `\`/interval Y\`: Set the checking interval to every Y seconds.`,
        `\`/window Z\` : Set the time until missed blocks counter is reset to Z seconds.`,
        `\`/recap T\` : Set the auto-notification interval of latest stats to every T minutes. Set to 0 to disable.`,
        `\`/retries N\` : Set the threshold for failed API node connection attempts to N times before notifying you in telegram.`,
        `\`/feed_publication_threshold X\`: Set the feed threshold to X minutes.`,
        `\`/feed_checking_interval I\`: Set the interval of publication feed check to I minutes.`,
        `\`/feeds <symbol1> <symbol2> <symbol3> ...\`: Set the feeds to check to the provided list.`,        
        `\`/reset\` : Reset the missed blocks counter in the current time-window.`,
        `\`/pause\` : Pause monitoring.`,
        `\`/resume\`: Resume monitoring.`
    ];
    bot.sendMessage(msg.from.id, help.join('\n'), { parse_mode: 'Markdown' });
});

bot.onText(/\/reset/, (msg, match) => {

    const chatId = msg.chat.id;

    if (checkAuthorization(chatId)) {
        witness_monitor.reset_missed_block_window();
        bot.sendMessage(chatId, 'Session missed block counter set to 0.');
    }

});

bot.onText(/\/signing_keys (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const keys = match[1].split(' ');

    if (checkAuthorization(chatId)) {
        config.witness_signing_keys = keys;
        bot.sendMessage(chatId, `Signing keys set to: ${config.witness_signing_keys.map(k => '`' + k + '`').join(', ')}`,
            { parse_mode: 'Markdown' });
    }

});

bot.onText(/\/new_node (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const node = match[1];

    if (checkAuthorization(chatId)) {
        config.api_node = node;
        bot.sendMessage(chatId, `API node set to: ${config.api_node}`);
    }

});

bot.onText(/\/threshold (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const thresh = match[1];

    if (checkAuthorization(chatId)) {
        config.missed_block_threshold = thresh;
        bot.sendMessage(chatId, `Missed block threshold set to: ${config.missed_block_threshold}`);
    }

});

bot.onText(/\/recap (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const recap = match[1];

    if (checkAuthorization(chatId)) {
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

    if (checkAuthorization(chatId)) {
        config.reset_period = wind;
        bot.sendMessage(chatId, `Missed block reset time window set to: ${config.reset_period}s`);
    }

});

bot.onText(/\/retries (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const ret = match[1];

    if (checkAuthorization(chatId)) {
        config.retries_threshold = ret;
        bot.sendMessage(chatId, `Failed node connection attempt notification threshold set to: ${config.retries_threshold}`);
    }

});

bot.onText(/\/interval (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_int = match[1];
    
    if (checkAuthorization(chatId)) {
        config.checking_interval = new_int;
        bot.sendMessage(chatId, `Checking interval set to: ${config.checking_interval}s.`);
    }
 
});

bot.onText(/\/stats/, (msg, match) => {

    const chatId = msg.chat.id;
    
    if (checkAuthorization(chatId)) {
        send_stats(chatId);
    }
});

bot.onText(/\/settings/, (msg, match) => {

    const chatId = msg.chat.id;
    
    if (checkAuthorization(chatId)) {
        send_settings(chatId);
    }
    
});

bot.onText(/\/feed_checking_interval (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_int = match[1];
    
    if (checkAuthorization(chatId)) {
        config.feed_checking_interval = new_int;
        witness_monitor.reset_feed_check();
        bot.sendMessage(chatId, `Feed checking interval set to: ${config.feed_checking_interval}m.`);
    }
 
});

bot.onText(/\/feed_publication_threshold (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_threshold = match[1];
    
    if (checkAuthorization(chatId)) {
        config.feed_publication_threshold = new_threshold;
        witness_monitor.reset_feed_check();
        bot.sendMessage(chatId, `Feed publication threshold set to: ${config.feed_publication_threshold}m.`);
    }
 
});

bot.onText(/\/feeds (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const new_feeds = match[1].split(' ');
    
    if (checkAuthorization(chatId)) {
        config.feeds_to_check = new_feeds;
        witness_monitor.reset_feed_check();
        bot.sendMessage(chatId, `Feeds to check set to: ${config.feeds_to_check}.`);
    }
 
});

bot.onText(/\/pause/, (msg, match) => {

    const chatId = msg.chat.id;

    if (checkAuthorization(chatId)) {
        witness_monitor.pause();
        bot.sendMessage(chatId, 'Witness monitoring paused. Use /resume to resume monitoring.');
    }

});

bot.onText(/\/switch/, (msg, match) => {

    const chatId = msg.chat.id;

    if (checkAuthorization(chatId)) {
        bot.sendMessage(chatId, 'Attempting to update signing key...');
        witness_monitor.force_update_signing_key();
    }

});

bot.onText(/\/resume/, (msg, match) => {

    const chatId = msg.chat.id;

    if (checkAuthorization(chatId)) {
        witness_monitor.resume();
        bot.sendMessage(chatId, 'Witness monitoring resumed.');
    }

});

const witness_monitor = new WitnessMonitor(config, logger);
var last_recap_send = null;
for (let user_id of config.telegram_authorized_users) {
    witness_monitor.on('started', () => {
        bot.sendMessage(user_id, 'Bot (re)started.');
        send_settings(user_id);
    });
    witness_monitor.on('notify', (msg) => {
        bot.sendMessage(user_id, msg);
    });
    witness_monitor.on('checked', () => {
        if (config.recap_time > 0 && moment().diff(last_recap_send, 'minutes') >= config.recap_time) {
            last_recap_send = moment();
            send_stats(user_id);
        }
    });
}
witness_monitor.start_monitoring();