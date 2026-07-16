const { Client } = require('discord.js-selfbot-v13');
const { exec } = require('child_process');
const CDP = require('chrome-remote-interface');

let client = null;

let globalCDPClient = null;

// Đã gỡ bỏ auto-kill chrome để tránh làm mất tab của sếp

function getCDPClientAsync(config) {
    return new Promise((resolve, reject) => {
        if (globalCDPClient) return resolve(globalCDPClient);
        CDP({ host: '127.0.0.1', port: 9222 }).then(client => {
            globalCDPClient = client;
            globalCDPClient.on('disconnect', () => { globalCDPClient = null; });
            resolve(client);
        }).catch(e => {
            globalCDPClient = null;
            reject(e);
        });
    });
}

function injectATC(client, url, targetId, logCallback, superSpeed) {
    const atcScripts = [
        { 
            match: 'amazon.co.jp', 
            script: `let btn = document.querySelector('#add-to-cart-button, #buy-now-button'); if(btn) { btn.click(); return true; } return false;` 
        },
        { 
            match: 'rakuten.co.jp', 
            script: `let btn = document.querySelector('.cart-button, button.checkout, button[data-ratid="add_to_cart"], #pageblock-cart'); if(btn) { btn.click(); return true; } return false;` 
        },
        { 
            match: 'yodobashi.com', 
            script: `let btn = document.querySelector('.js-buyBtn, #js-buyBtn, #js-addCartBtn'); if(btn) { btn.click(); return true; } return false;` 
        },
        { 
            match: 'joshinweb.jp', 
            script: `let btn = document.querySelector('.btn-cart, input[value="カートに入れる"]'); if(btn) { btn.click(); return true; } return false;` 
        },
        { 
            match: 'biccamera.com', 
            script: `let btn = document.querySelector('.btn_cart, .bcs_button--cart, #addCart'); if(btn) { btn.click(); return true; } return false;` 
        },
        { 
            match: 'fujifilm', 
            script: `let btn = document.querySelector('#cart_add, .btn-add-cart'); if(btn) { btn.click(); return true; } return false;` 
        }
    ];

    const site = atcScripts.find(s => url.includes(s.match));
    
    // Nếu không có site hỗ trợ ATC VÀ không bật chế độ Siêu Tốc thì bỏ qua việc attach để tiết kiệm RAM
    if (!site && !superSpeed) return;

    // Sử dụng kết nối có sẵn (zero-latency) thay vì tạo kết nối websocket mới
    client.Target.attachToTarget({ targetId: targetId, flatten: true }).then(res => {
        const sessionId = res.sessionId;

        if (superSpeed) {
            // Chặn tải toàn bộ tài nguyên không cần thiết để tăng tốc tối đa
            client.send('Network.setBlockedURLs', { urls: ["*.jpg", "*.jpeg", "*.png", "*.gif", "*.webp", "*.woff", "*.woff2", "*.mp4", "*.webm", "*.svg", "*.ico"] }, sessionId).catch(()=>{});
            client.send('Network.enable', {}, sessionId).catch(()=>{});
            client.send('Page.navigate', { url: url }, sessionId).catch(()=>{});
            logCallback(`   ⚡ [VIP] Kích hoạt SIÊU TỐC ĐỘ: Chặn Ảnh & CSS thành công!\n`);
        }

        if (site) {
            const fullScript = `
                (function() {
                    let attempts = 0;
                    let interval = setInterval(() => {
                        attempts++;
                        try {
                            ${site.script}
                            if (attempts > 1500) clearInterval(interval); // Dừng sau 15 giây nếu không thấy nút
                        } catch(e) {}
                    }, 10);
                })();
            `;
            client.send('Runtime.evaluate', { expression: fullScript }, sessionId).catch(()=>{});
            logCallback(`   💉 [AUTO-CLICK] Đã tiêm kịch bản siêu tốc (10ms) cho ${site.match}!\n`);
        }
        
        // Gỡ attach khỏi tab này sau 16 giây để giải phóng bộ nhớ
        setTimeout(() => { client.Target.detachFromTarget({ sessionId }).catch(()=>{}); }, 16000);
    }).catch(()=>{});
}

// Hàm mở link siêu tốc qua CDP, giữ kết nối vĩnh viễn, mở dự phòng siêu tốc không crash chrome
function openLink(url, config, logCallback) {
    const superSpeed = config.SUPER_SPEED_MODE === 'true';
    const initialUrl = superSpeed ? 'about:blank' : url;

    if (globalCDPClient) {
        globalCDPClient.Target.createTarget({ url: initialUrl }).then(target => {
            injectATC(globalCDPClient, url, target.targetId, logCallback, superSpeed);
        }).catch(() => { globalCDPClient = null; });
        logCallback(`   🔥 [PHẢN LỰC CDP] Đã bốc đầu link thẳng vào Profile của sếp!\n`);
    } else {
        getCDPClientAsync(config).then(clientCDP => {
            clientCDP.Target.createTarget({ url: initialUrl }).then(target => {
                injectATC(clientCDP, url, target.targetId, logCallback, superSpeed);
            }).catch(() => { globalCDPClient = null; });
            logCallback(`   🔥 [PHẢN LỰC CDP] Đã bốc đầu link thẳng vào Profile của sếp!\n`);
        }).catch(err => {
            logCallback(`   ⚠️ CDP chưa mở. Bắn link bằng hệ thống CMD Phản Lực để không làm mất tab của sếp...\n`);
            
            // Mở dự phòng bằng spawn không cần chờ shell (loại bỏ độ trễ của exec)
            require('child_process').spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
        });
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
    const ANTI_KEYWORDS = (config.ANTI_KEYWORDS || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
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
    const loggedMessages = new Set();

    function processAndOpenLink(url) {
        // Lọc rác: Bỏ qua link ảnh
        if (url.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
            // logCallback(`   [Lọc rác] Bỏ qua link ảnh: ${url}\n`);
            return;
        }

        // Lọc từ khóa loại trừ (Anti-keywords)
        if (ANTI_KEYWORDS.length > 0) {
            const lowerUrl = url.toLowerCase();
            if (ANTI_KEYWORDS.some(ak => lowerUrl.includes(ak))) {
                logCallback(`   🚫 [Loại trừ] Bỏ qua link Resell: ${url}\n`);
                return;
            }
        }

        // Kiểm tra từ khóa đã được chuyển ra ngoài hàm handleMessage để lọc toàn bộ tin nhắn thay vì chỉ lọc URL

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

        // MỞ LINK TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ KHÁC (Log, webhook, sound)
        openLink(url, config, logCallback);
        
        logCallback(`   -> Đang mở: ${url}\n`);
        if (ENABLE_SOUND && soundCallback) soundCallback();
        
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
        
        // Pre-warm kết nối CDP, nếu lỗi thì kệ, báo log nhắc nhẹ thôi
        getCDPClientAsync(config).catch(() => {
            logCallback(`   ℹ️ Chưa kết nối được CDP. Tool vẫn sẽ mở bằng CMD phản lực. Nếu muốn bật CDP thì sếp tự bấm nút "MỞ CHROME" nhé.\n`);
        });
    });

    const handleMessage = async (message) => {
        if (!message || !message.author) return;
        const isTargetChannel = CHANNEL_IDS.includes(message.channelId);
        const isTargetServer = message.guildId && SERVER_IDS.includes(message.guildId);
        if (!isTargetChannel && !isTargetServer) return;

        if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(message.author.id)) return;

        let embedText = '';
        let hasEmbedUrl = false;
        if (message.embeds && message.embeds.length > 0) {
            for (const e of message.embeds) {
                if (e.url) hasEmbedUrl = true;
                if (e.title) embedText += ' ' + e.title;
                if (e.description) embedText += ' ' + e.description;
                if (e.fields) {
                    for (const f of e.fields) {
                        if (f.name) embedText += ' ' + f.name;
                        if (f.value) embedText += ' ' + f.value;
                    }
                }
                if (e.footer && e.footer.text) embedText += ' ' + e.footer.text;
                if (e.author && e.author.name) embedText += ' ' + e.author.name;
            }
        }

        const linksInText = message.content ? message.content.match(/(https?:\/\/[^\s<>()"']+)/g) : [];
        if (!hasEmbedUrl && (!linksInText || linksInText.length === 0)) {
            return; // Bỏ qua nếu tin nhắn không chứa link nào để tránh spam log
        }
        
        const checkText = (message.content || '') + embedText;

        let matchedKeywordStr = null;
        if (KEYWORDS.length > 0) {
            const lowerText = checkText.toLowerCase();
            const matchedKeyword = KEYWORDS.find(k => lowerText.includes(k));
            if (!matchedKeyword) return;
            matchedKeywordStr = matchedKeyword;
        }

        if (REQUIRE_IN_STOCK) {
            const isOutOfStock = /🔴|:red_circle:|在庫なし|Out of stock/i.test(checkText);
            const isInStock = /🟢|:green_circle:|在庫あり|INSTOCK|Stock/i.test(checkText);

            if (isOutOfStock || !isInStock) {
                // logCallback(`\n[${new Date().toLocaleTimeString()}] 🚫 [Lọc] Bỏ qua vì HẾT HÀNG.\n`);
                return; 
            }
        }

        if (matchedKeywordStr && !loggedMessages.has(message.id)) {
            logCallback(`   🎯 [Khớp Từ Khóa] Bắt trúng chữ: "${matchedKeywordStr}"\n`);
            loggedMessages.add(message.id);
            setTimeout(() => loggedMessages.delete(message.id), 60000); // Xóa cache sau 1 phút
        }

        const extractedLinks = new Set();
        const links = message.content ? message.content.match(/(https?:\/\/[^\s<>()"']+)/g) : [];
        if (links) {
            for (const link of links) extractedLinks.add(link);
        }
        
        if (message.embeds && message.embeds.length > 0) {
            for (const embed of message.embeds) {
                if (embed.url) extractedLinks.add(embed.url);
            }
        }
        
        if (extractedLinks.size > 0) {
            logCallback(`\n[${new Date().toLocaleTimeString()}] 🚀 Phát hiện link từ ${message.author.username}:\n`);
            for (const link of extractedLinks) {
                processAndOpenLink(link);
            }
        }
    };

    client.on('messageCreate', handleMessage);
    client.on('messageUpdate', (oldMessage, newMessage) => handleMessage(newMessage));

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
