const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    inventory: { type: Object, default: {} },
    stocks: { 
        apple: { type: Number, default: 0 },
        starbucks: { type: Number, default: 0 },
        google: { type: Number, default: 0 },
        microsoft: { type: Number, default: 0 },
        mcdonalds: { type: Number, default: 0 },
        tesla: { type: Number, default: 0 }
    },
    cooldowns: { type: Object, default: {} }
});

const BotConfigSchema = new mongoose.Schema({
    botId: { type: String, default: 'main' },
    owners: { type: Array, default: ['1263909996404539497', '892133353757736960'] },
    stockPrices: { type: Object, default: {
        apple: 920395, starbucks: 1255263, google: 154688, 
        microsoft: 2748133, mcdonalds: 1401874, tesla: 1214967
    }},
    stockTrend: { type: Number, default: 0 }
});

const User = mongoose.model('User', UserSchema);
const BotConfig = mongoose.model('BotConfig', BotConfigSchema);

module.exports = { User, BotConfig };
