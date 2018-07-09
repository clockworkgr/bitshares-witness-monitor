const EventEmitter = require('events');
const {Apis} = require('bitsharesjs-ws');
const {PrivateKey,TransactionBuilder} = require('bitsharesjs');
const moment = require('moment');
const FeedStat = require('./FeedStat.js');

class WitnessMonitor extends EventEmitter {

    
    constructor(config, logger) {
        super();
        this._config = config;
        this._logger = logger;
        this._paused = false;
        this._check_witness_promise = null;
        this._total_missed = null;
        this._start_missed = null;
        this._window_start = null;
        this._checking = false;
        this._witness_account = null;
        this._witness_url = null;
        this._feed_stats = null;
        this._last_feed_check = null;
        this._node_retries = 0;
    }

    
    current_statistics() {
        return {
            total_missed : this._total_missed,
            current_missed : this._total_missed - this._start_missed,
            feed_publications : this._feed_stats
        }
    }

    reset_missed_block_window() {
        this._start_missed = this._total_missed;        
        this._window_start = moment();
    }

    reset_feed_check() {
        this._last_feed_check = null;
    }

    force_update_signing_key() {
        this._logger.log('Received key update request.');
        Apis.instance(this._config.api_node, true).init_promise.then(() => {
            return this.update_signing_key();
        }).catch(() => {
            this.notify('Could not update signing key.');
        }).then(() => {
            if (this._paused || !this._checking) {
                return Apis.close();
            }
        });

    }
    
    update_signing_key() {
        const private_key = PrivateKey.fromWif(this._config.private_key);
        const tr = new TransactionBuilder();
        tr.add_type_operation('witness_update', {
            fee: {
                amount: 0,
                asset_id: '1.3.0'
            },
            witness: this._config.witness_id,
            witness_account: this._witness_account,
            new_url: this._witness_url,
            new_signing_key: this._config.backup_key
        });
    
        return tr.set_required_fees().then(() => {
                tr.add_signer(private_key, private_key.toPublicKey().toPublicKeyString());
                return tr.broadcast();
            })
            .then(() => {
                this.reset_missed_block_window();
                this.notify('Signing key updated');
            }).catch(() => {
                this.notify('Could not broadcast update_witness tx.');
            });
        
    }
    notify(msg) {
        this._logger.log(msg);
        this.emit('notify', msg)
    }
    

    extract_feed_data(feeds_to_check, dynamic_assets_data, witness_account) {
        const feeds_stats = new Map();
    
        feeds_to_check.map((symbol, i) => {
            let my_publication_time = null;
            let my_price = null;
            let average_price = dynamic_assets_data[i]['current_feed']['settlement_price']['base']['amount'] / dynamic_assets_data[i]['current_feed']['settlement_price']['quote']['amount'];
            for (const feed of dynamic_assets_data[i]['feeds']) {
                if (feed[0] == witness_account) {
                    my_publication_time = feed[1][0];
                    my_price = feed[1][1]['settlement_price']['base']['amount'] / feed[1][1]['settlement_price']['quote']['amount']
                }
            }
            
            feeds_stats.set(symbol, new FeedStat(symbol,my_publication_time, my_price, average_price));
        });
        return feeds_stats;
    }

    check_publication_feeds() {
        const has_no_feed_check_configured = !('feeds_to_check' in this._config) || this._config.feeds_to_check.length == 0;
        const is_not_time_to_check_feeds = this._last_feed_check != null && moment().diff(this._last_feed_check, 'minutes') < this._config.feed_checking_interval
        if (has_no_feed_check_configured || is_not_time_to_check_feeds) {
            return Promise.resolve();
        } 
    
        return Apis.instance().db_api().exec('lookup_asset_symbols', [this._config.feeds_to_check])
            .then((assets) => {
                const dynamic_asset_data_ids = assets.map(a => a['bitasset_data_id']);
                return Apis.instance().db_api().exec('get_objects', [dynamic_asset_data_ids]);
            })
            .then(dynamic_assets_data => {
                this._last_feed_check = moment();
                this._feed_stats = this.extract_feed_data(this._config.feeds_to_check, dynamic_assets_data, this._witness_account);
                this._feed_stats.forEach(feed_stat => {
                    this._logger.log(feed_stat.toString());
                    if (feed_stat.publication_time == null) {
                        this.notify(`No publication found for ${feed_stat.name}.`);
                    } else {
                        if (feed_stat.since().as('minutes') > this._config.feed_publication_threshold) {
                            const price_feed_alert = [
                                `More than ${this._config.feed_publication_threshold} minutes elapsed since last publication of ${feed_stat.name}.`,
                                `Last publication happened at ${moment.utc(feed_stat.publication_time).local().format()}, ${feed_stat.since().humanize()} ago.`
                            ];
                            this.notify(price_feed_alert.join('\n'));
                        }
                    }
                });
            })
            .catch(error => {
                this._logger.log(`Unable to retrieve feed stats: ${error}`);
                throw error;
            });
    }

    
    check_missed_blocks() {
        let missed = this._total_missed - this._start_missed;
        this._logger.log('Total missed blocks: ' + this._total_missed);
        this._logger.log('Missed since time window start: ' + missed);
        if (missed > this._config.missed_block_threshold) {
            const missing_block_alert = [
                `Missed blocks since start (${missed}) greater than threshold (${this._config.missed_block_threshold}).`,
                'Switching to backup witness server.'
            ]
            this.notify(missing_block_alert.join('\n'));
            return this.update_signing_key();
        } else {
            this._logger.log('Status: OK');
        }
        return Promise.resolve();
    }

    start_monitoring() {
        this._logger.log('Starting witness health monitor');
        this.emit('started');
        this.run_monitoring();
    }

    run_monitoring() {
        if (!this._paused) {
            this._checking = true;

            Apis.instance(this._config.api_node, true).init_promise.then(() => {
                this._node_retries = 0;
                this._logger.log('Connected to API node: ' + this._config.api_node);
                return Apis.instance().db_api().exec('get_objects', [[this._config.witness_id]]).then((witness) => {
                    this._witness_account = witness[0].witness_account;
                    this._witness_url = witness[0].url
                    this._total_missed = witness[0].total_missed;
    
                    const should_reset_window = moment().diff(this._window_start, 'seconds') >= this._config.reset_period 
                    if (this._start_missed === null || should_reset_window) {
                        this.reset_missed_block_window()
                    }
        
                    return Promise.all([this.check_missed_blocks(), this.check_publication_feeds()]);
                });
            
            }).catch((error) => {
                this._node_retries++;
                this._logger.log(`API node unavailable: ${error}`);
                if (this._node_retries > this._config.retries_threshold) {
                    this.notify('Unable to connect to API node for ' + this._node_retries + ' times.');
                }
            }).then(() => {
                this._check_witness_promise = setTimeout(() => this.run_monitoring(), this._config.checking_interval * 1000);            
                return Apis.close(); 
            }).then(() => { 
                this._checking = false;
                this.emit('checked');
            });
        }

    }

    pause() {
        this._paused = true;
    }

    resume() {
        this._paused = false;
        this.reset_missed_block_window()
        try {
            clearTimeout(this._check_witness_promise);
        } finally {
            this._check_witness_promise = setTimeout(() => this.run_monitoring(), this._config.checking_interval * 1000);
        }

    }
}

module.exports = WitnessMonitor;