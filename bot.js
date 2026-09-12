const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const dbPath = './links.json';

const getLinks = () => {
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8')) || [];
    } catch {
        return [];
    }
};

const saveLinks = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};


const cleanExpiredLinks = () => {
    const links = getLinks();
    const now = Date.now();
    const DAY_IN_MS = 24 * 60 * 60 * 1000;

    const filtered = links.filter((link) => {
        const age = now - parseInt(link.id);
        return age < DAY_IN_MS;
    });

    if (filtered.length < links.length) {
        saveLinks(filtered);
        console.log(`✅ Удалено ${links.length - filtered.length} истекших ссылок`);
    }
};

const checkRateLimit = (userId) => {
    const links = getLinks();
    const now = Date.now();
    const HOUR_IN_MS = 60 * 60 * 1000;
    const LIMIT = 20;

    const userLinksLastHour = links.filter((link) => {
        return (
            link.creatorId === userId &&
            now - parseInt(link.id) < HOUR_IN_MS
        );
    });

    return {
        allowed: userLinksLastHour.length < LIMIT,
        used: userLinksLastHour.length,
        remaining: Math.max(0, LIMIT - userLinksLastHour.length),
    };
};

const isValidTikTokUrl = (url) => {
    return /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\//.test(url);
};


const formatLinkInfo = (link) => {
    const streamInfo = link.ttLink ? `📺 Стрим: ${link.ttLink}\n` : '';
    return `${streamInfo}\n📈 Переходов: ${link.clicks}\n🆔 ID: ${link.id}`;
};

/**
 * Создает инлайн-клавиатуру со ссылками
 */
function getLinkKeyboard(link, botUsername) {
    const cleanNumber = link.number.replace(/\D/g, '');

    const waLink = `https://wa.me/${cleanNumber}`;
    const viberWebLink = `https://viber.click/${cleanNumber}`;
    const tgLink = `https://t.me/+${cleanNumber}`;

    // Ссылка для шеринга старта бота с ID этой ссылки
    const shareLink = `https://t.me/${botUsername}?start=${link.id}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('👉 Получить контакт')}`;

    return Markup.inlineKeyboard([
        [
            Markup.button.url('🟢 WhatsApp', waLink),
            Markup.button.url('💜 Viber', viberWebLink),
        ],
        [
            Markup.button.url('🔵 Telegram', tgLink)
        ],
        [
            Markup.button.url('📤 Поделиться', shareUrl)
        ],
        [
            Markup.button.callback('🚩 Пожаловаться', `report_${link.id}`)
        ]
    ]);
}


require('dotenv').config();
const token = process.env.TOKEN;

if (!token) {
    console.error('❌ TOKEN не указан в .env файле!');
    process.exit(1);
}

const bot = new Telegraf(token);

cleanExpiredLinks();

setInterval(cleanExpiredLinks, 60 * 60 * 1000);



bot.start((ctx) => {
    const id = ctx.payload;

    if (!id) {
        return ctx.reply(
            '👋 Добро пожаловать!\n\n' +
            'Это бот для создания $$ылок на контакты.\n\n' +
            '📝 Доступные команды:\n' +
            '/link <н0м3р> - создать ссылку без указания стрима\n' +
            '/link <н0м3р> <ссылка> - создать ссылку на TikTok стрим\n' +
            '/help - справка\n\n' +
            '📢 Канал: @ghoex_channel'
        );
    }

    cleanExpiredLinks();
    const links = getLinks();
    const link = links.find((l) => l.id === id);

    if (!link) {
        return ctx.reply('❌ $$ылка не найдена или истекла.');
    }

    if (link.isBlocked) {
        return ctx.reply('🚫 $$ылка заблокирована.');
    }

    link.clicks += 1;
    saveLinks(links);

    ctx.reply(formatLinkInfo(link), getLinkKeyboard(link));
});

bot.command('help', (ctx) => {
    ctx.reply(
        '❓ СПРАВКА\n\n' +
        '📝 Команды:\n' +
        '/link <номер> - создать $$ылку без стрима\n' +
        '  Пример: /link 79991234567\n\n' +
        '/link <н0м3р> <$$ылка_на_ток> - создать $$ылку со стримом\n' +
        '  Пример: /link 79991234567 https://tiktok.com/@username/live/123\n\n' +
        '⚠️ Ограничения:\n' +
        '• Максимум 20 $$ылок в час на аккаунт\n' +
        '• $$ылки удаляются через 24 часа\n' +
        '• Все ;;ылки должны быть с корректными н0м3рами'
    );
});

bot.command('link', async (ctx) => {
    try {
        const args = ctx.message.text.split(' ');

        if (args.length < 2) {
            return ctx.reply(
                '❌ Неверный формат!\n\n' +
                'Использование:\n' +
                '/link <номер>\n' +
                '/link <номер> <ссылка_на_тикток>'
            );
        }

        const number = args[1];
        const ttLink = args[2]?.trim() || null;

        // Проверка формата номера
        if (!/^[\d+]{10,}$/.test(number)) {
            return ctx.reply('❌ Ошибка: номер должен быть не менее 10 цифр (с кодом страны)');
        }

        if (ttLink && !isValidTikTokUrl(ttLink)) {
            return ctx.reply('❌ Ошибка: некорректная ссылка на TikTok!');
        }

        const rateLimit = checkRateLimit(ctx.from.id);
        if (!rateLimit.allowed) {
            return ctx.reply(
                `⏱️ Вы достигли лимита создания ссылок!\n\n` +
                `Лимит: 20 ссылок за 1 час\n` +
                `Использовано: ${rateLimit.used}/20\n\n` +
                `Попробуйте позже.`
            );
        }

        const cleanNumber = number.replace(/\D/g, '');

        const links = getLinks();
        const newLinkId = Date.now().toString();
        const newLink = {
            id: newLinkId,
            ttLink: ttLink,
            number: number,
            waLink: `https://wa.me/${cleanNumber}`,
            viberLink: `https://viber.click/${cleanNumber}`,
            tgLink: `https://t.me/+${cleanNumber}`,
            creatorId: ctx.from.id,
            clicks: 0,
            isBlocked: false,
            creator: ctx.from.username || `user_${ctx.from.id}`,
            createdAt: new Date().toISOString(),
        };

        links.push(newLink);
        saveLinks(links);

        const botInfo = await ctx.telegram.getMe();

        await ctx.reply(
            '✅ Ссылка успешно создана!\n\n' + formatLinkInfo(newLink),
            getLinkKeyboard(newLink, botInfo.username)
        );

        if (rateLimit.remaining <= 5) {
            ctx.reply(
                `⚠️ Внимание: у вас осталось ${rateLimit.remaining} ссылок за этот час.`
            );
        }
    } catch (error) {
        console.error('Ошибка при создании ссылки:', error);
        ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
});

bot.action(/report_(.+)/, (ctx) => {
    const linkId = ctx.match[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) {
        ctx.answerCbQuery('❌ Ссылка не найдена.');
        return;
    }

    const adminId = process.env.ADMIN_ID || 8500715817;

    bot.telegram.sendMessage(
        adminId,
        `🚩 ЖАЛОБА НА ССЫЛКУ\n\n` +
        `ID ;;ылки: ${linkId}\n` +
        `Создатель: @${link.creator}\n` +
        `Переходов: ${link.clicks}\n` +
        `Создана: ${link.createdAt}\n` +
        `TikTok: ${link.ttLink || 'Не указан'}\n\n` +
        `Использовать /block ${linkId} для блокировки`,
        {
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('🔒 Заблокировать', `admin_block_${linkId}`)],
            ]).reply_markup,
        }
    );

    ctx.answerCbQuery('✅ Жалоба отправлена модераторам.');
});

/**
 * Администраторская команда /block
 * Заблокировать ссылку
 */
bot.command('block', (ctx) => {
    const adminId = process.env.ADMIN_ID;

    if (ctx.from.id !== adminId) {
        return ctx.reply('🚫 У вас нет прав администратора.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Использование: /block <id_ссылки>');
    }

    const linkId = args[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) {
        return ctx.reply(`❌ Ссылка с ID ${linkId} не найдена.`);
    }

    link.isBlocked = true;
    saveLinks(links);

    ctx.reply(`✅ Ссылка ${linkId} заблокирована.\n👤 Автор: @${link.creator}`);
});


bot.command('unblock', (ctx) => {
    const adminId = process.env.ADMIN_ID;

    if (ctx.from.id !== adminId) {
        return ctx.reply('🚫 У вас нет прав администратора.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('Использование: /unblock <id_ссылки>');
    }

    const linkId = args[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) {
        return ctx.reply(`❌ Ссылка с ID ${linkId} не найдена.`);
    }

    link.isBlocked = false;
    saveLinks(links);

    ctx.reply(`✅ Ссылка ${linkId} разблокирована.`);
});

bot.command('stats', (ctx) => {
    const adminId = process.env.ADMIN_ID;

    if (ctx.from.id !== adminId) {
        return ctx.reply('🚫 У вас нет прав администратора.');
    }

    cleanExpiredLinks();
    const links = getLinks();

    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const blockedCount = links.filter((l) => l.isBlocked).length;
    const activeCount = links.length - blockedCount;

    ctx.reply(
        `📊 СТАТИСТИКА\n\n` +
        `📌 Всего ссылок: ${links.length}\n` +
        `✅ Активных: ${activeCount}\n` +
        `🚫 Заблокировано: ${blockedCount}\n` +
        `📈 Всего переходов: ${totalClicks}\n` +
        `👥 Уникальных авторов: ${new Set(links.map((l) => l.creatorId)).size}`
    );
});


bot.catch((err, ctx) => {
    console.error('Ошибка бота:', err);
    ctx.reply('⚠️ Произошла ошибка. Администратор уже уведомлен.');
});



bot.launch().then(() => {
    console.log('✅ Бот запущен успешно!');
    console.log('🔄 Автоочистка ссылок включена (каждый час)');
});

process.once('SIGINT', () => {
    console.log('🛑 Завершение работы бота...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    console.log('🛑 Завершение работы бота...');
    bot.stop('SIGTERM');
});