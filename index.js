const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
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

setInterval(async () => {
    let config = await BotConfig.findOne({ botId: 'main' });
    if (!config) return;
    config.stockTrend += 1;
    const isBoom = config.stockTrend >= 3;
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
    console.log(`Logged in as ${client.user.tag}!`);
    const statuses = ['Made By Tubro 🔥', 'ZD On Top'];
    let i = 0;
    setInterval(() => {
        client.user.setActivity(statuses[i], { type: 4 });
        i = (i + 1) % statuses.length;
    }, 10000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    const args = message.content.trim().split(/ +/);
    const command = args[0];

    let botConfig = await BotConfig.findOne({ botId: 'main' }) || await BotConfig.create({ botId: 'main' });
    let userData = await User.findOne({ userId: message.author.id }) || await User.create({ userId: message.author.id });
    const isOwner = botConfig.owners.includes(message.author.id);

    // أوامر الأونر
    if (command === 'اضافة' && args[1] === 'اونر' && isOwner) {
        const target = message.mentions.users.first();
        if (!target) return message.reply('منشن الشخص!');
        if (!botConfig.owners.includes(target.id)) { botConfig.owners.push(target.id); await botConfig.save(); return message.reply(`تم إضافة ${target} للأونرات ✅`); }
    }
    if (command === 'ازالة' && args[1] === 'اونر' && isOwner) {
        const target = message.mentions.users.first();
        if (target) { botConfig.owners = botConfig.owners.filter(id => id !== target.id); await botConfig.save(); return message.reply(`تم إزالة ${target} من الأونرات ❌`); }
    }
    if (command === 'تصفية' && isOwner) { await User.deleteMany({}); return message.reply('تم تصفية فلوس وممتلكات كل الأعضاء ⚠️🔥'); }

    // الأساسيات
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
        if (userData.balance < amount) return message.reply('رصيدك غير كافي!');
        let targetData = await User.findOne({ userId: target.id }) || await User.create({ userId: target.id });
        userData.balance -= amount; targetData.balance += amount;
        await userData.save(); await targetData.save(); return message.reply(`تم تحويل **${amount}$** إلى ${target} ✅`);
    }
    if (command === 'نهب') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('لتنفيذ الامر يرجي كتابة\nنهب @منشن');
        if (target.id === message.author.id) return message.reply('هتسرق نفسك؟!');
        const now = Date.now(); const lastRob = userData.cooldowns?.rob || 0;
        if (now - lastRob < 15 * 60 * 1000) return message.reply(`بس ياسراق ياحرامي تعال بعد:\n⏳ **${Math.floor((15*60*1000 - (now - lastRob))/60000)} minutes**`);
        let targetData = await User.findOne({ userId: target.id });
        if (!targetData || targetData.balance < 3000) return message.reply('الشخص ده مفلس، سيبه في حاله 💔');
        const stolenAmount = Math.floor(Math.random() * 29000) + 1000;
        const actualStolen = Math.min(targetData.balance, stolenAmount);
        userData.balance += actualStolen; targetData.balance -= actualStolen;
        userData.cooldowns = { ...userData.cooldowns, rob: now }; userData.markModified('cooldowns');
        await userData.save(); await targetData.save(); return message.reply(`نجحت العملية! سرقت **${actualStolen}$** من ${target} 🏃‍♂️💨`);
    }

    // متجر ومقاولة وقروض
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
        if (!userData.inventory[itemName] || userData.inventory[itemName] < count) return message.reply(`انت مش معاك العدد ده!`);
        userData.inventory[itemName] -= count; if (userData.inventory[itemName] === 0) delete userData.inventory[itemName];
        userData.markModified('inventory');
        if (Math.random() < 0.5) { userData.balance += (shopItems[itemName] * count) * 2; await userData.save(); return message.reply(`مبروك! المقاولة نجحت 🤑`); } 
        else { await userData.save(); return message.reply(`للأسف المقاولة فشلت 💔`); }
    }
    if (command === 'قرض') {
        const amount = parseAmount(args[1]); if (!amount || amount > 500000) return message.reply('الحد الأقصى 500k!');
        userData.balance += amount; await userData.save(); return message.reply(`تم إيداع **${formatNumber(amount)}$** كقرض.`);
    }
    if (command === 'تسديد') {
        const amount = parseAmount(args[1]); if (!amount || userData.balance < amount) return message.reply('رصيد غير كافي!');
        userData.balance -= amount; await userData.save(); return message.reply(`تم تسديد **${formatNumber(amount)}$** ✅`);
    }

    // الألعاب: صاروخ، مخاطرة، سوبر مخاطرة، زر، سباق
    if (command === 'صاروخ' || command === 'طاولة') {
        const amount = parseAmount(args[1]); if (!amount) return message.reply(`لتنفيذ الامر يرجي كتابة\n${command} (المبلغ)`);
        if (userData.balance < amount * 2) return message.reply('رصيدك لازم يغطي الخسارة المضاعفة!');
        if (Math.random() < 0.5) { userData.balance += amount * 2; await userData.save(); return message.reply(`مبروك ! ${command} ناجحة 🥳`); } 
        else { userData.balance -= amount * 2; await userData.save(); return message.reply(`ابلععععععع ${command} فاشلة 😂`); }
    }
    if (command === 'مخاطرة' || command === 'سوبر') {
        const isSuper = command === 'سوبر' && args[1] === 'مخاطرة';
        const type = isSuper ? args[2] : args[1];
        if (type !== 'نص' && type !== 'كامل') return message.reply(`لتنفيذ الامر يرجي كتابة\n${isSuper ? 'سوبر مخاطرة' : 'مخاطرة'} (نص/كامل)`);
        const amount = type === 'نص' ? Math.floor(userData.balance / 2) : userData.balance;
        if (amount <= 0) return message.reply('رصيدك صفر!');
        if (Math.random() < 0.5) {
            const multi = isSuper ? [5, 6][Math.floor(Math.random()*2)] : [1, 1.5, 2, 3][Math.floor(Math.random()*4)];
            userData.balance += Math.floor(amount * multi); await userData.save();
            return message.reply(`السوق رفع معاك! 🚀 كسبت ${multi * 100}%`);
        } else {
            const multi = isSuper ? [0.5, 2][Math.floor(Math.random()*2)] : [0.5, 1, 2][Math.floor(Math.random()*3)];
            userData.balance -= Math.min(userData.balance, Math.floor(amount * multi));
            if (isSuper && multi === 0.5) { for (let k in userData.inventory) userData.inventory[k] = Math.floor(userData.inventory[k] / 2); userData.markModified('inventory'); }
            if (isSuper && multi === 2) { userData.inventory = {}; userData.markModified('inventory'); }
            await userData.save(); return message.reply(`السوق وقع بيك 📉! خسرت ${multi * 100}%`);
        }
    }
    if (command === 'زر') {
        const amount = parseAmount(args[1]); if (!amount || userData.balance < amount) return message.reply('رصيد غير كافي!');
        userData.balance -= amount; await userData.save();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fast_btn').setLabel('اضغط لجمع الفلوس!').setStyle(ButtonStyle.Success));
        const msg = await message.reply({ content: `أول شخص يضغط سيحصل على **${formatNumber(amount)}$**!`, components: [row] });
        const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'fast_btn', time: 15000, max: 1 });
        collector.on('collect', async i => {
            let winData = await User.findOne({ userId: i.user.id }) || await User.create({ userId: i.user.id });
            winData.balance += amount; await winData.save();
            await i.update({ content: `🎉 الفائز هو ${i.user}! كسب **${amount}$**`, components: [] });
        });
        collector.on('end', collected => { if (collected.size === 0) { userData.balance += amount; userData.save(); msg.edit({ content: 'خلص الوقت!', components: [] }); }});
    }
    if (command === 'سباق') {
        const choice = parseInt(args[1]); const amount = parseAmount(args[2]);
        if (![1,2,3].includes(choice) || !amount) return message.reply('سباق (رقم 1-3) (المبلغ)');
        if (userData.balance < amount * 2) return message.reply('رصيدك لا يغطي الخسارة المضاعفة!');
        const winner = Math.floor(Math.random() * 3) + 1;
        let cars = ['#1/----------🚙', '#2/----------🚙', '#3/----------🚙'];
        cars[winner - 1] = `#${winner}/🚙----------`; // حركة بسيطة توضح الفائز
        const embed = new EmbedBuilder().setDescription(`${cars.join('\n')}\n\n${choice === winner ? 'مكسب 🚀' : 'القمم خسرت يالسباق 😂💔'}`);
        if (choice === winner) userData.balance += amount * 2; else userData.balance -= amount * 2;
        await userData.save(); return message.reply({ embeds: [embed] });
    }

    // لعبة أبراج (Towers)
    if (command === 'ابراج') {
        const amount = parseAmount(args[1]); if (!amount || userData.balance < amount) return message.reply('رصيد غير كافي!');
        userData.balance -= amount; await userData.save();
        let currentMultiplier = 1; let currentRow = 4;
        const bombs = Array.from({length: 5}, () => Math.floor(Math.random() * 3)); // تحديد قنبلة لكل صف
        const generateRows = (activeRow) => {
            let rows = [];
            for (let i = 0; i < 5; i++) {
                let r = new ActionRowBuilder();
                for (let j = 0; j < 3; j++) {
                    r.addComponents(new ButtonBuilder().setCustomId(`tower_${i}_${j}`).setLabel('❓').setStyle(ButtonStyle.Primary).setDisabled(i !== activeRow));
                }
                rows.push(r);
            }
            rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cashout').setLabel('جمع الارباح').setStyle(ButtonStyle.Success)));
            return rows;
        };
        const msg = await message.reply({ content: `**لعبة الأبراج**\nالمبلغ: ${amount}$\nالمضاعف: x${currentMultiplier}`, components: generateRows(currentRow) });
        const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
        collector.on('collect', async i => {
            if (i.customId === 'cashout') {
                const won = amount * currentMultiplier; userData.balance += won; await userData.save();
                collector.stop(); return i.update({ content: `انسحبت وكسبت **${won}$**`, components: [] });
            }
            const [_, rowIdx, colIdx] = i.customId.split('_');
            if (parseInt(colIdx) === bombs[parseInt(rowIdx)]) {
                collector.stop(); return i.update({ content: `بومممم 💣! دوست على القنبلة وخسرت **${amount}$**`, components: [] });
            }
            currentRow--; currentMultiplier *= 2;
            if (currentRow < 0) {
                const won = amount * currentMultiplier; userData.balance += won; await userData.save();
                collector.stop(); return i.update({ content: `كسبت اللعبة كلها! 🎉 الأرباح: **${won}$**`, components: [] });
            }
            await i.update({ content: `**لعبة الأبراج**\nالمبلغ: ${amount}$\nالمضاعف الحالي: x${currentMultiplier}`, components: generateRows(currentRow) });
        });
    }

    // لعبة إكس أو (XO)
    if (command === 'اكس-او') {
        const target = message.mentions.users.first(); const amount = parseAmount(args[2]);
        if (!target || !amount) return message.reply('اكس-او @منشن (المبلغ)');
        let targetData = await User.findOne({ userId: target.id });
        if (userData.balance < amount || !targetData || targetData.balance < amount) return message.reply('رصيد أحد الطرفين لا يكفي!');
        
        const acceptRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('xo_accept').setLabel('موافقة').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('xo_reject').setLabel('رفض').setStyle(ButtonStyle.Danger)
        );
        const inviteMsg = await message.reply({ content: `${target} هل تقبل تحدي إكس أو بـ ${amount}$؟`, components: [acceptRow] });
        
        const inviteFilter = i => i.user.id === target.id;
        const inviteCol = inviteMsg.createMessageComponentCollector({ filter: inviteFilter, time: 30000, max: 1 });
        
        inviteCol.on('collect', async i => {
            if (i.customId === 'xo_reject') return i.update({ content: 'تم رفض التحدي.', components: [] });
            
            // سحب الفلوس للضمان
            userData.balance -= amount; targetData.balance -= amount;
            await userData.save(); await targetData.save();

            let board = [0,1,2,3,4,5,6,7,8]; let turn = message.author.id;
            const checkWin = (b) => {
                const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
                for (let w of wins) if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]] && isNaN(b[w[0]])) return b[w[0]];
                return b.every(x => isNaN(x)) ? 'tie' : null;
            };
            const getRows = () => {
                let rows = [];
                for(let r=0; r<3; r++) {
                    let row = new ActionRowBuilder();
                    for(let c=0; c<3; c++) {
                        let val = board[r*3+c]; let label = isNaN(val) ? val : '-';
                        let style = label === 'X' ? ButtonStyle.Danger : (label === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary);
                        row.addComponents(new ButtonBuilder().setCustomId(`xo_${r*3+c}`).setLabel(label).setStyle(style).setDisabled(isNaN(val)));
                    }
                    rows.push(row);
                }
                return rows;
            };

            await i.update({ content: `بدأ التحدي! دور <@${turn}> (X)`, components: getRows() });
            const gameCol = inviteMsg.createMessageComponentCollector({ filter: btn => [message.author.id, target.id].includes(btn.user.id), time: 60000 });
            
            gameCol.on('collect', async btn => {
                if (btn.user.id !== turn) return btn.reply({ content: 'مش دورك!', ephemeral: true });
                const idx = parseInt(btn.customId.split('_')[1]);
                board[idx] = turn === message.author.id ? 'X' : 'O';
                const result = checkWin(board);
                
                if (result) {
                    gameCol.stop();
                    if (result === 'tie') {
                        return btn.update({ content: `القمم تعادل راحت عليك الفلوس 😂💔`, components: getRows() }); // التعادل بياكل الفلوس
                    } else {
                        const winnerId = result === 'X' ? message.author.id : target.id;
                        let wData = await User.findOne({ userId: winnerId });
                        wData.balance += amount * 2; await wData.save();
                        return btn.update({ content: `🎉 مبروك <@${winnerId}> كسبت ${amount*2}$!`, components: getRows() });
                    }
                }
                turn = turn === message.author.id ? target.id : message.author.id;
                await btn.update({ content: `دور <@${turn}> (${turn === message.author.id ? 'X' : 'O'})`, components: getRows() });
            });
        });
    }

    // قائمة الأوامر
    if (command === 'اوامر' || command === '#اوامر') {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('help_menu').setPlaceholder('اختر قائمة الأوامر').addOptions([
                { label: 'اوامر الالعاب', value: 'games', emoji: '🎮' }, { label: 'اوامر الادمن', value: 'admin', emoji: '⚙️' }
            ])
        );
        return message.reply({ content: 'القائمة الرئيسية:', components: [row] });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'help_menu') {
        if (interaction.values[0] === 'games') {
            const embed = new EmbedBuilder().setTitle('🎮 اوامر الالعاب').setColor('#2b2d31').setDescription(`**#رصيد** - **#تحويل** - **#نهب**\n**#مخاطرة** - **#سوبر مخاطرة**\n**#صاروخ** - **#طاولة** - **#مقاولة**\n**#متجر** - **#شراء**\n**#زر** - **#قرض** - **#تسديد**\n**#ابراج** - **#اكس-او** - **#سباق**`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (interaction.values[0] === 'admin') {
            const embed = new EmbedBuilder().setTitle('⚙️ اوامر الادمن').setColor('#2b2d31').setDescription(`**اضافة اونر @منشن**\n**ازالة اونر @منشن**\n**تصفية**`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => { console.log('MongoDB Connected!'); client.login(process.env.TOKEN); })
    .catch(err => console.log(err));
