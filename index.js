const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// ==========================================
// 1. إعدادات قاعدة البيانات (Schemas)
// ==========================================
const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    inventory: { type: Object, default: {} },
    stocks: { type: Object, default: { apple: 0, starbucks: 0, google: 0, microsoft: 0, mcdonalds: 0, tesla: 0 } },
    cooldowns: { type: Object, default: {} },
    loan: { amount: { type: Number, default: 0 }, takenAt: { type: Number, default: 0 } },
    isJailed: { type: Boolean, default: false }
});

const BotConfigSchema = new mongoose.Schema({
    botId: { type: String, default: 'main' },
    owners: { type: Array, default: [] }, // ضيف أيديهات الأونرز هنا لو حابب
    stockPrices: { type: Object, default: { apple: 920395, starbucks: 1255263, google: 154688, microsoft: 2748133, mcdonalds: 1401874, tesla: 1214967 } },
    stockTrend: { type: Number, default: 0 }
});

const User = mongoose.model('User', UserSchema);
const BotConfig = mongoose.model('BotConfig', BotConfigSchema);

// ==========================================
// 2. إعدادات البوت والسيرفر
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Paris Bank is Active!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running...'));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ==========================================
// 3. الدوال المساعدة (Helpers الفاخرة)
// ==========================================
// دالة تحويل الحروف (k, m, b, t) لأرقام
function parseAmount(amountStr) {
    if (!amountStr) return null;
    let multiplier = 1;
    const lowerStr = amountStr.toLowerCase();
    if (lowerStr.endsWith('k')) multiplier = 1000;
    else if (lowerStr.endsWith('m')) multiplier = 1000000;
    else if (lowerStr.endsWith('b')) multiplier = 1000000000;
    else if (lowerStr.endsWith('t')) multiplier = 1000000000000;
    const num = parseFloat(lowerStr.replace(/[kmbt]/g, ''));
    return isNaN(num) ? null : Math.floor(num * multiplier);
}

// دالة تنسيق الأرقام عشان تظهر بشكل احترافي
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'b';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

// دالة إرسال الإيمبدز (عشان كل رسايل البوت تبقى فخمة)
function sendEmbed(message, desc, color = '#2b2d31') {
    const embed = new EmbedBuilder().setDescription(desc).setColor(color);
    return message.reply({ embeds: [embed] });
}

// دالة رسالة الوقت (بالثواني والدقايق زي الصورة)
function getCooldownText(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `توك لاعب تعال بعد:\n> ${minutes} minutes, ${seconds} seconds ⏳`;
}

// قائمة المتجر
const shopItems = {
    'جوال': 10000, 'بيسي': 20000, 'سيارة': 100000, 'قصر': 1200000,
    'طيارة': 3000000, 'شركة': 7000000, 'مطعم': 10000000, 'يخت': 25000000,
    'قطار': 30000000, 'جزيرة': 50000000, 'قرية': 150000000, 'قلعة': 200000000, 'دولة': 500000000
};

// ==========================================
// 4. تحديث أسعار البورصة كل 5 دقائق
// ==========================================
setInterval(async () => {
    let config = await BotConfig.findOne({ botId: 'main' });
    if (!config) return;
    config.stockTrend += 1;
    const isBoom = config.stockTrend >= 3; // بترفع جامد كل 3 مرات
    if (isBoom) config.stockTrend = 0;
    for (let key in config.stockPrices) {
        let currentPrice = config.stockPrices[key];
        currentPrice += isBoom ? Math.floor(currentPrice * (Math.random() * 0.5 + 0.1)) : -Math.floor(currentPrice * (Math.random() * 0.1 + 0.01));
        config.stockPrices[key] = Math.max(1000, currentPrice);
    }
    config.markModified('stockPrices');
    await config.save();
}, 5 * 60 * 1000);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}! Paris Bank is Ready 🔥`);
});

// ==========================================
// 5. هندسة الأوامر الأساسية
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const args = message.content.trim().split(/ +/);
    const command = args[0];

    // قائمة الأوامر المعترف بها عشان البوت ميردش على الدردشة العادية ويقول "مسجون"
    const validCommands = ['استثمار','بخشيش','تحويل','تداول','راتب','روليت','سلوت','صاروخ','طاولة','لعبه','لعبة','زر','كراش','ماين','قرض','ضربة','ارقام','مقاولة','اكس-او','اكس','مخاطرة','سوبر','سباق','ابراج','ذاكرة','ايموجي','كنز','رصيد','فلوس','متجر','ممتلكاتي','شراء','بيع','اسعار','اسهمي','سجني','تسديد','نهب','اوامر','#اوامر','وقت','اضافة','ازالة','تصفية'];
    if (!validCommands.includes(command)) return;

    let botConfig = await BotConfig.findOne({ botId: 'main' }) || await BotConfig.create({ botId: 'main' });
    let userData = await User.findOne({ userId: message.author.id }) || await User.create({ userId: message.author.id });
    const isOwner = botConfig.owners.includes(message.author.id);
    const now = Date.now();

    // ------------------------------------------
    // أوامر الأونر (VIP تتخطى أي سجن)
    // ------------------------------------------
    if (isOwner) {
        if (command === 'اضافة' && args[1] === 'اونر') {
            const target = message.mentions.users.first();
            if (!target) return sendEmbed(message, 'منشن الشخص!', '#e74c3c');
            if (!botConfig.owners.includes(target.id)) {
                botConfig.owners.push(target.id); await botConfig.save();
                return sendEmbed(message, `تم إضافة ${target} للأونرات ✅`, '#2ecc71');
            }
            return;
        }
        if (command === 'ازالة' && args[1] === 'اونر') {
            const target = message.mentions.users.first();
            if (target) {
                botConfig.owners = botConfig.owners.filter(id => id !== target.id); await botConfig.save();
                return sendEmbed(message, `تم إزالة ${target} من الأونرات ❌`, '#e74c3c');
            }
            return;
        }
        if (command === 'تصفية') {
            await User.deleteMany({});
            return sendEmbed(message, 'تم تصفية فلوس وممتلكات كل الأعضاء ⚠️🔥', '#e74c3c');
        }
    }

    // ------------------------------------------
    // نظام السجن الاحترافي
    // ------------------------------------------
    if (userData.loan && userData.loan.amount > 0 && !userData.isJailed) {
        if (now - userData.loan.takenAt >= 10800000) { // 3 ساعات = سجن
            userData.isJailed = true;
            await userData.save();
        }
    }

    // المسموح ليهم وقت السجن
    const allowedWhileJailed = ['تسديد', 'سجني', 'لعبه', 'لعبة', 'تداول', 'استثمار', 'مخاطرة', 'سوبر'];
    if (userData.isJailed && !allowedWhileJailed.includes(command) && !isOwner) {
        return sendEmbed(message, '🚨 **أنت مسجون حالياً بسبب عدم تسديد القرض!**\nلا يمكنك استخدام أي أمر سوى `تسديد` أو `سجني` أو `لعبه` أو أوامر `التداول` و `الاستثمار` لتسديد دينك.', '#e74c3c');
    }

    // دالة فحص الكول داون الموحدة (عشان منكررش الكود وتطلع زي الصورة)
    const checkCooldown = async (key, minutes) => {
        const cooldownAmount = minutes * 60 * 1000;
        const lastUsed = userData.cooldowns?.[key] || 0;
        if (now - lastUsed < cooldownAmount) {
            const timeLeft = cooldownAmount - (now - lastUsed);
            message.reply({ content: getCooldownText(timeLeft) });
            return true;
        }
        userData.cooldowns = { ...userData.cooldowns, [key]: now };
        userData.markModified('cooldowns');
        return false;
    };

    // ------------------------------------------
    // الاقتصاد الأساسي (راتب، بخشيش، تحويل، نهب)
    // ------------------------------------------
    if (command === 'رصيد' || command === 'فلوس') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        return sendEmbed(message, `مجموع فلوسك هو:\n**${formatNumber(targetData.balance)} | ${targetData.balance}$**`);
    }

    if (command === 'تحويل') {
        if (await checkCooldown('transfer', 2.5)) return; // دقيقتين ونص
        const target = message.mentions.users.first();
        const amount = parseAmount(args[2]);
        if (!target || !amount || amount <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nتحويل @منشن (المبلغ)', '#e74c3c');
        if (amount > 500000000) return sendEmbed(message, 'الحد الأقصى للتحويل في المرة الواحدة هو **500m**!', '#e74c3c');
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');

        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        userData.balance -= amount; targetData.balance += amount;
        await userData.save(); await targetData.save();
        return sendEmbed(message, `تم تحويل **${formatNumber(amount)}$** إلى ${target} ✅`, '#2ecc71');
    }

    if (command === 'راتب') {
        if (await checkCooldown('daily', 7)) return; // 7 دقايق
        const amount = Math.floor(Math.random() * (100000 - 1000 + 1)) + 1000;
        userData.balance += amount; await userData.save();
        return sendEmbed(message, `تم سحب الراتب ${formatNumber(amount)}$ , رصيدك الحالي ${formatNumber(userData.balance)}$`, '#2ecc71');
    }

    if (command === 'بخشيش') {
        if (await checkCooldown('tip', 10)) return; // 10 دقايق
        const amount = Math.floor(Math.random() * 100000) + 1;
        userData.balance += amount; await userData.save();
        return sendEmbed(message, `ما نقص مال من صدقة خد يا فقير ${formatNumber(amount)}$`, '#2ecc71');
    }

    if (command === 'نهب') {
        if (await checkCooldown('rob', 15)) return; // 15 دقيقة
        const target = message.mentions.users.first();
        if (!target) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nنهب @منشن', '#e74c3c');
        if (target.id === message.author.id) return sendEmbed(message, 'هتسرق نفسك؟!', '#e74c3c');

        let targetData = await User.findOne({ userId: target.id });
        if (!targetData || targetData.balance < 3000) return sendEmbed(message, 'الشخص ده معهوش فلوس تتسرق!', '#e74c3c');

        const stolen = Math.floor(Math.random() * (30000 - 1000 + 1)) + 1000;
        const actual = Math.min(targetData.balance, stolen);

        userData.balance += actual; targetData.balance -= actual;
        await userData.save(); await targetData.save();
        return sendEmbed(message, `تم نهب **${formatNumber(actual)}$** من ${target} 🥷`, '#2ecc71');
    }
    // ==========================================
    // 6. نظام القروض والسجن
    // ==========================================
    if (command === 'قرض') {
        if (await checkCooldown('loan', 15)) return; // 15 دقيقة
        if (userData.loan && userData.loan.amount > 0) return sendEmbed(message, 'أنت واخد قرض بالفعل ولازم تسدده الأول!', '#e74c3c');
        
        const amount = Math.floor(Math.random() * (500000 - 300000 + 1)) + 300000;
        userData.balance += amount;
        userData.loan = { amount: amount, takenAt: now };
        userData.isJailed = false;
        await userData.save();
        return sendEmbed(message, `🏦 تم إيداع **${formatNumber(amount)}$** في رصيدك كقرض.\n\n⚠️ **تنبيه هام:** معاك 3 ساعات بس لتسديد القرض ده، وإلا هيتم سجنك ومش هتقدر تستخدم أي أوامر تانية باستثناء الألعاب المسموحة!`, '#f1c40f');
    }

    if (command === 'سجني') {
        if (!userData.loan || userData.loan.amount === 0) return sendEmbed(message, 'أنت لست مديوناً للبنك، سجلك نظيف! 😇', '#2ecc71');
        
        const timeLeft = 10800000 - (now - userData.loan.takenAt); // 3 ساعات
        if (timeLeft <= 0 || userData.isJailed) {
            return sendEmbed(message, `🚨 **أنت مسجون بالفعل!**\nمبلغ القرض المطلوب سداده: **${formatNumber(userData.loan.amount)}$**\nاستخدم أمر \`تسديد\` لفك سجنك.`, '#e74c3c');
        }
        
        const hours = Math.floor(timeLeft / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);
        return sendEmbed(message, `⚖️ **حالة السجن والديون**\n\n**مبلغ القرض:** ${formatNumber(userData.loan.amount)}$\n**الوقت المتبقي قبل السجن:** ⏳ ${hours} ساعات و ${minutes} دقائق`, '#f1c40f');
    }

    if (command === 'تسديد') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id });
        
        if (!targetData || !targetData.loan || targetData.loan.amount === 0) {
            return sendEmbed(message, target.id === message.author.id ? 'أنت مش واخد قرض عشان تسدده!' : 'الشخص ده مش عليه قروض!', '#e74c3c');
        }
        
        const amountToPay = targetData.loan.amount;
        if (userData.balance < amountToPay) return sendEmbed(message, `رصيدك غير كافي لتسديد القرض! المطلوب: **${formatNumber(amountToPay)}$**`, '#e74c3c');
        
        // الخصم وتصفير السجن والدين فعلياً
        userData.balance -= amountToPay;
        targetData.loan = { amount: 0, takenAt: 0 };
        targetData.isJailed = false;
        await userData.save();
        if (target.id !== message.author.id) await targetData.save();
        
        return sendEmbed(message, `✅ تم تسديد مبلغ **${formatNumber(amountToPay)}$** للبنك ${target.id === message.author.id ? 'وتم فك سجنك (إن كنت مسجون)!' : `نيابة عن ${target} وتم فك سجنه!`}`, '#2ecc71');
    }

    // ==========================================
    // 7. أمر وقت (البطاريات الأسطورية)
    // ==========================================
    if (command === 'وقت') {
        const getBatt = (key, mins) => {
            const last = userData.cooldowns?.[key] || 0;
            const t = mins * 60000;
            if (now - last >= t) return '🔋';
            return `🪫 (باقي ${Math.floor((t - (now - last)) / 60000)} د)`;
        };
        
        const timeTxt = `
**استثمار** ${getBatt('استثمار', 3)}
**بخشيش** ${getBatt('tip', 10)}
**تحويل** ${getBatt('transfer', 2.5)}
**تداول** ${getBatt('تداول', 3)}
**راتب** ${getBatt('daily', 7)}
**روليت** ${getBatt('roulette', 7)}
**سلوت** ${getBatt('slot', 8)}
**صاروخ** ${getBatt('صاروخ', 4)}
**طاولة** ${getBatt('طاولة', 3)}
**لعبه** ${getBatt('game', 1)}
**زر** ${getBatt('zrr', 2.5)}
**ماين** ${getBatt('mine', 4)}
**قرض** ${getBatt('loan', 15)}
**ضربة جزاء** ${getBatt('pen', 4)}
**ارقام** ${getBatt('nums', 2.5)}
**مقاولة** ${getBatt('makawla', 5)}
**اكس-او** ${getBatt('xo', 2)}
**مخاطرة** ${getBatt('مخاطرة', 8)}
**سباق** ${getBatt('race', 3)}
**ابراج** ${getBatt('towers', 2.5)}
**ذاكرة** ${getBatt('ذاكرة', 5)}
**ايموجي** ${getBatt('ايموجي', 3)}
**كنز** ${getBatt('كنز', 3)}
**سوبر مخاطرة** ${getBatt('سوبر مخاطرة', 30)}
`;
        return sendEmbed(message, `⏳ **أوقات الأوامر الخاصة بك**\n${timeTxt}`, '#3498db');
    }

    // ==========================================
    // 8. المتجر والممتلكات والمقاولة
    // ==========================================
    if (command === 'متجر') {
        let shopText = '';
        for (let item in shopItems) shopText += `**${item}** : ${formatNumber(shopItems[item])}$\n`;
        return sendEmbed(message, `🛒 **المتجر**\n\n${shopText}`, '#f1c40f');
    }

    if (command === 'ممتلكاتي') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        let invText = '';
        for (let item in targetData.inventory) invText += `**${item}** : ${targetData.inventory[item]}\n`;
        return sendEmbed(message, `🎒 **ممتلكات ${target.username}**\n\n${invText || 'مفلس ومعندوش أي ممتلكات 😂💔'}`, '#3498db');
    }

    if (command === 'شراء') {
        if (args[1] === 'اسهم') {
            const count = parseInt(args[2]);
            if (isNaN(count) || count <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nشراء اسهم (العدد)', '#e74c3c');
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`buy_stock_${count}`).setPlaceholder('اختر الشركة اللي عايز تشتري منها').addOptions([
                    { label: 'ستاربكس', value: 'starbucks', description: 'الحد الأقصى 350 سهم' },
                    { label: 'ماكدونالدز', value: 'mcdonalds', description: 'الحد الأقصى 500 سهم' },
                    { label: 'أبل', value: 'apple', description: 'الحد الأقصى 300 سهم' },
                    { label: 'جوجل', value: 'google', description: 'الحد الأقصى 400 سهم' },
                    { label: 'مايكروسوفت', value: 'microsoft', description: 'الحد الأقصى 450 سهم' },
                    { label: 'تيسلا', value: 'tesla', description: 'الحد الأقصى 400 سهم' }
                ])
            );
            return message.reply({ embeds: [new EmbedBuilder().setDescription(`اختر الشركة اللي عايز تشتري منها **${count}** سهم:`).setColor('#3498db')], components: [row] });
        } else {
            const itemName = args.slice(1).join(' ');
            const price = shopItems[itemName];
            if (!price) return sendEmbed(message, 'المنتج ده مش في المتجر!', '#e74c3c');
            if (userData.balance < price) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');
            userData.balance -= price;
            userData.inventory[itemName] = (userData.inventory[itemName] || 0) + 1;
            userData.markModified('inventory');
            await userData.save();
            return sendEmbed(message, `تم شراء **${itemName}** ✅`, '#2ecc71');
        }
    }

    if (command === 'مقاولة') {
        if (await checkCooldown('makawla', 5)) return; // 5 دقايق
        const itemName = args[1];
        const count = parseInt(args[2]);
        if (!itemName || isNaN(count) || count <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nمقاولة (الاسم) (العدد)', '#e74c3c');
        if (!userData.inventory[itemName] || userData.inventory[itemName] < count) return sendEmbed(message, `انت مش معاك العدد ده من ${itemName}!`, '#e74c3c');
        
        userData.inventory[itemName] -= count;
        if (userData.inventory[itemName] === 0) delete userData.inventory[itemName];
        userData.markModified('inventory');
        
        if (Math.random() < 0.5) {
            const winAmount = (shopItems[itemName] * count) * 2;
            userData.balance += winAmount;
            await userData.save();
            return sendEmbed(message, `مبروك! المقاولة نجحت 🤑\nالمكسب: **${formatNumber(winAmount)}$**`, '#2ecc71');
        } else {
            await userData.save();
            return sendEmbed(message, `للأسف المقاولة فشلت وطارت ممتلكاتك 💔`, '#e74c3c');
        }
    }

    // ==========================================
    // 9. البورصة والأسهم (اسعار، اسهمي، بيع)
    // ==========================================
    if (command === 'اسعار') {
        let pricesText = '';
        const names = { apple: 'أبل', starbucks: 'ستاربكس', google: 'جوجل', microsoft: 'مايكروسوفت', mcdonalds: 'ماكدونالدز', tesla: 'تيسلا' };
        for (let stock in botConfig.stockPrices) {
            pricesText += `**سهم ${names[stock]}**: ${formatNumber(botConfig.stockPrices[stock])}$\n`;
        }
        return sendEmbed(message, `📈 **أسعار الأسهم في السوق**\n\n${pricesText}`, '#2ecc71');
    }

    if (command === 'اسهمي') {
        let stocksText = '';
        let totalValue = 0;
        const names = { apple: 'أبل', starbucks: 'ستاربكس', google: 'جوجل', microsoft: 'مايكروسوفت', mcdonalds: 'ماكدونالدز', tesla: 'تيسلا' };
        for (let stock in userData.stocks) {
            if (userData.stocks[stock] > 0) {
                stocksText += `**${names[stock]}**: ${userData.stocks[stock]} سهم\n`;
                totalValue += userData.stocks[stock] * botConfig.stockPrices[stock];
            }
        }
        if (stocksText === '') stocksText = 'لا تمتلك أي أسهم حالياً.';
        stocksText += `\n\n**القيمة الإجمالية لأسهمك الآن:** ${formatNumber(totalValue)}$ 💰`;
        return sendEmbed(message, `📊 **محفظتك الاستثمارية**\n\n${stocksText}`, '#9b59b6');
    }

    if (command === 'بيع' && args[1] === 'اسهم') {
        const company = args[2];
        const count = parseInt(args[3]);
        const companies = { 'ستاربكس': 'starbucks', 'ماكدونالدز': 'mcdonalds', 'ابل': 'apple', 'أبل': 'apple', 'جوجل': 'google', 'مايكروسوفت': 'microsoft', 'تيسلا': 'tesla' };
        
        if (!company || isNaN(count) || count <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nبيع اسهم (اسم الشركة) (العدد)', '#e74c3c');
        const stockKey = companies[company];
        if (!stockKey) return sendEmbed(message, 'اسم الشركة غلط!', '#e74c3c');
        if (!userData.stocks || userData.stocks[stockKey] < count) return sendEmbed(message, `انت مش معاك ${count} سهم في ${company}!`, '#e74c3c');
        
        const currentPrice = botConfig.stockPrices[stockKey];
        const totalProfit = currentPrice * count;
        
        userData.stocks[stockKey] -= count;
        userData.balance += totalProfit;
        userData.markModified('stocks');
        await userData.save();
        
        return sendEmbed(message, `تم بيع **${count}** سهم من **${company}** بنجاح ✅\nكسبت: **${formatNumber(totalProfit)}$**`, '#2ecc71');
    }
    // ==========================================
    // 10. الألعاب السريعة (تداول، صاروخ، روليت، الخ)
    // ==========================================
    if (command === 'استثمار' || command === 'تداول') {
        if (await checkCooldown(command, 3)) return; // 3 دقايق
        
        let amount;
        if (args[1] === 'نص') amount = Math.floor(userData.balance / 2);
        else if (args[1] === 'كامل') amount = userData.balance;
        else amount = parseAmount(args[1]);

        if (!amount || amount <= 0) return sendEmbed(message, `لتنفيذ الامر يرجي كتابة\n${command} (المبلغ/نص/كامل)`, '#e74c3c');
        if (amount > 100000000) amount = 100000000; // الحد الأقصى 100m
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');

        const isWin = Math.random() < 0.5; // نسبة 50%
        if (isWin) {
            const winPercents = [2, 25, 75, 200];
            const p = winPercents[Math.floor(Math.random() * winPercents.length)];
            const profit = Math.floor(amount * (p / 100));
            userData.balance += profit; await userData.save();
            return sendEmbed(message, `مبروك 👏😃 ${command}ك نجح بنسبة ${p}%\n\nمبلغ الارباح ${formatNumber(profit)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`, '#2ecc71');
        } else {
            const losePercents = [2, 10, 25, 50];
            const p = losePercents[Math.floor(Math.random() * losePercents.length)];
            const loss = Math.floor(amount * (p / 100));
            userData.balance -= loss; await userData.save();
            return sendEmbed(message, `${command}ك فشل يلا شد 😂\n\nمبلغ الخساره ${formatNumber(loss)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`, '#e74c3c');
        }
    }

    if (command === 'صاروخ' || command === 'طاولة') {
        const isRocket = command === 'صاروخ';
        if (await checkCooldown(command, isRocket ? 4 : 3)) return; // 4 صاروخ، 3 طاولة
        
        const amount = parseAmount(args[1]);
        if (!amount) return sendEmbed(message, `لتنفيذ الامر يرجي كتابة\n${command} (المبلغ)`, '#e74c3c');
        if (userData.balance < amount * 2) return sendEmbed(message, 'رصيدك لازم يغطي الخسارة المضاعفة!', '#e74c3c');

        const winChance = isRocket ? 0.80 : 0.50; // صاروخ 80% وطاولة 50%
        const isWin = Math.random() < winChance;
        const countries = ['مصر', 'السعودية', 'الإمارات', 'قطر', 'المغرب', 'إيطاليا', 'ألمانيا'];
        const country = countries[Math.floor(Math.random() * countries.length)];

        if (isWin) {
            userData.balance += amount * 2; await userData.save();
            return sendEmbed(message, `مبروك ! ${command} ناجح 🥳\nتم الارسال الي : ${country}\n\nالمكسب : ${formatNumber(amount * 2)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`, '#2ecc71');
        } else {
            userData.balance -= amount * 2; await userData.save();
            return sendEmbed(message, `ابلععععععع ${command} فاشل 😂\nتم الارسال الي : ${country}\n\nالخساره : ${formatNumber(amount * 2)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`, '#e74c3c');
        }
    }

    if (command === 'روليت') {
        if (await checkCooldown('roulette', 7)) return; // 7 دقايق
        
        const target = message.mentions.users.first();
        const amount = parseAmount(args[2]);
        if (!target || !amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nروليت @منشن (المبلغ)', '#e74c3c');
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');
        
        let targetData = await User.findOne({ userId: target.id });
        if (!targetData || targetData.balance < amount) return sendEmbed(message, 'رصيد الخصم غير كافي!', '#e74c3c');

        const winnerIsAuthor = Math.random() < 0.5;
        if (winnerIsAuthor) {
            userData.balance += amount; targetData.balance -= amount;
        } else {
            userData.balance -= amount; targetData.balance += amount;
        }
        await userData.save(); await targetData.save();
        
        const winner = winnerIsAuthor ? message.author : target;
        const winnerData = winnerIsAuthor ? userData : targetData;
        return sendEmbed(message, `لقد فاز ${winner} 🎲\n\nرصيدك الحالي ${formatNumber(winnerData.balance)}$`, '#2ecc71');
    }

    if (command === 'سلوت') {
        if (await checkCooldown('slot', 8)) return; // 8 دقايق
        
        let amount = parseAmount(args[1]);
        if (!amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nسلوت (المبلغ)', '#e74c3c');
        if (amount > 50000000) amount = 50000000; // الحد الأقصى 50m
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');

        const rand = Math.random();
        let emojis = ['🍒', '🍋', '🍉', '⭐', '💎'];
        let s1, s2, s3, profit = 0;

        if (rand < 0.20) { // 20% (3 أضعاف)
            s1 = s2 = s3 = emojis[Math.floor(Math.random() * emojis.length)];
            profit = amount * 3;
            userData.balance += profit; await userData.save();
            return sendEmbed(message, `**[ ${s1} | ${s2} | ${s3} ]**\n\nمبروك لقد ربحت !\nالمكسب : ${formatNumber(profit)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`, '#2ecc71');
        } else if (rand < 0.50) { // 30% (الضعف)
            s1 = emojis[Math.floor(Math.random() * emojis.length)];
            s2 = s1;
            s3 = emojis[Math.floor(Math.random() * emojis.length)];
            if (s1 === s3) s3 = emojis.find(e => e !== s1); // عشان ميكونوش 3 متشابهين
            profit = amount * 2;
            userData.balance += profit; await userData.save();
            return sendEmbed(message, `**[ ${s1} | ${s2} | ${s3} ]**\n\nمبروك لقد ربحت !\nالمكسب : ${formatNumber(profit)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`, '#2ecc71');
        } else { // 50% خسارة
            s1 = emojis[0]; s2 = emojis[1]; s3 = emojis[2]; 
            userData.balance -= amount; await userData.save();
            return sendEmbed(message, `**[ ${s1} | ${s2} | ${s3} ]**\n\nابلععععع خسرت 😂\nرصيدك الحالي : ${formatNumber(userData.balance)}$`, '#e74c3c');
        }
    }

    if (command === 'مخاطرة' || command === 'سوبر') {
        const isSuper = command === 'سوبر' && args[1] === 'مخاطرة';
        const cmdName = isSuper ? 'سوبر مخاطرة' : 'مخاطرة';
        const type = isSuper ? args[2] : args[1];
        
        if (type !== 'نص' && type !== 'كامل') return sendEmbed(message, `لتنفيذ الامر يرجي كتابة\n${cmdName} (نص/كامل)`, '#e74c3c');
        
        if (await checkCooldown(cmdName, isSuper ? 30 : 8)) return; // 30 للسوبر، 8 للمخاطرة العادية
        
        const amount = type === 'نص' ? Math.floor(userData.balance / 2) : userData.balance;
        if (amount <= 0) return sendEmbed(message, 'رصيدك صفر!', '#e74c3c');

        const isWin = Math.random() < 0.5; // نسبة 50%
        if (isWin) {
            const r = Math.random();
            let multi = 1; // 100%
            if (r < 0.1) multi = 3; // 10% لنسبة 300%
            else if (r < 0.3) multi = 2; // 20% لنسبة 200%
            else if (r < 0.6) multi = 1.5; // 30% لنسبة 150%

            if (isSuper) multi *= 2; // مضاعفة النسب في السوبر

            const profit = Math.floor(amount * multi);
            userData.balance += profit; await userData.save();
            return sendEmbed(message, `مبروك 👏😃 ${cmdName} ناجح بنسبة ${multi * 100}%\n\nمبلغ الارباح ${formatNumber(profit)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`, '#2ecc71');
        } else {
            const r = Math.random();
            let lossMulti = 0.5; // 50%
            if (r < 0.05) lossMulti = 2; // 5% يخسر كل حاجة 200%
            else if (r < 0.3) lossMulti = 1; // 25% يخسر 100%

            if (isSuper && lossMulti !== 2) lossMulti *= 2;
            
            let loss = Math.floor(amount * lossMulti);
            if (loss > userData.balance) loss = userData.balance;
            userData.balance -= loss;

            // عقاب الممتلكات في السوبر
            if (isSuper) {
                if (lossMulti === 0.5 || lossMulti === 1) {
                    for (let k in userData.inventory) userData.inventory[k] = Math.floor(userData.inventory[k] / 2);
                } else if (lossMulti >= 2) {
                    userData.inventory = {};
                }
                userData.markModified('inventory');
            }

            await userData.save();
            return sendEmbed(message, `${cmdName} فشل يلا شد 😂\n\nمبلغ الخساره ${formatNumber(loss)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`, '#e74c3c');
        }
    }
    // ==========================================
    // 11. لعبة حجرة ورقة مقص ولعبة الزر
    // ==========================================
    if (command === 'لعبه' || command === 'لعبة') {
        if (await checkCooldown('game', 1)) return; // دقيقة
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('g_rock').setEmoji('🪨').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('g_paper').setEmoji('📄').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('g_scissors').setEmoji('✂️').setStyle(ButtonStyle.Primary)
        );
        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription('اختار بسرعة وحاول تغلبني!').setColor('#3498db')], components: [row] });
        const col = msgObj.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000, max: 1 });
        col.on('collect', async i => {
            if (Math.random() < 0.60) {
                let winAmount = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
                userData.balance += winAmount; await userData.save();
                return i.update({ embeds: [new EmbedBuilder().setDescription(`🎉 كسبتني! الجايزة بتاعتك **${formatNumber(winAmount)}$**`).setColor('#2ecc71')], components: [] });
            } else {
                return i.update({ embeds: [new EmbedBuilder().setDescription(`😂 اتعادلنا أو خسرت! مفيش فلوس المرة دي، حاول تاني.`).setColor('#e74c3c')], components: [] });
            }
        });
    }

    if (command === 'زر') {
        const target = message.mentions.users.first();
        let amount = parseAmount(args[2]);
        if (!target || !amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nزر @منشن (المبلغ)', '#e74c3c');
        if (amount > 80000000) amount = 80000000; // 80m
        let targetData = await User.findOne({ userId: target.id });
        if (userData.balance < amount || !targetData || targetData.balance < amount) return sendEmbed(message, 'رصيد أحد الطرفين لا يكفي!', '#e74c3c');
        if (await checkCooldown('zrr', 2.5)) return;

        const acceptRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('z_acc').setLabel('موافقة').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('z_rej').setLabel('رفض').setStyle(ButtonStyle.Danger)
        );
        let invMsg = await message.reply({ content: `${target}`, embeds: [new EmbedBuilder().setDescription(`هل تقبل تحدي الزر ضد ${message.author} بمبلغ **${formatNumber(amount)}$**؟`).setColor('#f1c40f')], components: [acceptRow] });
        const invCol = invMsg.createMessageComponentCollector({ filter: i => i.user.id === target.id, time: 15000, max: 1 });
        
        invCol.on('collect', async i => {
            if (i.customId === 'z_rej') return i.update({ embeds: [new EmbedBuilder().setDescription('تم رفض التحدي.').setColor('#e74c3c')], components: [] });
            await i.update({ embeds: [new EmbedBuilder().setDescription('التحدي هيبدأ! ركزوا...').setColor('#3498db')], components: [] });
            
            setTimeout(async () => {
                await invMsg.edit({ content: `${message.author} ${target}`, embeds: [new EmbedBuilder().setDescription(`أول من يضغط علي الزر سوف يربح **${formatNumber(amount)}$** 🚀`).setColor('#9b59b6')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('z_clk').setLabel('اضغط هنا!').setStyle(ButtonStyle.Success))] });
                const gameCol = invMsg.createMessageComponentCollector({ filter: btn => [message.author.id, target.id].includes(btn.user.id), time: 15000, max: 1 });
                gameCol.on('collect', async btn => {
                    let winnerId = btn.user.id; let loserId = winnerId === message.author.id ? target.id : message.author.id;
                    let wData = await User.findOne({ userId: winnerId }); let lData = await User.findOne({ userId: loserId });
                    wData.balance += amount; lData.balance -= amount; await wData.save(); await lData.save();
                    return btn.update({ content: '', embeds: [new EmbedBuilder().setDescription(`🎉 الفائز هو <@${winnerId}> كسب **${formatNumber(amount)}$** واللي اتأخر خسرهم!`).setColor('#2ecc71')], components: [] });
                });
            }, 5000);
        });
    }

    // ==========================================
    // 12. لعبة ماينز (بالمضاعفات وكشف القنابل)
    // ==========================================
    if (command === 'ماين') {
        let amount = parseAmount(args[1]);
        if (!amount || amount <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nماين (المبلغ)', '#e74c3c');
        if (amount > 500000000) amount = 500000000;
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');
        if (await checkCooldown('mine', 4)) return;

        userData.balance -= amount; await userData.save();
        
        let bs = []; while (bs.length < 3) { let r = Math.floor(Math.random() * 20); if (!bs.includes(r)) bs.push(r); }
        let clks = [];
        
        const getGrid = (reveal = false, bombIdx = -1) => {
            let rs = [];
            for (let i = 0; i < 4; i++) {
                let rw = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    let idx = i * 5 + j;
                    let isBomb = bs.includes(idx); let isClicked = clks.includes(idx);
                    let lbl = reveal ? (isBomb ? '💣' : '💎') : (isClicked ? '💎' : '❓');
                    let stl = ButtonStyle.Primary; // أزرق افتراضي
                    if (reveal) {
                        if (isBomb) stl = (idx === bombIdx) ? ButtonStyle.Danger : ButtonStyle.Secondary;
                        else stl = ButtonStyle.Success;
                    } else if (isClicked) stl = ButtonStyle.Success;
                    rw.addComponents(new ButtonBuilder().setCustomId(`m_${idx}`).setLabel(lbl).setStyle(stl).setDisabled(reveal || isClicked));
                }
                rs.push(rw);
            }
            rs.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('mcash').setLabel('جمع الأرباح').setStyle(ButtonStyle.Success).setDisabled(reveal || clks.length === 0)));
            return rs;
        };

        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription(`مجموع القنابل:\n3-4\n\nالارباح:\n0$`).setColor('#2b2d31')], components: getGrid() });
        const col = msgObj.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
        
        col.on('collect', async i => {
            if (i.customId === 'mcash') {
                col.stop();
                let won = Math.floor(amount * (clks.length * 1.5));
                userData.balance += won; await userData.save();
                return i.update({ embeds: [new EmbedBuilder().setDescription(`انسحبت وكسبت **${formatNumber(won)}$**`).setColor('#2ecc71')], components: getGrid(true) });
            }
            let idx = parseInt(i.customId.split('_')[1]);
            if (bs.includes(idx)) {
                col.stop();
                return i.update({ embeds: [new EmbedBuilder().setDescription(`بوممم 💣! دوست على لغم وخسرت فلوسك!`).setColor('#e74c3c')], components: getGrid(true, idx) });
            }
            clks.push(idx);
            let won = Math.floor(amount * (clks.length * 1.5));
            i.update({ embeds: [new EmbedBuilder().setDescription(`مجموع القنابل:\n3-4\n\nالارباح:\n${formatNumber(won)}$`).setColor('#2b2d31')], components: getGrid() });
        });
    }

    // ==========================================
    // 13. أرقام وضربة جزاء (بكشف المستور)
    // ==========================================
    if (command === 'ارقام') {
        let amount = parseAmount(args[1]);
        if (!amount || amount <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\ارقام (المبلغ)', '#e74c3c');
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');
        if (await checkCooldown('nums', 2.5)) return;

        userData.balance -= amount; await userData.save();
        let vs = Array(10).fill(0).concat(Array(10).fill(0).map(() => Math.floor(Math.random() * 14) + 2)).sort(() => Math.random() - 0.5);

        const getGrid = (reveal = false, clickedIdx = -1) => {
            let rs = [];
            for (let i = 0; i < 4; i++) {
                let rw = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    let idx = i * 5 + j;
                    let lbl = reveal ? `${vs[idx]}x` : '❓';
                    let stl = ButtonStyle.Primary;
                    if (reveal) {
                        if (vs[idx] === 0) stl = (idx === clickedIdx) ? ButtonStyle.Danger : ButtonStyle.Secondary;
                        else stl = (idx === clickedIdx) ? ButtonStyle.Success : ButtonStyle.Secondary;
                    }
                    rw.addComponents(new ButtonBuilder().setCustomId(`n_${idx}`).setLabel(lbl).setStyle(stl).setDisabled(reveal));
                }
                rs.push(rw);
            }
            return rs;
        };

        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription(`**لعبة أرقام** 🔢\nاختر مربع وحظك هيحدد المضاعف!`).setColor('#3498db')], components: getGrid() });
        const col = msgObj.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 30000, max: 1 });
        col.on('collect', async i => {
            let idx = parseInt(i.customId.split('_')[1]);
            let multi = vs[idx]; let won = amount * multi;
            userData.balance += won; await userData.save();
            let text = multi === 0 ? `للأسف طلعلك 0x وخسرت فلوسك 💔` : `🎉 مبروك طلعلك ${multi}x وكسبت **${formatNumber(won)}$**!`;
            return i.update({ embeds: [new EmbedBuilder().setDescription(text).setColor(multi === 0 ? '#e74c3c' : '#2ecc71')], components: getGrid(true, idx) });
        });
    }

    if (command === 'ضربة' && args[1] === 'جزاء') {
        const amount = parseAmount(args[2]);
        if (!amount || amount <= 0) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nضربة جزاء (المبلغ)', '#e74c3c');
        if (userData.balance < amount) return sendEmbed(message, 'رصيدك غير كافي!', '#e74c3c');
        if (await checkCooldown('pen', 4)) return;

        userData.balance -= amount; await userData.save();
        let bs = []; while (bs.length < 6) { let r = Math.floor(Math.random() * 15); if (!bs.includes(r)) bs.push(r); }

        const getGrid = (reveal = false, clickedIdx = -1) => {
            let rs = [];
            for (let i = 0; i < 3; i++) {
                let rw = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    let idx = i * 5 + j;
                    let isBomb = bs.includes(idx);
                    let lbl = reveal ? (isBomb ? '❌' : '🥅') : '🥅';
                    if (reveal && idx === clickedIdx && !isBomb) lbl = '⚽';
                    let stl = ButtonStyle.Primary;
                    if (reveal) {
                        if (isBomb) stl = (idx === clickedIdx) ? ButtonStyle.Danger : ButtonStyle.Secondary;
                        else stl = (idx === clickedIdx) ? ButtonStyle.Success : ButtonStyle.Secondary;
                    }
                    rw.addComponents(new ButtonBuilder().setCustomId(`p_${idx}`).setLabel(lbl).setStyle(stl).setDisabled(reveal));
                }
                rs.push(rw);
            }
            return rs;
        };

        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription(`**ضربة جزاء** ⚽\nشوت في مكان مفهوش الحارس!`).setColor('#3498db')], components: getGrid() });
        const col = msgObj.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 20000, max: 1 });
        col.on('collect', async i => {
            let idx = parseInt(i.customId.split('_')[1]);
            if (bs.includes(idx)) return i.update({ embeds: [new EmbedBuilder().setDescription(`❌ الحارس صدها وخسرت فلوسك!`).setColor('#e74c3c')], components: getGrid(true, idx) });
            let won = amount * 2; userData.balance += won; await userData.save();
            return i.update({ embeds: [new EmbedBuilder().setDescription(`⚽ جووووول! كسبت **${formatNumber(won)}$**`).setColor('#2ecc71')], components: getGrid(true, idx) });
        });
    }

    // ==========================================
    // 14. السباق والإكس أو والأبراج وباقي الألعاب
    // ==========================================
    if (command === 'سباق') {
        const choice = parseInt(args[1]); const amount = parseAmount(args[2]);
        if (![1, 2, 3].includes(choice) || !amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nسباق (رقم 1-3) (المبلغ)', '#e74c3c');
        if (userData.balance < amount * 2) return sendEmbed(message, 'رصيد لا يغطي الخسارة المضاعفة!', '#e74c3c');
        if (await checkCooldown('race', 3)) return;

        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription('#1/----------🚙\n#2/----------🚙\n#3/----------🚙').setColor('#3498db')] });
        let p = [0, 0, 0]; let win = 0;
        
        let int = setInterval(async () => {
            for (let i = 0; i < 3; i++) p[i] += Math.floor(Math.random() * 4);
            let t = '';
            for (let i = 0; i < 3; i++) {
                if (p[i] >= 10) { win = i + 1; clearInterval(int); }
                t += `#${i + 1}/${'-'.repeat(10 - Math.min(10, p[i]))}🚙${'-'.repeat(Math.min(10, p[i]))}\n`;
            }
            if (win) {
                let isWin = win === choice;
                if (isWin) userData.balance += amount * 2; else userData.balance -= amount * 2;
                await userData.save();
                return msgObj.edit({ embeds: [new EmbedBuilder().setDescription(`${t}\n\n${isWin ? 'مكسب 🚀' : 'القمم خسرت يالسباق 😂💔'}`).setColor(isWin ? '#2ecc71' : '#e74c3c')] });
            }
            msgObj.edit({ embeds: [new EmbedBuilder().setDescription(t).setColor('#3498db')] });
        }, 1500);
    }

    if (command === 'ابراج') {
        const amount = parseAmount(args[1]);
        if (!amount || userData.balance < amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nابراج (المبلغ)', '#e74c3c');
        if (await checkCooldown('towers', 2.5)) return;

        userData.balance -= amount; await userData.save();
        let currentMulti = 1; let currentRow = 4;
        const bs = Array.from({ length: 5 }, () => Math.floor(Math.random() * 3));
        
        const getRows = (act) => {
            let rs = [];
            for (let i = 0; i < 5; i++) {
                let rw = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) rw.addComponents(new ButtonBuilder().setCustomId(`t_${i}_${j}`).setLabel('❓').setStyle(ButtonStyle.Primary).setDisabled(i !== act));
                rs.push(rw);
            }
            rs.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cashout').setLabel('جمع ارباح').setStyle(ButtonStyle.Success)));
            return rs;
        };

        let msgObj = await message.reply({ embeds: [new EmbedBuilder().setDescription(`**لعبة الأبراج**\nالمضاعف: x${currentMulti}`).setColor('#3498db')], components: getRows(currentRow) });
        const col = msgObj.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
        col.on('collect', async i => {
            if (i.customId === 'cashout') {
                let won = amount * currentMulti; userData.balance += won; await userData.save();
                col.stop(); return i.update({ embeds: [new EmbedBuilder().setDescription(`انسحبت وكسبت **${formatNumber(won)}$**`).setColor('#2ecc71')], components: [] });
            }
            const [_, rowIdx, colIdx] = i.customId.split('_');
            if (parseInt(colIdx) === bs[parseInt(rowIdx)]) {
                col.stop(); return i.update({ embeds: [new EmbedBuilder().setDescription(`بومممم 💣! خسرت فلوسك`).setColor('#e74c3c')], components: [] });
            }
            currentRow--; currentMulti *= 2;
            if (currentRow < 0) {
                let won = amount * currentMulti; userData.balance += won; await userData.save();
                col.stop(); return i.update({ embeds: [new EmbedBuilder().setDescription(`كسبت الأبراج كلها! 🎉 الأرباح: **${formatNumber(won)}$**`).setColor('#2ecc71')], components: [] });
            }
            await i.update({ embeds: [new EmbedBuilder().setDescription(`**لعبة الأبراج**\nالمضاعف: x${currentMulti}`).setColor('#3498db')], components: getRows(currentRow) });
        });
    }

    if (command === 'اكس-او' || command === 'اكس') {
        const target = message.mentions.users.first();
        let amount = parseAmount(args[2] || args[1]);
        if (!target || !amount) return sendEmbed(message, 'لتنفيذ الامر يرجي كتابة\nاكس او @منشن (المبلغ)', '#e74c3c');
        let targetData = await User.findOne({ userId: target.id });
        if (userData.balance < amount || !targetData || targetData.balance < amount) return sendEmbed(message, 'رصيد أحد الطرفين لا يكفي!', '#e74c3c');
        if (await checkCooldown('xo', 2)) return;

        let invMsg = await message.reply({ content: `${target}`, embeds: [new EmbedBuilder().setDescription(`تقبل التحدي بـ ${formatNumber(amount)}$؟`).setColor('#f1c40f')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('x_acc').setLabel('موافقة').setStyle(ButtonStyle.Success))] });
        const invCol = invMsg.createMessageComponentCollector({ filter: i => i.user.id === target.id, time: 15000, max: 1 });
        
        invCol.on('collect', async i => {
            userData.balance -= amount; targetData.balance -= amount; await userData.save(); await targetData.save();
            let board = [0, 1, 2, 3, 4, 5, 6, 7, 8]; let turn = message.author.id;
            
            const getRws = () => {
                let rs = [];
                for (let r = 0; r < 3; r++) {
                    let rw = new ActionRowBuilder();
                    for (let c = 0; c < 3; c++) {
                        let v = board[r * 3 + c]; let isN = isNaN(v);
                        rw.addComponents(new ButtonBuilder().setCustomId(`x_${r * 3 + c}`).setLabel(isN ? '-' : v).setStyle(v === 'X' ? ButtonStyle.Danger : (v === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary)).setDisabled(!isN));
                    }
                    rs.push(rw);
                }
                return rs;
            };
            
            await i.update({ content: '', embeds: [new EmbedBuilder().setDescription(`بدأ التحدي! دور <@${turn}>`).setColor('#3498db')], components: getRws() });
            const gCol = invMsg.createMessageComponentCollector({ filter: btn => [message.author.id, target.id].includes(btn.user.id), time: 60000 });
            gCol.on('collect', async btn => {
                if (btn.user.id !== turn) return btn.reply({ content: 'مش دورك!', ephemeral: true });
                board[parseInt(btn.customId.split('_')[1])] = turn === message.author.id ? 'X' : 'O';
                const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(w => board[w[0]] === board[w[1]] && board[w[1]] === board[w[2]] && isNaN(board[w[0]]));
                if (w) { gCol.stop(); let wd = await User.findOne({ userId: turn }); wd.balance += amount * 2; await wd.save(); return btn.update({ embeds: [new EmbedBuilder().setDescription(`🎉 مبروك <@${turn}> كسبت ${formatNumber(amount * 2)}$!`).setColor('#2ecc71')], components: getRws() }); }
                if (board.every(x => isNaN(x))) { gCol.stop(); return btn.update({ embeds: [new EmbedBuilder().setDescription(`تعادل! راحت الفلوس عليكم انتوا الاتنين 😂`).setColor('#f1c40f')], components: getRws() }); }
                turn = turn === message.author.id ? target.id : message.author.id;
                await btn.update({ embeds: [new EmbedBuilder().setDescription(`دور <@${turn}>`).setColor('#3498db')], components: getRws() });
            });
        });
    }

    if (command === 'ذاكرة' || command === 'ايموجي' || command === 'كنز') {
        const amount = parseAmount(args[1]);
        if (!amount || userData.balance < amount) return sendEmbed(message, `لتنفيذ الامر يرجي كتابة\n${command} (المبلغ)`, '#e74c3c');
        if (await checkCooldown(command, command === 'ذاكرة' ? 5 : 3)) return;
        
        userData.balance -= amount; await userData.save();

        if (command === 'ذاكرة') {
            const ems = ['🍎', '🍌', '🍉']; const tg = ems[Math.floor(Math.random() * 3)];
            let m = await message.reply({ embeds: [new EmbedBuilder().setDescription(`ركز! الايموجيات دي هتختفي: **🍎 🍌 🍉**`).setColor('#3498db')] });
            setTimeout(async () => {
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('e_0').setLabel('🍎').setStyle(2), new ButtonBuilder().setCustomId('e_1').setLabel('🍌').setStyle(2), new ButtonBuilder().setCustomId('e_2').setLabel('🍉').setStyle(2));
                await m.edit({ embeds: [new EmbedBuilder().setDescription(`فين كان الـ **${tg}**؟`).setColor('#f1c40f')], components: [row] });
                const col = m.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 10000, max: 1 });
                col.on('collect', async i => {
                    if (i.component.label === tg) { userData.balance += amount * 2; await userData.save(); i.update({ embeds: [new EmbedBuilder().setDescription(`🎉 صح! كسبت **${formatNumber(amount * 2)}$**`).setColor('#2ecc71')], components: [] }); }
                    else i.update({ embeds: [new EmbedBuilder().setDescription(`❌ غلط! خسرت رهانك.`).setColor('#e74c3c')], components: [] });
                });
            }, 3000);
        } else if (command === 'ايموجي') {
            await message.reply({ embeds: [new EmbedBuilder().setDescription(`اكتب الايموجي المختلف هنا بسرعة:\n👻👻👻👻👻👻👻👻👽👻👻👻👻👻\nأول واحد هيكسب **${formatNumber(amount * 2)}$** (10 ثواني)`).setColor('#3498db')] });
            const col = message.channel.createMessageCollector({ filter: m => m.content === '👽', time: 10000, max: 1 });
            col.on('collect', async m => { let wd = await User.findOne({ userId: m.author.id }); wd.balance += amount * 2; await wd.save(); sendEmbed(m, `🎉 بطل يا ${m.author}!`, '#2ecc71'); });
        } else if (command === 'كنز') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tr_1').setLabel('📦').setStyle(2), new ButtonBuilder().setCustomId('tr_2').setLabel('📦').setStyle(2), new ButtonBuilder().setCustomId('tr_3').setLabel('📦').setStyle(2));
            let m = await message.reply({ embeds: [new EmbedBuilder().setDescription(`اختر صندوق الكنز بـ ${formatNumber(amount)}$:`).setColor('#f1c40f')], components: [row] });
            const col = m.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000, max: 1 });
            col.on('collect', async i => {
                if (Math.random() < 0.33) { userData.balance += amount * 3; await userData.save(); i.update({ embeds: [new EmbedBuilder().setDescription(`🎉 لقيت الكنز! كسبت **${formatNumber(amount * 3)}$**`).setColor('#2ecc71')], components: [] }); }
                else i.update({ embeds: [new EmbedBuilder().setDescription(`❌ الصندوق فاضي! خسرت فلوسك 💔`).setColor('#e74c3c')], components: [] });
            });
        }
    }

    // ==========================================
    // 15. قائمة الأوامر الشاملة (Help)
    // ==========================================
    if (command === 'اوامر' || command === '#اوامر') {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('help_menu').setPlaceholder('اختر قائمة الأوامر من هنا').addOptions([
                { label: 'اوامر الالعاب والاقتصاد', value: 'games', emoji: '🎮' },
                { label: 'اوامر الادمن', value: 'admin', emoji: '⚙️' }
            ])
        );
        return message.reply({ embeds: [new EmbedBuilder().setDescription('**القائمة الرئيسية للأوامر:**\nاضغط على القائمة المنسدلة تحت عشان تشوف الأوامر.').setColor('#2b2d31')], components: [row] });
    }
});

// ==========================================
// 16. التفاعلات الشاملة (القوائم المنسدلة للأسهم والمساعدة)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'help_menu') {
            if (interaction.values[0] === 'games') {
                const embed = new EmbedBuilder().setTitle('🎮 اوامر الالعاب والاقتصاد').setColor('#2b2d31')
                    .setDescription(`**#رصيد** - **#راتب** - **#بخشيش** - **#وقت**\n**#تحويل** - **#نهب**\n**#مخاطرة** - **#استثمار** - **#تداول**\n**#صاروخ** - **#طاولة** - **#مقاولة**\n**#متجر** - **#شراء** - **#ممتلكاتي**\n**#زر** - **#قرض** - **#تسديد**\n**#اسعار** - **#اسهمي** - **#شراء اسهم** - **#بيع اسهم**\n**#ابراج** - **#اكس-او** - **#سباق**\n**#ضربة جزاء** - **#سلوت** - **#روليت**\n**#ماين** - **#لعبة** - **#ارقام**\n**#ذاكرة** - **#ايموجي** - **#كنز**`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else if (interaction.values[0] === 'admin') {
                const embed = new EmbedBuilder().setTitle('⚙️ اوامر الادمن').setColor('#2b2d31').setDescription(`**اضافة اونر @منشن**\n**ازالة اونر @منشن**\n**تصفية**`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        if (interaction.customId.startsWith('buy_stock_')) {
            const count = parseInt(interaction.customId.split('_')[2]);
            const stockKey = interaction.values[0];
            const limits = { apple: 300, starbucks: 350, google: 400, microsoft: 450, mcdonalds: 500, tesla: 400 };
            
            let uData = await User.findOne({ userId: interaction.user.id });
            let bConfig = await BotConfig.findOne({ botId: 'main' });
            
            const currentOwned = uData.stocks?.[stockKey] || 0;
            if (currentOwned + count > limits[stockKey]) return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`❌ أقصى حد ${limits[stockKey]} سهم!`).setColor('#e74c3c')], ephemeral: true });
            
            const totalPrice = bConfig.stockPrices[stockKey] * count;
            if (uData.balance < totalPrice) return interaction.reply({ embeds: [new EmbedBuilder().setDescription(`❌ رصيدك غير كافي! تحتاج **${formatNumber(totalPrice)}$**.`).setColor('#e74c3c')], ephemeral: true });
            
            uData.balance -= totalPrice;
            uData.stocks[stockKey] = currentOwned + count;
            uData.markModified('stocks'); await uData.save();
            return interaction.update({ content: '', embeds: [new EmbedBuilder().setDescription(`✅ مبروك! تم شراء **${count}** سهم بنجاح.\nالتكلفة: **${formatNumber(totalPrice)}$**`).setColor('#2ecc71')], components: [] });
        }
    }
});

// ==========================================
// 17. تشغيل قاعدة البيانات والبوت
// ==========================================
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => { 
        console.log('MongoDB Connected Successfully!'); 
        client.login(process.env.TOKEN); 
    })
    .catch(err => console.log('MongoDB Error:', err));
