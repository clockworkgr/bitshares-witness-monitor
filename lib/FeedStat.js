const moment = require('moment');

class FeedStat {
    constructor(name, my_publication_time, my_price, average_price) {
        this.name = name;
        this.publication_time = my_publication_time;
        this._price = my_price;
        this._average_price = average_price;
    }

    since() {
        return moment.duration(moment.utc().diff(moment.utc(this.publication_time)));
    }

    spread() {
        return (1 - (this._price / this._average_price)) * 100;
    }

    toString() {
        if (this.publication_time == null) {
            return `${this.name} not published yet.`
        }

        return `${this.name} published at ${this.publication_time} UTC (${this.since().humanize()} ago) with spread ${this.spread()}%`
    }
}

module.exports = FeedStat;