
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    inventory: { type: Object, default: {} },
    stocks: { type: Object, default: { apple: 0, starbucks: 0, google: 0, microsoft: 0, mcdonalds: 0, tesla: 0 } },
    cooldowns: { type: Object, default: {} },
    loan: {
        amount: { type: Number, default: 0 },
        takenAt: { type: Number, default: 0 }
    },
    isJailed: { type: Boolean, default: false }
});

const BotConfigSchema = new mongoose.Schema({
    botId: { type: String, default: 'main' },
    owners: { type: Array, default: [] },
    stockPrices: { type: Object, default: {
        apple: 920395, starbucks: 1255263, google: 154688,
        microsoft: 2748133, mcdonalds: 1401874, tesla: 1214967
    }},
    stockTrend: { type: Number, default: 0 }
});

const User = mongoose.model('User', UserSchema);
const BotConfig = mongoose.model('BotConfig', BotConfigSchema);

module.exports = { User, BotConfig };
