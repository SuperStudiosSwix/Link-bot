const { Telegraf, Markup } = require('telegraf')
const fs = require('fs');
const dbPath = './links.json';

// Функция чтения/записи
const getLinks = () => JSON.parse(fs.readFileSync(dbPath, 'utf8') || '[]');
const saveLinks = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
const { createContext } = require('vm')
const bot = new Telegraf('8782164232:AAEZyxh0YQV6aSBKlmLZr6NOngE32tWM8sc')
bot.start((ctx) => {
    const id = ctx.payload;
    if (!id) return ctx.reply("дарова,это бот для создания $$ылок \n ДОступно для всех!");

    const links = getLinks();
    const link = links.find(l => l.id === id);

    if (!link) return ctx.reply("$$ылка не найдена.");
    if (link.isBlocked) return ctx.reply("❌ $$ылка заблокирована.");

    // Увеличиваем счетчик переходов
    link.clicks += 1;
    saveLinks(links);
    ctx.reply(`Стрим: ${link.ttLink}\n👤 Создатель: ${link.creator}\n📈 Переходов: ${link.clicks} \n🎬 id: ${link.id}`, {
        ...Markup.inlineKeyboard([
            [
                Markup.button.url('🟢 WhatsApp', `https://wa.me/${link.number}`),
                Markup.button.url('🔵 Telegram', `https://t.me/+${link.number}`)
            ],
            [Markup.button.callback('🚩 Пожаловаться', `report_${id}`)]
        ])
    });
});
bot.command('link', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply("Использование: /link <н0мEр> <ссылка>");

    const numbr = args[1];
    const TTlink = args[2].trim();

    if (!/^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\//.test(TTlink)) {
        return ctx.reply("Ошибка: ссылка не на TikTok!");
    }

    // Сохраняем ссылку в JSON
    const links = getLinks();
    const id = Date.now().toString()
    const link = links.find(l => l.id === id);
    const newLink = {
        id: Date.now().toString(),
        ttLink: TTlink,
        number: numbr,
        creatorId: ctx.from.id,
        clicks: 0,
        isBlocked: false,
        creator: ctx.from.username
    };
    links.push(newLink); 
    saveLinks(links);
   
    const botInfo = await ctx.telegram.getMe();
    const shareLink = `https://t.me/${botInfo.username}?start=${newLink.id}`;
    ctx.reply(`Стрим: ${TTlink}\n👤 Создатель: ${ctx.from.username}\n📈 Переходов: 0 \n id: ${id}`, {
        ...Markup.inlineKeyboard([
            [
                Markup.button.url('🟢 WhatsApp', `https://wa.me/${numbr}`),
                Markup.button.url('🔵 Telegram', `https://t.me/+${numbr}`)
            ],
            [Markup.button.callback('🚩 Пожаловаться', `report_${id}`)]
        ])
    });
    ctx.reply(`ссылка для перехода`, {
        ...Markup.inlineKeyboard([
            [Markup.button.url('📤 Поделиться ссылкой', `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('ссылка')}`)]
        ])
    });
});
bot.action(/report_(.+)/, (ctx) => {
    const id = ctx.match[1];
    // Здесь отправь сообщение себе (свой ID вставь вместо цифр)
    bot.telegram.sendMessage(8500715817, `Жалоба на ссылку: ${id}`);
    ctx.answerCbQuery("Жалоба отправлена!");
});
bot.command('block', (ctx) => {
    if (ctx.from.id !== 8500715817) return;
    const id = ctx.message.text.split(' ')[1];
    const links = getLinks();
    const link = links.find(l => l.id === id);
    if (link) {
        link.isBlocked = true;
        saveLinks(links);
        ctx.reply(`Ссылка ${id} заблокирована.`);
    }
});
bot.launch()