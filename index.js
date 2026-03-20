const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');
const express = require('express');
const { User, BotConfig } = require('./Schema');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('Paris Bank is Active!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running...'));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// دالة تحويل المبالغ (k, m, b, t)
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

// دالة تنسيق الأرقام
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'b';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

const shopItems = {
    'جوال': 10000, 'بيسي': 20000, 'سيارة': 100000, 'قصر': 1200000,
    'طيارة': 3000000, 'شركة': 7000000, 'مطعم': 10000000, 'يخت': 25000000,
    'قطار': 30000000, 'جزيرة': 50000000, 'قرية': 150000000, 'قلعة': 200000000, 'دولة': 500000000
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const args = message.content.trim().split(/ +/);
    const command = args[0];

    let botConfig = await BotConfig.findOne({ botId: 'main' }) || await BotConfig.create({ botId: 'main' });
    let userData = await User.findOne({ userId: message.author.id }) || await User.create({ userId: message.author.id });

    const now = Date.now();

    // ==========================================
    // نظام فحص السجن التلقائي (Jail System)
    // ==========================================
    if (userData.loan && userData.loan.amount > 0 && !userData.isJailed) {
        // لو عدى 3 ساعات (10800000 مللي ثانية)
        if (now - userData.loan.takenAt >= 10800000) {
            userData.isJailed = true;
            await userData.save();
        }
    }

    if (userData.isJailed && !['تسديد', 'سجني', 'لعبه'].includes(command)) {
        return message.reply('🚨 **أنت مسجون حالياً بسبب عدم تسديد القرض!**\nلا يمكنك استخدام أي أمر سوى `تسديد` أو `سجني` أو `لعبه`.');
    }

    // ==========================================
    // الاقتصاد الأساسي
    // ==========================================
    if (command === 'رصيد' || command === 'فلوس') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        const embed = new EmbedBuilder().setAuthor({ name: 'PariS community bank', iconURL: message.guild.iconURL() })
            .setTitle('مجموع فلوسك هو:').setDescription(`**${formatNumber(targetData.balance)} | ${targetData.balance}$**`)
            .setColor('#2b2d31').setFooter({ text: 'لعرض الأوامر #اوامر' });
        return message.reply({ embeds: [embed] });
    }

    if (command === 'تحويل') {
        const target = message.mentions.users.first(); const amount = parseAmount(args[2]);
        if (!target || !amount || amount <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nتحويل @منشن (المبلغ)');
        if (amount > 500000000) return message.reply('الحد الأقصى للتحويل في المرة الواحدة هو **500m**!');
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        userData.balance -= amount; targetData.balance += amount;
        await userData.save(); await targetData.save(); return message.reply(`تم تحويل **${formatNumber(amount)}$** إلى ${target} ✅`);
    }

    // ==========================================
    // المتجر والممتلكات والمقاولة
    // ==========================================
    if (command === 'متجر' || command === '#متجر') {
        let shopText = ''; for (let item in shopItems) shopText += `**${item}** : ${formatNumber(shopItems[item])}$\n`;
        return message.reply({ embeds: [new EmbedBuilder().setTitle('🛒 المتجر').setDescription(shopText).setColor('#f1c40f')] });
    }

    if (command === 'ممتلكاتي') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        let invText = ''; for (let item in targetData.inventory) invText += `**${item}** : ${targetData.inventory[item]}\n`;
        return message.reply({ embeds: [new EmbedBuilder().setTitle(`🎒 ممتلكات ${target.username}`).setDescription(invText || 'مفلس ومعندوش أي ممتلكات 😂💔').setColor('#3498db')] });
    }

    if (command === '#شراء') {
        const itemName = args.slice(1).join(' '); const price = shopItems[itemName];
        if (!price) return message.reply('المنتج ده مش في المتجر!');
        if (userData.balance < price) return message.reply('رصيدك غير كافي!');
        userData.balance -= price; userData.inventory[itemName] = (userData.inventory[itemName] || 0) + 1;
        userData.markModified('inventory'); await userData.save(); return message.reply(`تم شراء **${itemName}** ✅`);
    }

    if (command === 'مقاولة') {
        const itemName = args[1]; const count = parseInt(args[2]);
        if (!itemName || isNaN(count) || count <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nمقاولة (الاسم) (العدد)');
        
        const cooldownTime = 5 * 60 * 1000; // 5 دقايق
        const lastUsed = userData.cooldowns?.makawla || 0;
        if (now - lastUsed < cooldownTime) return message.reply(`انتظر **${Math.ceil((cooldownTime - (now - lastUsed)) / 60000)}** دقيقة لاستخدام المقاولة مرة أخرى ⏳`);

        if (!userData.inventory[itemName] || userData.inventory[itemName] < count) return message.reply(`انت مش معاك العدد ده من ${itemName}!`);
        
        userData.inventory[itemName] -= count; 
        if (userData.inventory[itemName] === 0) delete userData.inventory[itemName];
        
        userData.cooldowns = { ...userData.cooldowns, makawla: now };
        userData.markModified('inventory'); userData.markModified('cooldowns');
        
        if (Math.random() < 0.5) { 
            const winAmount = (shopItems[itemName] * count) * 2;
            userData.balance += winAmount; await userData.save(); 
            return message.reply(`مبروك! المقاولة نجحت 🤑\nالمكسب: **${formatNumber(winAmount)}$**`); 
        } else { 
            await userData.save(); return message.reply(`للأسف المقاولة فشلت وطارت ممتلكاتك 💔`); 
        }
    }
    // ==========================================
    // القروض، السجن، والتسديد
    // ==========================================
    if (command === 'قرض') {
        const cd = 15 * 60 * 1000; // 15 دقيقة
        const lastLoan = userData.cooldowns?.loan || 0;
        if (now - lastLoan < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastLoan)) / 60000)}** دقيقة لطلب قرض جديد ⏳`);
        
        if (userData.loan && userData.loan.amount > 0) return message.reply('أنت واخد قرض بالفعل ولازم تسدده الأول!');

        // مبلغ عشوائي بين 300k و 500k
        const amount = Math.floor(Math.random() * (500000 - 300000 + 1)) + 300000; 
        
        userData.balance += amount;
        userData.loan = { amount: amount, takenAt: now };
        userData.isJailed = false;
        userData.cooldowns = { ...userData.cooldowns, loan: now };
        userData.markModified('cooldowns');
        await userData.save();
        
        const embed = new EmbedBuilder()
            .setTitle('🏦 بنك باريس - القروض')
            .setDescription(`تم إيداع **${formatNumber(amount)}$** في رصيدك كقرض.\n\n⚠️ **تنبيه هام:** معاك 3 ساعات بس لتسديد القرض ده، وإلا هيتم سجنك ومش هتقدر تستخدم أي أوامر تانية باستثناء الألعاب المسموحة!`)
            .setColor('#e74c3c');
        return message.reply({ embeds: [embed] });
    }

    if (command === 'سجني') {
        if (!userData.loan || userData.loan.amount === 0) {
            return message.reply('أنت لست مديوناً للبنك، سجلك نظيف! 😇');
        }

        const timeLeft = 10800000 - (now - userData.loan.takenAt); // 3 ساعات
        
        if (timeLeft <= 0 || userData.isJailed) {
            return message.reply(`🚨 **أنت مسجون بالفعل!**\nمبلغ القرض المطلوب سداده: **${formatNumber(userData.loan.amount)}$**\nاستخدم أمر \`تسديد\` لفك سجنك.`);
        }

        const hours = Math.floor(timeLeft / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);

        const embed = new EmbedBuilder()
            .setTitle('⚖️ حالة السجن والديون')
            .setDescription(`**مبلغ القرض:** ${formatNumber(userData.loan.amount)}$\n**الوقت المتبقي قبل السجن:** ⏳ ${hours} ساعات و ${minutes} دقائق`)
            .setColor('#f1c40f');
        return message.reply({ embeds: [embed] });
    }

    if (command === 'تسديد') {
        const target = message.mentions.users.first() || message.author;
        let targetData = await User.findOne({ userId: target.id });

        if (!targetData || !targetData.loan || targetData.loan.amount === 0) {
            return message.reply(target.id === message.author.id ? 'أنت مش واخد قرض عشان تسدده!' : 'الشخص ده مش عليه قروض!');
        }

        const amountToPay = targetData.loan.amount;
        
        if (userData.balance < amountToPay) {
            return message.reply(`رصيدك غير كافي لتسديد القرض! المطلوب: **${formatNumber(amountToPay)}$**`);
        }

        userData.balance -= amountToPay;
        targetData.loan = { amount: 0, takenAt: 0 };
        targetData.isJailed = false;
        
        await userData.save();
        if (target.id !== message.author.id) await targetData.save();

        return message.reply(`✅ تم تسديد مبلغ **${formatNumber(amountToPay)}$** للبنك ${target.id === message.author.id ? 'وتم فك سجنك (إن كنت مسجون)' : `نيابة عن ${target} وتم فك سجنه`}!`);
    }

    // ==========================================
    // البورصة والأسهم
    // ==========================================
    if (command === 'اسعار') {
        let pricesText = '';
        const names = { apple: 'أبل', starbucks: 'ستاربكس', google: 'جوجل', microsoft: 'مايكروسوفت', mcdonalds: 'ماكدونالدز', tesla: 'تيسلا' };
        for (let stock in botConfig.stockPrices) pricesText += `**سهم ${names[stock]}**: ${formatNumber(botConfig.stockPrices[stock])}$\n`;
        const embed = new EmbedBuilder().setTitle('📈 أسعار الأسهم في السوق').setDescription(pricesText).setColor('#2ecc71');
        return message.reply({ embeds: [embed] });
    }

    if (command === 'اسهمي') {
        let stocksText = ''; let totalValue = 0;
        const names = { apple: 'أبل', starbucks: 'ستاربكس', google: 'جوجل', microsoft: 'مايكروسوفت', mcdonalds: 'ماكدونالدز', tesla: 'تيسلا' };
        for (let stock in userData.stocks) {
            if (userData.stocks[stock] > 0) {
                stocksText += `**${names[stock]}**: ${userData.stocks[stock]} سهم\n`;
                totalValue += userData.stocks[stock] * botConfig.stockPrices[stock];
            }
        }
        if (stocksText === '') stocksText = 'لا تمتلك أي أسهم حالياً.';
        stocksText += `\n\n**القيمة الإجمالية لأسهمك الآن:** ${formatNumber(totalValue)}$ 💰`;
        const embed = new EmbedBuilder().setTitle('📊 محفظتك الاستثمارية').setDescription(stocksText).setColor('#9b59b6');
        return message.reply({ embeds: [embed] });
    }

    if (command === 'شراء' && args[1] === 'اسهم') {
        const count = parseInt(args[2]);
        if (isNaN(count) || count <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nشراء اسهم (العدد)');
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
        return message.reply({ content: `اختر الشركة اللي عايز تشتري منها **${count}** سهم:`, components: [row] });
    }

    if (command === 'بيع' && args[1] === 'اسهم') {
        const company = args[2]; const count = parseInt(args[3]);
        const companies = { 'ستاربكس': 'starbucks', 'ماكدونالدز': 'mcdonalds', 'ابل': 'apple', 'أبل': 'apple', 'جوجل': 'google', 'مايكروسوفت': 'microsoft', 'تيسلا': 'tesla' };
        if (!company || isNaN(count) || count <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nبيع اسهم (اسم الشركة) (العدد)');
        const stockKey = companies[company];
        if (!stockKey) return message.reply('اسم الشركة غلط!');
        if (!userData.stocks || userData.stocks[stockKey] < count) return message.reply(`انت مش معاك ${count} سهم في ${company}!`);
        const currentPrice = botConfig.stockPrices[stockKey]; const totalProfit = currentPrice * count;
        userData.stocks[stockKey] -= count; userData.balance += totalProfit;
        userData.markModified('stocks'); await userData.save();
        return message.reply(`تم بيع **${count}** سهم من **${company}** بنجاح ✅\nكسبت: **${formatNumber(totalProfit)}$**`);
    }
    // ==========================================
    // الراتب، البقشيش (بخشيش)، والنهب
    // ==========================================
    if (command === 'راتب') {
        const cd = 7 * 60 * 1000; // 7 دقايق
        const lastDaily = userData.cooldowns?.daily || 0;
        if (now - lastDaily < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastDaily)) / 60000)}** دقيقة ⏳`);
        
        const amount = Math.floor(Math.random() * (100000 - 1000 + 1)) + 1000;
        userData.balance += amount;
        userData.cooldowns = { ...userData.cooldowns, daily: now };
        userData.markModified('cooldowns'); await userData.save();
        return message.reply(`تم سحب الراتب ${formatNumber(amount)}$ , رصيدك الحالي ${formatNumber(userData.balance)}$`);
    }

    if (command === 'بخشيش') {
        const cd = 10 * 60 * 1000; // 10 دقايق
        const lastTip = userData.cooldowns?.tip || 0;
        if (now - lastTip < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastTip)) / 60000)}** دقيقة ⏳`);
        
        const tip = Math.floor(Math.random() * (100000 - 1 + 1)) + 1;
        userData.balance += tip;
        userData.cooldowns = { ...userData.cooldowns, tip: now };
        userData.markModified('cooldowns'); await userData.save();
        return message.reply(`ما نقص مال من صدقة خد يا فقير ${formatNumber(tip)}$`);
    }

    if (command === 'نهب') {
        const cd = 15 * 60 * 1000; // 15 دقيقة
        const lastRob = userData.cooldowns?.rob || 0;
        if (now - lastRob < cd) {
            const left = cd - (now - lastRob);
            return message.reply(`بس ياسراق ياحرامي تعال بعد:\n⏳ **${Math.floor(left / 60000)} minutes, ${Math.floor((left % 60000)/1000)} seconds**`);
        }
        
        const target = message.mentions.users.first();
        if (!target) return message.reply('لتنفيذ الامر يرجي كتابة\nنهب @منشن');
        if (target.id === message.author.id) return message.reply('هتسرق نفسك؟!');
        
        let targetData = await User.findOne({ userId: target.id });
        if (!targetData || targetData.balance < 3000) return message.reply('الشخص ده معهوش فلوس تتسرق!');
        
        const stolen = Math.floor(Math.random() * (30000 - 1000 + 1)) + 1000;
        const actual = Math.min(targetData.balance, stolen);
        
        userData.balance += actual; targetData.balance -= actual;
        userData.cooldowns = { ...userData.cooldowns, rob: now };
        userData.markModified('cooldowns'); 
        await userData.save(); await targetData.save();
        return message.reply(`تم نهب **${formatNumber(actual)}$** من ${target} 🥷`);
    }

    // ==========================================
    // الاستثمار والتداول
    // ==========================================
    if (command === 'استثمار' || command === 'تداول') {
        const cd = 3 * 60 * 1000; // 3 دقايق
        const lastInv = userData.cooldowns?.[command] || 0;
        if (now - lastInv < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastInv)) / 60000)}** دقيقة ⏳`);
        
        let amount;
        if (args[1] === 'نص') amount = Math.floor(userData.balance / 2);
        else if (args[1] === 'كامل') amount = userData.balance;
        else amount = parseAmount(args[1]);

        if (!amount || amount <= 0) return message.reply(`لتنفيذ الامر يرجي كتابة\n${command} (المبلغ/نص/كامل)`);
        if (amount > 100000000) amount = 100000000; // الحد الأقصى 100m
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');

        userData.cooldowns = { ...userData.cooldowns, [command]: now };
        userData.markModified('cooldowns');

        const isWin = Math.random() < 0.5; // نسبة 50%
        if (isWin) {
            const winPercents = [2, 25, 75, 200];
            const p = winPercents[Math.floor(Math.random() * winPercents.length)];
            const profit = Math.floor(amount * (p / 100));
            userData.balance += profit; await userData.save();
            return message.reply(`مبروك 👏😃 ${command}ك نجح بنسبة ${p}%\nمبلغ الارباح ${formatNumber(profit)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`);
        } else {
            const losePercents = [2, 10, 25, 50];
            const p = losePercents[Math.floor(Math.random() * losePercents.length)];
            const loss = Math.floor(amount * (p / 100));
            userData.balance -= loss; await userData.save();
            return message.reply(`${command}ك فشل يلا شد 😂\nمبلغ الخساره ${formatNumber(loss)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`);
        }
    }

    // ==========================================
    // روليت وسلوت
    // ==========================================
    if (command === 'روليت') {
        const cd = 7 * 60 * 1000; // 7 دقايق
        const lastRl = userData.cooldowns?.roulette || 0;
        if (now - lastRl < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastRl)) / 60000)}** دقيقة ⏳`);

        const target = message.mentions.users.first();
        const amount = parseAmount(args[2]);
        if (!target || !amount) return message.reply('لتنفيذ الامر يرجي كتابة\nروليت @منشن (المبلغ)');
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');
        
        let targetData = await User.findOne({ userId: target.id });
        if (!targetData || targetData.balance < amount) return message.reply('رصيد الخصم غير كافي!');

        userData.cooldowns = { ...userData.cooldowns, roulette: now };
        userData.markModified('cooldowns');

        const winnerIsAuthor = Math.random() < 0.5;
        if (winnerIsAuthor) {
            userData.balance += amount; targetData.balance -= amount;
        } else {
            userData.balance -= amount; targetData.balance += amount;
        }
        await userData.save(); await targetData.save();
        
        const winner = winnerIsAuthor ? message.author : target;
        const winnerData = winnerIsAuthor ? userData : targetData;
        return message.reply(`لقد فاز ${winner}\nرصيدك الحالي ${formatNumber(winnerData.balance)}$`);
    }

    if (command === 'سلوت') {
        const cd = 8 * 60 * 1000; // 8 دقايق
        const lastSl = userData.cooldowns?.slot || 0;
        if (now - lastSl < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastSl)) / 60000)}** دقيقة ⏳`);

        let amount = parseAmount(args[1]);
        if (!amount) return message.reply('لتنفيذ الامر يرجي كتابة\nسلوت (المبلغ)');
        if (amount > 50000000) amount = 50000000; // الحد الأقصى 50m
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');

        userData.cooldowns = { ...userData.cooldowns, slot: now };
        userData.markModified('cooldowns');

        const rand = Math.random();
        let emojis = ['🍒', '🍋', '🍉', '⭐', '💎'];
        let s1, s2, s3, profit = 0;

        if (rand < 0.20) { // 20% (3 أضعاف)
            s1 = s2 = s3 = emojis[Math.floor(Math.random() * emojis.length)];
            profit = amount * 3;
            userData.balance += profit; await userData.save();
            return message.reply(`**[ ${s1} | ${s2} | ${s3} ]**\nمبروك لقد ربحت !\nالمكسب : ${formatNumber(profit)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`);
        } else if (rand < 0.50) { // 30% (الضعف)
            s1 = emojis[Math.floor(Math.random() * emojis.length)];
            s2 = s1;
            s3 = emojis[Math.floor(Math.random() * emojis.length)];
            if (s1 === s3) s3 = emojis.find(e => e !== s1); // عشان ميكونوش 3 متشابهين
            profit = amount * 2;
            userData.balance += profit; await userData.save();
            return message.reply(`**[ ${s1} | ${s2} | ${s3} ]**\nمبروك لقد ربحت !\nالمكسب : ${formatNumber(profit)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`);
        } else { // 50% خسارة
            s1 = emojis[0]; s2 = emojis[1]; s3 = emojis[2]; 
            userData.balance -= amount; await userData.save();
            return message.reply(`**[ ${s1} | ${s2} | ${s3} ]**\nابلععععع خسرت 😂\nرصيدك الحالي : ${formatNumber(userData.balance)}$`);
        }
    }

    // ==========================================
    // صاروخ وطاولة
    // ==========================================
    if (command === 'صاروخ' || command === 'طاولة') {
        const isRocket = command === 'صاروخ';
        const cd = (isRocket ? 4 : 3) * 60 * 1000;
        const lastCmd = userData.cooldowns?.[command] || 0;
        if (now - lastCmd < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastCmd)) / 60000)}** دقيقة ⏳`);

        const amount = parseAmount(args[1]);
        if (!amount) return message.reply(`لتنفيذ الامر يرجي كتابة\n${command} (المبلغ)`);
        if (userData.balance < amount * 2) return message.reply('رصيدك لازم يغطي الخسارة المضاعفة!');

        userData.cooldowns = { ...userData.cooldowns, [command]: now };
        userData.markModified('cooldowns');

        const winChance = isRocket ? 0.80 : 0.50; // صاروخ 80% وطاولة 50%
        const isWin = Math.random() < winChance;
        const countries = ['مصر', 'السعودية', 'الإمارات', 'قطر', 'المغرب', 'إيطاليا', 'ألمانيا'];
        const country = countries[Math.floor(Math.random() * countries.length)];

        if (isWin) {
            userData.balance += amount * 2; await userData.save();
            return message.reply(`مبروك ! ${command} ناجح 🥳\nتم الارسال الي : ${country}\nالمكسب : ${formatNumber(amount * 2)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`);
        } else {
            userData.balance -= amount * 2; await userData.save();
            return message.reply(`ابلععععععع ${command} فاشل 😂\nتم الارسال الي : ${country}\nالخساره : ${formatNumber(amount * 2)}$\nرصيدك الحالي : ${formatNumber(userData.balance)}$`);
        }
    }

    // ==========================================
    // مخاطرة وسوبر مخاطرة
    // ==========================================
    if (command === 'مخاطرة' || command === 'سوبر') {
        const isSuper = command === 'سوبر' && args[1] === 'مخاطرة';
        const cmdName = isSuper ? 'سوبر مخاطرة' : 'مخاطرة';
        const type = isSuper ? args[2] : args[1];
        
        if (type !== 'نص' && type !== 'كامل') return message.reply(`لتنفيذ الامر يرجي كتابة\n${cmdName} (نص/كامل)`);
        
        const cd = (isSuper ? 30 : 8) * 60 * 1000;
        const lastRisk = userData.cooldowns?.[cmdName] || 0;
        if (now - lastRisk < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastRisk)) / 60000)}** دقيقة ⏳`);

        const amount = type === 'نص' ? Math.floor(userData.balance / 2) : userData.balance;
        if (amount <= 0) return message.reply('رصيدك صفر!');

        userData.cooldowns = { ...userData.cooldowns, [cmdName]: now };
        userData.markModified('cooldowns');

        const isWin = Math.random() < 0.5;

        if (isWin) {
            const r = Math.random();
            let multi = 1; // 100%
            if (r < 0.1) multi = 3; // 10% لنسبة 300%
            else if (r < 0.3) multi = 2; // 20% لنسبة 200%
            else if (r < 0.6) multi = 1.5; // 30% لنسبة 150%

            if (isSuper) multi *= 2; // مضاعفة النسب في السوبر

            const profit = Math.floor(amount * multi);
            userData.balance += profit; await userData.save();
            return message.reply(`مبروك 👏😃 ${cmdName} ناجح بنسبة ${multi * 100}%\nمبلغ الارباح ${formatNumber(profit)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`);
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
            return message.reply(`${cmdName} فشل يلا شد 😂\nمبلغ الخساره ${formatNumber(loss)}$\nرصيدك الحالي ${formatNumber(userData.balance)}$`);
        }
    }
    // ==========================================
    // لعبة (حجرة ورقة مقص ضد البوت)
    // ==========================================
    if (command === 'لعبه' || command === 'لعبة') {
        const cd = 1 * 60 * 1000; // دقيقة
        const lastGame = userData.cooldowns?.game || 0;
        if (now - lastGame < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastGame)) / 1000)}** ثانية ⏳`);

        userData.cooldowns = { ...userData.cooldowns, game: now };
        userData.markModified('cooldowns'); await userData.save();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rps_rock').setLabel('🪨 حجرة').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rps_paper').setLabel('📄 ورقة').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rps_scissors').setLabel('✂️ مقص').setStyle(ButtonStyle.Primary)
        );

        const msg = await message.reply({ content: 'اختار بسرعة وحاول تغلبني!', components: [row] });
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000, max: 1 });

        col.on('collect', async i => {
            const isWin = Math.random() < 0.60; // نسبة فوز 60%
            if (isWin) {
                const winAmount = Math.floor(Math.random() * (100000 - 50000 + 1)) + 50000;
                userData.balance += winAmount; await userData.save();
                return i.update({ content: `🎉 كسبتني! الجايزة بتاعتك **${formatNumber(winAmount)}$**`, components: [] });
            } else {
                return i.update({ content: `😂 اتعادلنا أو خسرت! مفيش فلوس المرة دي، حاول تاني.`, components: [] });
            }
        });
    }

    // ==========================================
    // لعبة الزر (التحدي السريع)
    // ==========================================
    if (command === 'زر') {
        const cd = 2.5 * 60 * 1000; // دقيقتين ونص
        const lastZrr = userData.cooldowns?.zrr || 0;
        if (now - lastZrr < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastZrr)) / 60000)}** دقيقة ⏳`);

        const target = message.mentions.users.first();
        let amount = parseAmount(args[2]);
        if (!target || !amount) return message.reply('لتنفيذ الامر يرجي كتابة\nزر @منشن (المبلغ)');
        if (amount > 80000000) amount = 80000000; // الحد الأقصى 80m

        let targetData = await User.findOne({ userId: target.id });
        if (userData.balance < amount || !targetData || targetData.balance < amount) return message.reply('رصيد أحد الطرفين لا يكفي!');

        userData.cooldowns = { ...userData.cooldowns, zrr: now };
        userData.markModified('cooldowns'); await userData.save();

        const acceptRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('zrr_acc').setLabel('موافقة').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('zrr_rej').setLabel('رفض').setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder().setDescription(`هل تقبل تحدي الزر ضد ${message.author} بمبلغ **${formatNumber(amount)}$**؟`);
        const invMsg = await message.reply({ content: `${target}`, embeds: [embed], components: [acceptRow] });

        const invCol = invMsg.createMessageComponentCollector({ filter: i => i.user.id === target.id, time: 15000, max: 1 });

        invCol.on('collect', async i => {
            if (i.customId === 'zrr_rej') return i.update({ content: 'تم رفض التحدي.', embeds: [], components: [] });
            
            await i.update({ content: 'التحدي هيبدأ! ركزوا...', embeds: [], components: [] });
            
            setTimeout(async () => {
                const gameEmbed = new EmbedBuilder().setDescription(`أول من يضغط علي الزر سوف يربح **${formatNumber(amount)}$** 🚀`);
                const gameRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('zrr_click').setLabel('اضغط هنا!').setStyle(ButtonStyle.Success));
                
                await invMsg.edit({ content: `${message.author} ${target}`, embeds: [gameEmbed], components: [gameRow] });
                
                const gameCol = invMsg.createMessageComponentCollector({ filter: btn => [message.author.id, target.id].includes(btn.user.id), time: 15000, max: 1 });
                
                gameCol.on('collect', async btn => {
                    const winnerId = btn.user.id;
                    const loserId = winnerId === message.author.id ? target.id : message.author.id;
                    
                    let wData = await User.findOne({ userId: winnerId });
                    let lData = await User.findOne({ userId: loserId });
                    
                    wData.balance += amount; lData.balance -= amount;
                    await wData.save(); await lData.save();
                    
                    return btn.update({ content: `🎉 الفائز هو <@${winnerId}> كسب **${formatNumber(amount)}$** واللي اتأخر خسرهم!`, embeds: [], components: [] });
                });
                gameCol.on('end', collected => { if(collected.size === 0) invMsg.edit({ content: 'انتهى الوقت ومحدش داس!', embeds: [], components: [] }); });
            }, 5000);
        });
        invCol.on('end', collected => { if(collected.size === 0) invMsg.edit({ content: 'تم إلغاء الطلب لعدم الرد.', embeds: [], components: [] }); });
    }

    // ==========================================
    // ماين (20 زرار / 3 قنابل)
    // ==========================================
    if (command === 'ماين') {
        const cd = 4 * 60 * 1000;
        const lastMine = userData.cooldowns?.mine || 0;
        if (now - lastMine < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastMine)) / 60000)}** دقيقة ⏳`);

        let amount = parseAmount(args[1]);
        if (!amount || amount <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nماين (المبلغ)');
        if (amount > 500000000) amount = 500000000; // حد أقصى 500m
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');

        userData.balance -= amount; 
        userData.cooldowns = { ...userData.cooldowns, mine: now };
        userData.markModified('cooldowns'); await userData.save();

        let bombs = []; while(bombs.length < 3) { let r = Math.floor(Math.random() * 20); if(!bombs.includes(r)) bombs.push(r); }
        let multi = 1; let clicked = [];
        
        const getGrid = (dis = false) => {
            let r = [];
            for(let i=0; i<4; i++) {
                let row = new ActionRowBuilder();
                for(let j=0; j<5; j++) {
                    let idx = i*5+j; let isClk = clicked.includes(idx);
                    row.addComponents(new ButtonBuilder().setCustomId(`m_${idx}`).setLabel(isClk ? '💎' : '❓').setStyle(isClk ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(dis || isClk));
                }
                r.push(row);
            }
            r.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('mcash').setLabel('جمع الأرباح').setStyle(ButtonStyle.Primary).setDisabled(dis)));
            return r;
        };

        const msg = await message.reply({ content: `**لعبة ماينز** 💣\nالمبلغ: ${formatNumber(amount)}$\nالمضاعف: ${multi}x`, components: getGrid() });
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
        
        col.on('collect', async i => {
            if (i.customId === 'mcash') { 
                col.stop(); let won = amount * multi; userData.balance += won; await userData.save(); 
                return i.update({ content: `انسحبت وكسبت **${formatNumber(won)}$**`, components: getGrid(true) }); 
            }
            let idx = parseInt(i.customId.split('_')[1]);
            if (bombs.includes(idx)) { col.stop(); return i.update({ content: `بوممم 💣! دوست على لغم وخسرت كل حاجة!`, components: getGrid(true) }); }
            
            clicked.push(idx); multi *= 3; // يتضاعف 3 أضعاف
            await i.update({ content: `**لعبة ماينز** 💣\nالمضاعف: ${multi}x`, components: getGrid() });
        });
    }

    // ==========================================
    // لعبة أرقام (20 زرار)
    // ==========================================
    if (command === 'ارقام') {
        const cd = 2.5 * 60 * 1000;
        const lastNums = userData.cooldowns?.nums || 0;
        if (now - lastNums < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastNums)) / 60000)}** دقيقة ⏳`);

        let amount = parseAmount(args[1]);
        if (!amount || amount <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nارقام (المبلغ)');
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');

        userData.balance -= amount;
        userData.cooldowns = { ...userData.cooldowns, nums: now };
        userData.markModified('cooldowns'); await userData.save();

        let values = [];
        for(let i=0; i<10; i++) values.push(0); // 10 بيخسروا
        for(let i=0; i<10; i++) values.push(Math.floor(Math.random() * (15 - 2 + 1)) + 2); // 10 بيكسبوا من 2x لـ 15x
        values.sort(() => Math.random() - 0.5);

        const getGrid = (dis = false, revealIdx = -1) => {
            let r = [];
            for(let i=0; i<4; i++) {
                let row = new ActionRowBuilder();
                for(let j=0; j<5; j++) {
                    let idx = i*5+j;
                    let label = dis && revealIdx === idx ? `${values[idx]}x` : '❓';
                    let style = dis && revealIdx === idx ? (values[idx] === 0 ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary;
                    row.addComponents(new ButtonBuilder().setCustomId(`num_${idx}`).setLabel(label).setStyle(style).setDisabled(dis));
                }
                r.push(row);
            }
            return r;
        };

        const msg = await message.reply({ content: `**لعبة أرقام** 🔢\nاختر مربع وحظك هيحدد المضاعف!`, components: getGrid() });
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 30000, max: 1 });
        
        col.on('collect', async i => {
            let idx = parseInt(i.customId.split('_')[1]);
            let multi = values[idx];
            let won = amount * multi;
            userData.balance += won; await userData.save();
            let text = multi === 0 ? `للأسف طلعلك 0x وخسرت فلوسك 💔` : `🎉 مبروك طلعلك ${multi}x وكسبت **${formatNumber(won)}$**!`;
            return i.update({ content: text, components: getGrid(true, idx) });
        });
    }

    // ==========================================
    // ضربة جزاء (15 زرار)
    // ==========================================
    if (command === 'ضربة' && args[1] === 'جزاء') {
        const cd = 4 * 60 * 1000;
        const lastPen = userData.cooldowns?.pen || 0;
        if (now - lastPen < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastPen)) / 60000)}** دقيقة ⏳`);

        const amount = parseAmount(args[2]);
        if (!amount || amount <= 0) return message.reply('لتنفيذ الامر يرجي كتابة\nضربة جزاء (المبلغ)');
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');

        userData.balance -= amount;
        userData.cooldowns = { ...userData.cooldowns, pen: now };
        userData.markModified('cooldowns'); await userData.save();

        let bombs = []; while(bombs.length < 6) { let r = Math.floor(Math.random() * 15); if(!bombs.includes(r)) bombs.push(r); }
        
        const getGrid = (dis = false, revealIdx = -1) => {
            let r = [];
            for(let i=0; i<3; i++) {
                let row = new ActionRowBuilder();
                for(let j=0; j<5; j++) {
                    let idx = i*5+j;
                    let isBomb = bombs.includes(idx);
                    let label = dis && revealIdx === idx ? (isBomb ? '❌' : '⚽') : '🥅';
                    let style = dis && revealIdx === idx ? (isBomb ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Primary;
                    row.addComponents(new ButtonBuilder().setCustomId(`pen_${idx}`).setLabel(label).setStyle(style).setDisabled(dis));
                }
                r.push(row);
            }
            return r;
        };

        const msg = await message.reply({ content: `**ضربة جزاء** ⚽\nشوت في مكان مفهوش الحارس!`, components: getGrid() });
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 20000, max: 1 });
        
        col.on('collect', async i => {
            let idx = parseInt(i.customId.split('_')[1]);
            if (bombs.includes(idx)) {
                return i.update({ content: `❌ الحارس صدها وخسرت فلوسك!`, components: getGrid(true, idx) });
            } else {
                let won = amount * 2; userData.balance += won; await userData.save();
                return i.update({ content: `⚽ جووووول! كسبت **${formatNumber(won)}$**`, components: getGrid(true, idx) });
            }
        });
    }

    // ==========================================
    // اكس او و سباق وابراج وباقي الالعاب
    // ==========================================
    if (command === 'اكس-او' || command === 'اكس') {
        const cd = 2 * 60 * 1000;
        const lastXo = userData.cooldowns?.xo || 0;
        if (now - lastXo < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastXo)) / 60000)}** دقيقة ⏳`);

        const target = message.mentions.users.first();
        let amount = parseAmount(args[2] || args[1]); 
        if (!target || !amount) return message.reply('لتنفيذ الامر يرجي كتابة\nاكس او @منشن (المبلغ)');
        if (amount > 100000000) amount = 100000000;

        let targetData = await User.findOne({ userId: target.id });
        if (userData.balance < amount || !targetData || targetData.balance < amount) return message.reply('رصيد أحد الطرفين لا يكفي!');

        userData.cooldowns = { ...userData.cooldowns, xo: now };
        userData.markModified('cooldowns'); await userData.save();

        const invMsg = await message.reply({ content: `${target} تقبل التحدي بـ ${formatNumber(amount)}$؟`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('xo_acc').setLabel('موافقة').setStyle(ButtonStyle.Success))] });
        const invCol = invMsg.createMessageComponentCollector({ filter: i => i.user.id === target.id, time: 15000, max: 1 });
        
        invCol.on('collect', async i => {
            userData.balance -= amount; targetData.balance -= amount; await userData.save(); await targetData.save();
            let board = [0,1,2,3,4,5,6,7,8]; let turn = message.author.id;
            
            const getRows = () => {
                let r = [];
                for(let row=0; row<3; row++) {
                    let aw = new ActionRowBuilder();
                    for(let col=0; col<3; col++) {
                        let v = board[row*3+col]; let isN = isNaN(v);
                        aw.addComponents(new ButtonBuilder().setCustomId(`x_${row*3+col}`).setLabel(isN ? '-' : v).setStyle(v==='X'?ButtonStyle.Danger:(v==='O'?ButtonStyle.Primary:ButtonStyle.Secondary)).setDisabled(!isN));
                    }
                    r.push(aw);
                }
                return r;
            };
            
            await i.update({ content: `بدأ التحدي! دور <@${turn}>`, components: getRows() });
            const gCol = invMsg.createMessageComponentCollector({ filter: btn => [message.author.id, target.id].includes(btn.user.id), time: 60000 });
            gCol.on('collect', async btn => {
                if (btn.user.id !== turn) return btn.reply({ content: 'مش دورك!', ephemeral: true });
                board[parseInt(btn.customId.split('_')[1])] = turn === message.author.id ? 'X' : 'O';
                const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(w => board[w[0]]===board[w[1]] && board[w[1]]===board[w[2]] && isNaN(board[w[0]]));
                if (w) { gCol.stop(); let wd = await User.findOne({ userId: turn }); wd.balance += amount * 2; await wd.save(); return btn.update({ content: `🎉 مبروك <@${turn}> كسبت ${formatNumber(amount*2)}$!`, components: getRows() }); }
                if (board.every(x => isNaN(x))) { gCol.stop(); return btn.update({ content: `تعادل! راحت الفلوس عليكم انتوا الاتنين 😂`, components: getRows() }); }
                turn = turn === message.author.id ? target.id : message.author.id;
                await btn.update({ content: `دور <@${turn}>`, components: getRows() });
            });
        });
    }

    if (command === 'سباق') {
        const cd = 3 * 60 * 1000;
        const lastRace = userData.cooldowns?.race || 0;
        if (now - lastRace < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastRace)) / 60000)}** دقيقة ⏳`);

        const choice = parseInt(args[1]); let amount = parseAmount(args[2]);
        if (![1,2,3].includes(choice) || !amount) return message.reply('لتنفيذ الامر يرجي كتابة\nسباق (رقم 1-3) (المبلغ)');
        if (amount > 100000000) amount = 100000000;
        if (userData.balance < amount * 2) return message.reply('رصيد لا يغطي الخسارة المضاعفة!');

        userData.cooldowns = { ...userData.cooldowns, race: now };
        userData.markModified('cooldowns');

        const winner = Math.floor(Math.random() * 3) + 1;
        let cars = ['#1/----------🚙', '#2/----------🚙', '#3/----------🚙']; cars[winner - 1] = `#${winner}/🚙----------`; 
        const embed = new EmbedBuilder().setDescription(`${cars.join('\n')}\n\n${choice === winner ? 'مكسب 🚀' : 'القمم خسرت يالسباق 😂💔'}`);
        if (choice === winner) userData.balance += amount * 2; else userData.balance -= amount * 2;
        await userData.save(); return message.reply({ embeds: [embed] });
    }

    if (command === 'ابراج') {
        const cd = 2.5 * 60 * 1000;
        const lastTow = userData.cooldowns?.towers || 0;
        if (now - lastTow < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastTow)) / 60000)}** دقيقة ⏳`);

        const amount = parseAmount(args[1]); if (!amount || userData.balance < amount) return message.reply('لتنفيذ الامر يرجي كتابة\nابراج (المبلغ)');
        
        userData.balance -= amount;
        userData.cooldowns = { ...userData.cooldowns, towers: now };
        userData.markModified('cooldowns'); await userData.save();
        
        let currentMulti = 1; let currentRow = 4;
        const bombs = Array.from({length: 5}, () => Math.floor(Math.random() * 3)); 
        const getRows = (act) => {
            let r = [];
            for (let i = 0; i < 5; i++) {
                let row = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) row.addComponents(new ButtonBuilder().setCustomId(`t_${i}_${j}`).setLabel('❓').setStyle(ButtonStyle.Primary).setDisabled(i !== act));
                r.push(row);
            }
            r.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cashout').setLabel('جمع ارباح').setStyle(ButtonStyle.Success)));
            return r;
        };
        
        const msg = await message.reply({ content: `**لعبة الأبراج**\nالمضاعف: x${currentMulti}`, components: getRows(currentRow) });
        const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
        col.on('collect', async i => {
            if (i.customId === 'cashout') { const won = amount * currentMulti; userData.balance += won; await userData.save(); col.stop(); return i.update({ content: `انسحبت وكسبت **${formatNumber(won)}$**`, components: [] }); }
            const [_, rowIdx, colIdx] = i.customId.split('_');
            if (parseInt(colIdx) === bombs[parseInt(rowIdx)]) { col.stop(); return i.update({ content: `بومممم 💣! خسرت فلوسك`, components: [] }); }
            currentRow--; currentMulti *= 2; // ضعف المبلغ في كل صف ينجح فيه
            if (currentRow < 0) { const won = amount * currentMulti; userData.balance += won; await userData.save(); col.stop(); return i.update({ content: `كسبت الأبراج كلها! 🎉 الأرباح: **${formatNumber(won)}$**`, components: [] }); }
            await i.update({ content: `**لعبة الأبراج**\nالمضاعف: x${currentMulti}`, components: getRows(currentRow) });
        });
    }

    if (command === 'ذاكرة' || command === 'ايموجي' || command === 'كنز') {
        const cd = (command === 'ذاكرة' ? 5 : 3) * 60 * 1000;
        const lastMn = userData.cooldowns?.[command] || 0;
        if (now - lastMn < cd) return message.reply(`انتظر **${Math.ceil((cd - (now - lastMn)) / 60000)}** دقيقة ⏳`);

        const amount = parseAmount(args[1]); if (!amount || userData.balance < amount) return message.reply(`لتنفيذ الامر يرجي كتابة\n${command} (المبلغ)`);
        
        userData.balance -= amount; 
        userData.cooldowns = { ...userData.cooldowns, [command]: now };
        userData.markModified('cooldowns'); await userData.save();

        if (command === 'ذاكرة') {
            const ems = ['🍎', '🍌', '🍉']; const target = ems[Math.floor(Math.random()*3)];
            const msg = await message.reply(`ركز! الايموجيات دي هتختفي: **🍎 🍌 🍉**`);
            setTimeout(async () => {
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('em_0').setLabel('🍎').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('em_1').setLabel('🍌').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('em_2').setLabel('🍉').setStyle(ButtonStyle.Secondary));
                await msg.edit({ content: `فين كان الـ **${target}**؟`, components: [row] });
                const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 10000, max: 1 });
                col.on('collect', async i => {
                    if (i.component.label === target) { userData.balance += amount * 2; await userData.save(); i.update({ content: `🎉 صح! كسبت **${formatNumber(amount*2)}$**`, components: []}); } 
                    else i.update({ content: `❌ غلط! خسرت رهانك.`, components: []});
                });
            }, 3000);
        } else if (command === 'ايموجي') {
            const target = '👽'; const str = '👻👻👻👻👻👻👻👻👽👻👻👻👻👻';
            await message.reply(`اكتب الايموجي المختلف هنا بسرعة:\n${str}\nأول واحد هيكسب **${formatNumber(amount*2)}$** (10 ثواني)`);
            const col = message.channel.createMessageCollector({ filter: m => m.content === target, time: 10000, max: 1 });
            col.on('collect', async m => { let wd = await User.findOne({ userId: m.author.id }) || await User.create({ userId: m.author.id }); wd.balance += amount * 2; await wd.save(); m.reply(`🎉 بطل يا ${m.author}!`); });
        } else if (command === 'كنز') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tr_1').setLabel('📦').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tr_2').setLabel('📦').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('tr_3').setLabel('📦').setStyle(ButtonStyle.Secondary));
            const msg = await message.reply({ content: `اختر صندوق الكنز بـ ${formatNumber(amount)}$:`, components: [row] });
            const col = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000, max: 1 });
            col.on('collect', async i => {
                if (Math.random() < 0.33) { userData.balance += amount * 3; await userData.save(); i.update({ content: `🎉 لقيت الكنز! كسبت **${formatNumber(amount*3)}$**`, components: []}); } 
                else i.update({ content: `❌ الصندوق فاضي! خسرت فلوسك 💔`, components: []});
            });
        }
    }

    // ==========================================
    // قائمة الأوامر (Help Menu)
    // ==========================================
    if (command === 'اوامر' || command === '#اوامر') {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('help_menu').setPlaceholder('اختر قائمة الأوامر').addOptions([
                { label: 'اوامر الالعاب', value: 'games', emoji: '🎮' }, { label: 'اوامر الادمن', value: 'admin', emoji: '⚙️' }
            ])
        );
        return message.reply({ content: 'القائمة الرئيسية:', components: [row] });
    }
});

// ==========================================
// التفاعلات (القوائم المنسدلة للأسهم والمساعدة)
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
            const count = parseInt(interaction.customId.split('_')[2]); const stockKey = interaction.values[0];
            const limits = { apple: 300, starbucks: 350, google: 400, microsoft: 450, mcdonalds: 500, tesla: 400 };
            let uData = await User.findOne({ userId: interaction.user.id }); let bConfig = await BotConfig.findOne({ botId: 'main' });
            
            const currentOwned = uData.stocks?.[stockKey] || 0;
            if (currentOwned + count > limits[stockKey]) return interaction.reply({ content: `❌ أقصى حد ${limits[stockKey]} سهم!`, ephemeral: true });
            const totalPrice = bConfig.stockPrices[stockKey] * count;
            
            if (uData.balance < totalPrice) return interaction.reply({ content: `❌ رصيدك غير كافي! تحتاج **${formatNumber(totalPrice)}$**.`, ephemeral: true });
            
            uData.balance -= totalPrice; uData.stocks[stockKey] = currentOwned + count; uData.markModified('stocks'); await uData.save();
            return interaction.update({ content: `✅ مبروك! تم شراء **${count}** سهم بنجاح.\nالتكلفة: **${formatNumber(totalPrice)}$**`, components: [] });
        }
    }
});

// ==========================================
// تشغيل قاعدة البيانات والبوت
// ==========================================
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => { console.log('MongoDB Connected Successfully!'); client.login(process.env.TOKEN); })
    .catch(err => console.log('MongoDB Error:', err));
