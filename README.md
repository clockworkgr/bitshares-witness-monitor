# BitShares Witness Monitor

This is a BitShares witness monitoring script with telegram integration.

It has been tested with node v.8 LTS.

To use, clone the repo (or download the zip).

```
git clone https://github.com/clockworkgr/bitshares-witness-monitor
cd bitshares-witness-monitor
npm install
```

*Note*: To avoid installing Node, see below for Docker instructions.

Open config-sample.json in your favourite text editor and edit with your own settings:

```
{
    "witness_id": "1.6.XXX",
    "api_node": "wss://<your_preferred_api_node>",
    "private_key": "5kTSOMEPRIVATEKEY111111111111",
    "missed_block_threshold": 3,
    "checking_interval": 10,
    "reset_period": 300,
    "witness_signing_keys": [ "BTSXXXXXXXXXXXXXXXXXX", "BTSYYYYYYYYYYYYYYY"],
    "recap_time": 60,
    "debug_level": 3,
    "telegram_token": "<telegram_access_token>",
    "telegram_authorized_users": ["<user_id>"],
    "retries_threshold": 3,
    "feeds_to_check" : ["<mpa_asset>"],
    "feed_publication_threshold": 60,
    "feed_checking_interval": 10
}
``` 
  
and then save as config.json

| Key | Description |
| --- | --- |
| `witness_id` | The id of the witness to monitor. |
| `api_node` | Bitshares Websocket url to use to retrieve blockchain information. |
| `private_key`  | The active key of your normal witness-owning account used to sign the witness_update operation. |
| `missed_block_threshold`  | How many blocks must be missed within a `reset_period` sec window before the script switches your signing key. Recommend to set at 2 or higher since 1 will possibly trigger updates on maintenance intervals (see [bitshares-core#504](https://github.com/bitshares/bitshares-core/issues/504)). |
| `checking_interval` | How often should the script check for new missed blocks in seconds. |
| `witness_signing_keys`  | All the public keys of your witness, to switch key if too many blocks are missed. |
| `recap_time`  | The interval in minutes on which bot will auto-notify telegram user of latest stats (if authenticated). |
| `reset_period`  | The time after which the missed blocks counter is reset for the session in seconds. |
| `debug_level`  | Logging level. Can be: _0_ (Minimum - Explicit logging & Errors, _1_ (Info - 0 + Basic logging), _2_ (Verbose - 1 + Verbose logging),  _3_. Transient - 2 + Transient messages.  Not currently used. |
| `telegram_token`  | The telegram access token for your notifications bot. You can create one with [BotFather](https://telegram.me/BotFather). |
| `telegram_authorized_users` | List of userId authorized to interact with the bot. You can get your user Id by talking to the bot, or use a bot like [@userinfobot](https://telegram.me/userinfobot). |
| `retries_threshold`  | Number of failed connections to API node before the bot notifies you on telegram. |
| `feeds_to_check`| Array of assets symbols where the price publication should be checked. |
| `feed_publication_threshold` | How many minutes before a feed is considered as missing. |
| `feed_checking_interval` | How often should the script check for unpublished feeds. | 

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

Alternatively you can run it through Docker:

```
docker build . -t bitshares-witness-monitor:latest
docker run bitshares-witness-monitor:latest -v ./config.json:/bitshares-witness-monitor/config.json
```

This will build the image, then run it with `./config.json` file mounted in the image.

## Telegram commands

Open a chat to your bot and use the following:

- `/start`: Introduction message.
- `/help`: Get the list of available commands. 
- `/stats`: Return the current configuration and statistics of the monitoring session.
- `/switch`: IMMEDIATELY update your signing key to the new available signing key.
- `/signing_keys <BTS_public_signing_key1> <BTS_public_signing_key2>`: Set a new list of public keys.
- `/new_node wss://<api_node_url>`: Set a new API node to connect to.
- `/threshold X`: Set the missed block threshold before updating signing key to X blocks.
- `/interval Y`: Set the checking interval to every Y seconds.
- `/window Z` : Set the time until missed blocks counter is reset to Z seconds.
- `/recap T` : Set the auto-notification interval of latest stats to every T minutes. Set to 0 to disable.
- `/retries N` : Set the threshold for failed API node connection attempts to N times before notifying you in telegram.
- `/feed_publication_threshold X`: Set the feed threshold to X minutes.
- `/feed_checking_interval I`: Set the interval of publication feed check to I minutes.
- `/feeds <symbol1> <symbol2> <symbol3> ...`: Set the feeds to check to the provided list.
- `/reset` : Reset the missed blocks counter in the current time-window.
- `/pause` : Pause monitoring.
- `/resume`: Resume monitoring.


Send this to @BotFather `/setcommands` to get completion on commands:

```
start - Introduction
help - List all commands
stats - Gather statistics
switch - Update signing key to backup
signing_keys - Set signing keys
new_node - Set a new API node to connect to
threshold - Set the missed block threshold
interval - Set the checking interval
window - Set the time until missed blocks counter is reset
recap - Set the auto-notification interval of latest stats
retries - Set the threshold for failed API node connection attempts 
feed_publication_threshold - Set the feed threshold
feed_checking_interval - Set the interval of publication feed check
feeds - Set the feeds to check
reset - Reset the missed blocks counter
pause - Pause monitoring
resume - Resume monitoring
```