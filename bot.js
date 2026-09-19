require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const dbPath = './links.json';
const usersPath = './users.json';
const token = process.env.TOKEN;

if (!token) {
    process.exit(1);
}

const bot = new Telegraf(token);

// Включаем inline режим
bot.telegram.setMyCommands([
    { command: 'link', description: 'Создать ссылку на контакт' },
    { command: 'help', description: 'Справка' },
]);

const censoredWords = [
    { word: 'номер', replace: 'н0м3р' },
    { word: 'ссылка', replace: 'сслка' },
    { word: 'ссылки', replace: 'сслки' },
    { word: 'ссылку', replace: 'сслку' },
    { word: 'link', replace: 'lnk' },
    { word: 'links', replace: 'lnks' },
    { word: 'http', replace: 'htp' },
    { word: 'https', replace: 'htps' },
    { word: 'spam', replace: 'sp@m' },
    { word: 'phishing', replace: 'ph1sh1ng' },
    { word: 'scam', replace: 'sc@m' },
    { word: 'fraud', replace: 'fr@ud' },
    { word: 'взлом', replace: 'вz лом' },
    { word: 'хак', replace: 'х@к' },
    { word: 'крак', replace: 'кр@к' },
    { word: 'вирус', replace: 'в1рус' },
    { word: 'майнер', replace: 'м@йнер' },
    { word: 'бот', replace: 'б0т' },
    { word: 'боты', replace: 'б0ты' },
    { word: 'автоматизация', replace: 'авт0матизация' },
    { word: 'рассылка', replace: 'рассл1ка' },
    { word: 'реклама', replace: 'рекл@ма' },
    { word: 'покупка', replace: 'покупк@' },
    { word: 'продажа', replace: 'прод@жа' },
    { word: 'деньги', replace: 'денег' },
    { word: 'заработок', replace: 'зараб0ток' },
    { word: 'заработать', replace: 'зараб0тать' },
    { word: 'инвестиция', replace: 'инвест1ция' },
    { word: 'давай', replace: 'дав@й' },
    { word: 'кредит', replace: 'кред1т' },
    { word: 'займ', replace: 'з@йм' },
    { word: 'лотерея', replace: 'л0терея' },
    { word: 'казино', replace: 'каз1но' },
    { word: 'ставка', replace: 'ст@вка' },
    { word: 'бонус', replace: 'б0нус' },
    { word: 'премия', replace: 'пр3мия' },
];

const censorText = (text) => {
    if (!text) return text;
    let result = text;
    censoredWords.forEach(({ word, replace }) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, replace);
    });
    return result;
};

const getLinks = () => {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, '[]', 'utf8');
            return [];
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8')) || [];
    } catch (error) {
        console.error('Ошибка чтения links.json:', error);
        return [];
    }
};

const saveLinks = (data) => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Ошибка сохранения links.json:', error);
    }
};

// ─── Users DB ───────────────────────────────────────────────────────────────
const getUsers = () => {
    try {
        if (!fs.existsSync(usersPath)) {
            fs.writeFileSync(usersPath, '{}', 'utf8');
            return {};
        }
        return JSON.parse(fs.readFileSync(usersPath, 'utf8')) || {};
    } catch (error) {
        console.error('Ошибка чтения users.json:', error);
        return {};
    }
};

const saveUsers = (data) => {
    try {
        fs.writeFileSync(usersPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Ошибка сохранения users.json:', error);
    }
};

// Регистрирует пользователя при любом взаимодействии с ботом
const registerUser = (from) => {
    if (!from) return;
    const users = getUsers();
    users[from.id] = {
        id: from.id,
        username: from.username || null,
        firstName: from.first_name || null,
        lastSeen: new Date().toISOString(),
    };
    saveUsers(users);
};

const getAllUserIds = () => Object.keys(getUsers()).map(Number);
// ────────────────────────────────────────────────────────────────────────────

const cleanExpiredLinks = () => {
    const links = getLinks();
    if (!links.length) return;
    const now = Date.now();
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const filtered = links.filter((link) => now - parseInt(link.id) < DAY_IN_MS);
    if (filtered.length < links.length) {
        saveLinks(filtered);
        console.log(`✅ Удалено ${links.length - filtered.length} истекших ссылок`);
    }
};

const checkRateLimit = (userId, links) => {
    const now = Date.now();
    const HOUR_IN_MS = 60 * 60 * 1000;
    const LIMIT = 20;
    const userLinksLastHour = links.filter(
        (link) => link.creatorId === userId && now - parseInt(link.id) < HOUR_IN_MS
    );
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

function getLinkKeyboard(link, botUsername) {
    const cleanNumber = link.number.replace(/\D/g, '');
    const waLink = `https://wa.me/${cleanNumber}`;
    const viberWebLink = `https://viber.click/${cleanNumber}`;
    const tgLink = `https://t.me/+${cleanNumber}`;
    const shareLink = `https://t.me/${botUsername}?start=${link.id}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('👉 Получить контакт')}`;

    return Markup.inlineKeyboard([
        [
            Markup.button.url('🟢 Wh4ts$pp', waLink),
            Markup.button.url('💜 V1b3r', viberWebLink),
        ],
        [
            Markup.button.url('🔵 T3legram', tgLink)
        ],
        [
            Markup.button.url('📤 Поделиться', shareUrl)
        ],
        [
            Markup.button.callback('🚩 Пожаловаться', `report_${link.id}`)
        ]
    ]);
}

// Keyboard для inline-результата (без кнопки "Пожаловаться" — она не работает в inline)
function getInlineLinkKeyboard(link, botUsername) {
    const cleanNumber = link.number.replace(/\D/g, '');
    const waLink = `https://wa.me/${cleanNumber}`;
    const viberWebLink = `https://viber.click/${cleanNumber}`;
    const tgLink = `https://t.me/+${cleanNumber}`;
    const shareLink = `https://t.me/${botUsername}?start=${link.id}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('👉 Получить контакт')}`;

    return Markup.inlineKeyboard([
        [
            Markup.button.url('🟢 Wh4ts$pp', waLink),
            Markup.button.url('💜 V1b3r', viberWebLink),
        ],
        [
            Markup.button.url('🔵 T3legram', tgLink)
        ],
        [
            Markup.button.url('📤 Поделиться', shareUrl)
        ],
    ]);
}

const isAdmin = (userId) => {
    const adminId = Number(process.env.ADMIN_ID);
    return userId === adminId;
};

// ─────────────────────────────────────────────
// INLINE MODE
// ─────────────────────────────────────────────
// Пользователь вводит: @botusername <номер> [tiktok_url]
// Примеры:
//   @botusername 79991234567
//   @botusername 79991234567 https://tiktok.com/@user/live/123
bot.on('inline_query', async (ctx) => {
    registerUser(ctx.from);
    const query = ctx.inlineQuery.query.trim();
    const botUsername = ctx.botInfo.username;

    // Пустой запрос — показываем подсказку
    if (!query) {
        return ctx.answerInlineQuery([], {
            switch_pm_text: '✏️ Введите н0мер телефона...',
            switch_pm_parameter: 'inline_help',
            cache_time: 0,
        });
    }

    const parts = query.split(/\s+/);
    const number = parts[0];
    const ttLink = parts[1] || null;

    // Валидация номера
    if (!/^[\d+]{10,}$/.test(number)) {
        return ctx.answerInlineQuery([
            {
                type: 'article',
                id: 'invalid_number',
                title: '❌ Неверный н0мер',
                description: 'Введите н0мер от 10 цифр (с к0дом страны)',
                input_message_content: {
                    message_text: '❌ Неверный формат н0мера. Пример: 79991234567',
                },
            },
        ], { cache_time: 0 });
    }

    // Валидация TikTok ссылки (если передана)
    if (ttLink && !isValidTikTokUrl(ttLink)) {
        return ctx.answerInlineQuery([
            {
                type: 'article',
                id: 'invalid_tiktok',
                title: '❌ Неверная TikTok ссылка',
                description: 'Укажите корректную $$ылку на TikTok стрим',
                input_message_content: {
                    message_text: '❌ Некорректная $$ылка на TikTok.',
                },
            },
        ], { cache_time: 0 });
    }


    const links = getLinks();
    const rateLimit = checkRateLimit(ctx.from.id, links);

    if (!rateLimit.allowed) {
        return ctx.answerInlineQuery([
            {
                type: 'article',
                id: 'rate_limit',
                title: '⏱️ Лимит исчерпан',
                description: `Использовано ${rateLimit.used}/20 за последний час`,
                input_message_content: {
                    message_text: '⏱️ Вы достигли лимита создания сслок (20 в час). Попробуйте позже.',
                },
            },
        ], { cache_time: 0 });
    }

    const cleanNumber = number.replace(/\D/g, '');
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

    const streamLine = ttLink ? `📺 Стрим: ${ttLink}\n` : '';
    const messageText =
        `${streamLine}` +
        `📈 Переходов: 0\n` +
        `🆔 ID: ${newLinkId}`;

    const keyboard = getInlineLinkKeyboard(newLink, botUsername);

    const results = [
        {
            type: 'article',
            id: newLinkId,
            title: `📲 Контакт: ${number}`,
            description: ttLink ? `Со стримом TikTok` : `Без стрима`,
            input_message_content: {
                message_text: messageText,
            },
            ...keyboard,
        },
    ];

    return ctx.answerInlineQuery(results, { cache_time: 0 });
});

bot.start(async (ctx) => {
    registerUser(ctx.from);
    const id = ctx.payload;

    if (!id) {
        return ctx.reply(
            '👋 Добро пожаловать!\n\n' +
            'Это бот для создания сслок на контакты.\n\n' +
            '📝 Доступные команды:\n' +
            '/link <н0м3р> - создать сслку без стрима\n' +
            '/link <н0м3р> <сслка> - создать сслку на TikTok стрим\n' +
            '/help - справка\n\n' +
            '💡 Inline режим:\n' +
            'Напишите @' + (ctx.botInfo?.username || 'botusername') + ' <н0м3р> в любом чате!\n\n' +
            '📢 Канал: https://t.me/creator_link_1'
        );
    }

    cleanExpiredLinks();
    const links = getLinks();
    const link = links.find((l) => l.id === id);

    if (!link) {
        return ctx.reply('❌ Сслка не найдена или истекла.');
    }

    if (link.isBlocked) {
        return ctx.reply('🚫 Сслка заблокирована.');
    }

    link.clicks += 1;
    saveLinks(links);

    const botUsername = ctx.botInfo.username;
    await ctx.reply(formatLinkInfo(link), getLinkKeyboard(link, botUsername));
});

bot.command('help', (ctx) => {
    registerUser(ctx.from);
    ctx.reply(
        '❓ СПРАВКА\n\n' +
        '📝 Команды:\n' +
        '/link <н0м3р> - создать сслку без стрима\n' +
        '  Пример: /link 79991234567\n\n' +
        '/link <н0м3р> <сслка_на_типоток> - создать сслку со стримом\n' +
        '  Пример: /link 79991234567 https://tiktok.com/@username/live/123\n\n' +
        '💡 Inline режим:\n' +
        'В любом чате напишите @botusername и номер:\n' +
        '  @botusername 79991234567\n' +
        '  @botusername 79991234567 https://tiktok.com/...\n\n' +
        '⚠️ Ограничения:\n' +
        '• Максимум 20 сслок в час на аккаунт\n' +
        '• Сслки удаляются через 24 часа\n' +
        '• Все сслки должны быть с корректными н0м3р'
    );
});

bot.command('link', async (ctx) => {
    registerUser(ctx.from);
    try {
        const args = ctx.message.text.split(' ');

        if (args.length < 2) {
            return ctx.reply(
                '❌ Неверный формат!\n\n' +
                'Использование:\n' +
                '/link <номер>\n' +
                '/link <номер> <сслка_на_тикток>'
            );
        }

        const number = args[1];
        const ttLink = args[2]?.trim() || null;

        if (!/^[\d+]{10,}$/.test(number)) {
            return ctx.reply('❌ Ошибка: н0мер должен быть не менее 10 цифр (с кодом страны)');
        }

        if (ttLink && !isValidTikTokUrl(ttLink)) {
            return ctx.reply('❌ Ошибка: некорректная сслка на TikTok!');
        }

        const links = getLinks();
        const rateLimit = checkRateLimit(ctx.from.id, links);

        if (!rateLimit.allowed) {
            return ctx.reply(
                `⏱️ Вы достигли лимита создания сслок!\n\n` +
                `Лимит: 20 сслок за 1 час\n` +
                `Использовано: ${rateLimit.used}/20\n\n` +
                `Попробуйте позже.`
            );
        }

        const cleanNumber = number.replace(/\D/g, '');
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

        const botUsername = ctx.botInfo.username;

        await ctx.reply(
            '✅ Сслка успешно создана!\n\n' + formatLinkInfo(newLink),
            getLinkKeyboard(newLink, botUsername)
        );

        if (rateLimit.remaining <= 5) {
            ctx.reply(`⚠️ Внимание: у вас осталось ${rateLimit.remaining} сслок за этот час.`);
        }
    } catch (error) {
        console.error('Ошибка при создании сслки:', error);
        ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
});

bot.command('msg', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    try {
        const msg = ctx.message;

        const photo = msg.photo && msg.photo.length > 0
            ? msg.photo[msg.photo.length - 1]
            : null;

        let rawText = '';
        if (photo) {

            rawText = (msg.caption || '').replace(/^\/msg\s*/i, '').trim();
        } else {
            rawText = msg.text.replace(/^\/msg\s*/i, '').trim();
        }

        if (!photo && !rawText) {
            return ctx.reply(
                '❌ Укажите текст или отправьте фото с подписью.\n\n' +
                'Форматы:\n' +
                '/msg Текст сообщения\n' +
                '[фото] + подпись: /msg Текст сообщения'
            );
        }

        const censoredText = rawText ? censorText(rawText) : null;
        const caption = censoredText
            ? `📢 Сообщение от администрации:\n\n${censoredText}`
            : '📢 Сообщение от администрации';

        const userIds = getAllUserIds();

        if (userIds.length === 0) {
            return ctx.reply('❌ Нет пользователей для рассылки.');
        }

        await ctx.reply(`⏳ Начинаю рассылку для ${userIds.length} пользователей...`);

        let successCount = 0;
        let failCount = 0;

        for (const userId of userIds) {

            if (userId === ctx.from.id) { successCount++; continue; }
            try {
                if (photo) {
                    await bot.telegram.sendPhoto(userId, photo.file_id, { caption });
                } else {
                    await bot.telegram.sendMessage(userId, caption);
                }
                successCount++;

                await new Promise(r => setTimeout(r, 35));
            } catch (error) {
                failCount++;
                console.error(`Ошибка отправки пользователю ${userId}:`, error.message);
            }
        }

        ctx.reply(
            `✅ Рассылка завершена!\n\n` +
            `📤 Доставлено: ${successCount}\n` +
            `❌ Ошибок: ${failCount}\n` +
            `👥 Всего пользователей: ${userIds.length}`
        );
    } catch (error) {
        console.error('Ошибка команды /msg:', error);
        ctx.reply('❌ Ошибка при рассылке.');
    }
});

bot.action(/report_(.+)/, async (ctx) => {
    const linkId = ctx.match[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) return ctx.answerCbQuery('❌ Сслка не найдена.');

    const adminId = Number(process.env.ADMIN_ID) || 8500715817;

    try {
        await bot.telegram.sendMessage(
            adminId,
            `🚩 ЖАЛОБА НА ССЛКУ\n\n` +
            `ID сслки: ${linkId}\n` +
            `Переходов: ${link.clicks}\n` +
            `Создана: ${link.createdAt}\n` +
            `TikTok: ${link.ttLink || 'Не указан'}\n\n` +
            `Использовать /block ${linkId} для блокировки`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔒 Заблокировать', `admin_block_${linkId}`)],
            ])
        );
        ctx.answerCbQuery('✅ Жалоба отправлена модераторам.');
    } catch (err) {
        console.error('Ошибка отправки жалобы админу:', err);
        ctx.answerCbQuery('❌ Ошибка при отправке жалобы.');
    }
});

bot.action(/^admin_block_(.+)/, (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('🚫 Доступ запрещен.');

    const linkId = ctx.match[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) return ctx.answerCbQuery('❌ Сслка не найдена.');

    link.isBlocked = true;
    saveLinks(links);

    ctx.editMessageText(`✅ Сслка ${linkId} заблокирована.\n👤 Автор: @${link.creator}`);
    ctx.answerCbQuery('Заблокировано.');
});

bot.command('block', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('🚫 У вас нет прав администратора.');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Использование: /block <id_сслки>');

    const linkId = args[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) return ctx.reply(`❌ Сслка с ID ${linkId} не найдена.`);

    link.isBlocked = true;
    saveLinks(links);
    ctx.reply(`✅ Сслка ${linkId} заблокирована.\n👤 Автор: @${link.creator}`);
});

bot.command('unblock', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('🚫 У вас нет прав администратора.');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Использование: /unblock <id_сслки>');

    const linkId = args[1];
    const links = getLinks();
    const link = links.find((l) => l.id === linkId);

    if (!link) return ctx.reply(`❌ Сслка с ID ${linkId} не найдена.`);

    link.isBlocked = false;
    saveLinks(links);
    ctx.reply(`✅ Сслка ${linkId} разблокирована.`);
});

bot.command('stats', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('🚫 У вас нет прав администратора.');

    cleanExpiredLinks();
    const links = getLinks();
    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const blockedCount = links.filter((l) => l.isBlocked).length;
    const activeCount = links.length - blockedCount;

    ctx.reply(
        `📊 СТАТИСТИКА\n\n` +
        `📌 Всего сслок: ${links.length}\n` +
        `✅ Активных: ${activeCount}\n` +
        `🚫 Заблокировано: ${blockedCount}\n` +
        `📈 Всего переходов: ${totalClicks}\n` +
        `👥 Уникальных авторов: ${new Set(links.map((l) => l.creatorId)).size}`
    );
});

bot.catch((err) => {
    console.error('Ошибка бота:', err);
});

cleanExpiredLinks();
setInterval(cleanExpiredLinks, 60 * 60 * 1000);

bot.launch().then(() => {
    console.log('✅ Бот запущен успешно!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
