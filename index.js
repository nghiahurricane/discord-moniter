const { Client } = require('discord.js-selfbot-v13');
const { exec } = require('child_process');
const CDP = require('chrome-remote-interface');

let client = null;

// Hàm mở link siêu tốc qua CDP, nếu lỗi (Chrome chưa mở mode debug) thì fallback qua exec
async function openLink(url, logCallback) {
    try {
        const clientCDP = await CDP({ host: '127.0.0.1', port: 9222 });
        const { Target } = clientCDP;
        await Target.createTarget({ url: url });
        await clientCDP.close();
        logCallback(`   ⚡ [CDP] Đã bơm link thành công!\n`);
    } catch (err) {
        logCallback(`   ⚠️ Lỗi CDP (${err.message}). Đang mở mặc định. Bạn nhớ bấm "MỞ CHROME SĂN HÀNG" trên tool nhé!\n`);
        const { shell } = require('electron');
        shell.openExternal(url).catch(e => logCallback(`   ❌ Lỗi mở link: ${e.message}\n`));
    }
}

function startMonitor(config, logCallback, soundCallback) {
    if (client) {
        logCallback("⚠️ Bot đang chạy rồi.\n");
        return;
    }
    
    client = new Client({ checkUpdate: false });
    
    const TOKEN = config.DISCORD_TOKEN;
    const CHANNEL_IDS = (config.CHANNEL_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const SERVER_IDS = (config.SERVER_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const KEYWORDS = (config.KEYWORDS_FILTER || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    const ALLOWED_USERS = (config.ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(id => id);
    const COOLDOWN_SECONDS = parseInt(config.COOLDOWN_SECONDS) || 0;
    const ENABLE_SOUND = config.ENABLE_SOUND === 'true';
    const REQUIRE_IN_STOCK = config.REQUIRE_IN_STOCK === 'true';
    const WEBHOOK_URL = config.WEBHOOK_URL ? config.WEBHOOK_URL.trim() : '';
    
    if (!TOKEN) {
        logCallback('❌ Lỗi: Bạn chưa cấu hình DISCORD_TOKEN!\n');
        return;
    }
    if (CHANNEL_IDS.length === 0 && SERVER_IDS.length === 0) {
        logCallback('❌ Lỗi: Bạn phải cấu hình ít nhất 1 ID Kênh hoặc 1 ID Server!\n');
        return;
    }

    const openedLinksCache = new Set();

    function processAndOpenLink(url) {
        // Lọc rác: Bỏ qua link ảnh
        if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
            // logCallback(`   [Lọc rác] Bỏ qua link ảnh: ${url}\n`);
            return;
        }

        if (KEYWORDS.length > 0) {
            const lowerUrl = url.toLowerCase();
            if (!KEYWORDS.some(k => lowerUrl.includes(k))) return;
        }

        if (COOLDOWN_SECONDS > 0) {
            if (openedLinksCache.has(url)) {
                logCallback(`   [Bỏ qua] Spam link: ${url}\n`);
                return;
            }
            openedLinksCache.add(url);
            // Dọn dẹp RAM tự động sau thời gian Cooldown
            setTimeout(() => {
                openedLinksCache.delete(url);
            }, COOLDOWN_SECONDS * 1000);
        }

        logCallback(`   -> Đang mở: ${url}\n`);
        if (ENABLE_SOUND && soundCallback) soundCallback();
        openLink(url, logCallback);
        
        if (WEBHOOK_URL) {
            fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `🚀 **Hàng Mới Tới!**\n🔗 Link: ${url}`
                })
            }).catch(err => logCallback(`   ⚠️ Lỗi gửi Webhook: ${err.message}\n`));
        }
    }

    client.on('ready', () => {
        logCallback(`=========================================\n`);
        logCallback(`✅ Đã đăng nhập tài khoản: ${client.user.username}\n`);
        logCallback(`📡 Đang theo dõi ${CHANNEL_IDS.length} kênh và ${SERVER_IDS.length} server.\n`);
        logCallback(`=========================================\n`);
        logCallback(`⏳ Đang chờ tin nhắn mới chứa link...\n`);
    });

    client.on('messageCreate', async (message) => {
        const isTargetChannel = CHANNEL_IDS.includes(message.channelId);
        const isTargetServer = message.guildId && SERVER_IDS.includes(message.guildId);
        if (!isTargetChannel && !isTargetServer) return;

        if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(message.author.id)) return;

        // Lấy toàn bộ nội dung text và embed để lọc từ khóa / tồn kho
        const fullText = message.content + (message.embeds ? message.embeds.map(e => JSON.stringify(e)).join(' ') : '');

        if (REQUIRE_IN_STOCK) {
            const isOutOfStock = /🔴|:red_circle:|在庫なし|Out of stock/i.test(fullText);
            const isInStock = /🟢|:green_circle:|在庫あり|INSTOCK|Stock/i.test(fullText);

            if (isOutOfStock || !isInStock) {
                logCallback(`\n[${new Date().toLocaleTimeString()}] 🚫 [Lọc Tồn Kho] Bỏ qua vì HẾT HÀNG (Out of stock).\n`);
                return; // Skip opening any links
            }
        }

        const links = message.content.match(/(https?:\/\/[^\s]+)/g);
        let found = false;
        
        if (links && links.length > 0) {
            logCallback(`\n[${new Date().toLocaleTimeString()}] 🚀 Phát hiện link từ ${message.author.username}:\n`);
            found = true;
            for (const link of links) processAndOpenLink(link);
        }

        if (message.embeds && message.embeds.length > 0) {
            for (const embed of message.embeds) {
                if (embed.url) {
                    if (!found) {
                        logCallback(`\n[${new Date().toLocaleTimeString()}] 🚀 Phát hiện link Embed từ ${message.author.username}:\n`);
                        found = true;
                    }
                    processAndOpenLink(embed.url);
                }
            }
        }
    });

    client.login(TOKEN).catch((err) => {
        logCallback('❌ Lỗi đăng nhập: Token không hợp lệ hoặc mạng rớt!\n');
        logCallback(err.message + '\n');
        client = null;
    });
}

function stopMonitor(logCallback) {
    if (client) {
        client.destroy();
        client = null;
        if (logCallback) logCallback('🛑 Đã dừng Monitor.\n');
    }
}

module.exports = { startMonitor, stopMonitor };
