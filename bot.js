const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')
const bot = new Telegraf('8782164232:AAEZyxh0YQV6aSBKlmLZr6NOngE32tWM8sc')
bot.start((ctx) => {
    ctx.reply('Добро пожаловать в бот! \n тут ты модешь создавать ссылки на соцсети по номеру (вацап,тг,вайбер) \n пиши комманду /link номер \n например: /link 380000000000 БЕЗ ПЛЮСА ВНАЧАЛЕ')

})
bot.command('link', (ctx) => {
    const msg = ctx.message.text
    const args = msg.split(' ')
    const numbr = parseInt(args[1])

const vbr = `https://msng.link/vi/${numbr}`;

    // Текст с HTML тегом <a>
    const messageText = `Вот линки (некоторые могут не работать):\n\n🟣V1ber \n <a href="${vbr}">Viber</a>`;
ctx.reply(messageText, {
        parse_mode: 'Markdown', 
        ...Markup.inlineKeyboard([
            [Markup.button.url('🟢 В0цап', `https://wa.me/${numbr}`)],
            [Markup.button.url('🔵 Телеграм', `https://t.me/+${numbr}`)]
        ])
    });
})
bot.launch()
