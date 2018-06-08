# BitShares Witness Monitor

This is a BitShares witness monitoring script with telegram integration.

It has been tested with node v.8 LTS.

To use, clone the repo (or download the zip).

```
git clone https://github.com/clockworkgr/bitshares-witness-monitor
cd bitshares-witness-monitor
npm install
```

Open config-sample.json in your favourite text editor and edit with your own settings:

```
{
    "witness_id": "1.6.XXX",
    "api_node": "wss://<your_preferred_api_node>",
    "private_key": "5kTSOMEPRIVATEKEY111111111111",
    "missed_block_threshold": 3,
    "checking_interval": 10,
    "backup_key": "BTSXXXXXXXXXXXXXXXXXX",
    "reset_period": 300
    "debug_level": 3,
    "telegram_token": "<telegram_access_token>",
    "telegram_password": "<chosen_access_password>",
    "retries_threshold": 3
}
``` 
  
and then save as config.json

`private_key`  
The active key of your normal witness-owning account used to sign the witness_update operation.

`missed_block_threshold`  
How many blocks must be missed within a `reset_period` sec window before the script switches your signing key. Recommend to set at 2 or higher since 1 will possibly trigger updates on maintenance intervals (see: https://github.com/bitshares/bitshares-core/issues/504)

`checking_interval`  
How often should the script check for new missed blocks in seconds.

`backup_key`  
The public signing key of your backup witness to be used when switching.

`reset_period`  
The time after which the missed blocks counter is reset for the session in seconds.

`debug_level`  
Logging level. Can be:  
0: Minimum - Explicit logging & Errors  
1: Info - 0 + Basic logging  
2: Verbose - 1 + Verbose logging  
3: Transient - 2 + Transient messages  
but not currently used.

`telegram_token`  
The telegram access token for your notifications bot. You can get one here: https://telegram.me/BotFather

`telegram_password`  
Your chosen access password through telegram.

`retries_threshold`  
Number of failed connections to API node before the bot notifies you on telegram.

## Running

Simply use:

`node index.js`

inside a screen (or similar) session.

For peace of mind I recommend you also install the forever tool:

`sudo npm install forever -g`

and run as:

`forever index.js`

instead.

Depending on your environment, you might have to add the --color flag to enable colored logging output as below:

`node index.js --color`

or

`forever index.js --color`


*NOTE:* In case forever restarts the process, it will start with the DEFAULT config.json you have provided and not with the session-only changes you might have made using the telegram commands below.

## Telegram commands

Open a chat to your bot and use the following:

`/pass <your_configured_telegram_pass>`

This is required to authenticate. Otherwise none of the following commands will work.

`/changepass <new_password>`

This will update your telegram access password and will require you to authenticate again using `/pass`

`/stats`

This will return the current configuration and statistics of the monitoring session.

`/switch`

This will IMMEDIATELY update your signing key to the currently configured backup key.

`/new_key <BTS_public_signing_key>`

This will set a new backup key in place of the configured one.

`/new_node wss://<api_node_url>`

This will set a new API node to connect to.

`/threshold X`

This will set the missed block threshold before updating signing key to X blocks.

`/interval Y`

This will set the checking interval to every Y seconds.

`/window Z`

This will set the time until missed blocks counter is reset to Z seconds.

`/retries N`

This will set the threshold for failed API node connection attempts to N times before notifying you in telegram.

`/reset`

This will reset the missed blocks counter in the current time-window.

`/pause`

This will pause monitoring.

`/resume`

This will resume monitoring.
