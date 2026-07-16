const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { startMonitor, stopMonitor } = require('./index.js');

let mainWindow;
const envPath = path.join(app.getPath('userData'), 'config.env');
let isRunning = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 950,
        webPreferences: {
            preload: path.join(__dirname, 'ui', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true,
        title: "Discord Link Monitor Pro"
    });

    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

// Auto-updater logic
autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('bot-log', '🔄 Đang kiểm tra phiên bản mới trên GitHub...\n');
});
autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('bot-log', `🎉 Phát hiện phiên bản mới (v${info.version}). Đang tiến hành tải xuống ngầm...\n`);
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['Đồng ý'],
            title: 'Cập nhật phần mềm',
            message: `Phát hiện phiên bản mới v${info.version}!`,
            detail: `Hệ thống đang tự động tải bản cập nhật dưới nền. Vui lòng tiếp tục sử dụng, chúng tôi sẽ thông báo khi tải xong.`
        });
    }
});
autoUpdater.on('error', (err) => {
    if (mainWindow) {
        if (err.message.includes('No published versions on GitHub')) {
            mainWindow.webContents.send('bot-log', `ℹ️ Hệ thống Auto-Update đã kết nối GitHub thành công (Hiện chưa có bản Release nào được đăng tải).\n`);
        } else {
            mainWindow.webContents.send('bot-log', `⚠️ Lỗi khi tải bản cập nhật: ${err.message}\n`);
        }
    }
});
autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
        mainWindow.webContents.send('bot-log', `✅ Tải xuống hoàn tất! Chờ xác nhận cài đặt...\n`);
        mainWindow.webContents.send('update-ready', info.version);
        
        dialog.showMessageBox(mainWindow, {
            type: 'question',
            buttons: ['Cài đặt ngay', 'Để sau'],
            defaultId: 0,
            title: 'Cài đặt bản cập nhật',
            message: `Phiên bản v${info.version} đã tải xong!`,
            detail: `Bạn có muốn khởi động lại ứng dụng để áp dụng bản cập nhật ngay bây giờ không?`
        }).then((returnValue) => {
            if (returnValue.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    }
});

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
    app.setAppUserModelId("com.discord.monitor");
    createWindow();
    
    // Cấu hình cập nhật từ GitHub
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'nghiahurricane',
        repo: 'discord-moniter'
    });

    const checkUpdate = () => {
        autoUpdater.checkForUpdatesAndNotify().catch(e => {
            console.log("Update check error:", e);
        });
    };

    // Check update sau 2s khi mở app
    setTimeout(checkUpdate, 2000);

    // Tự động check update lặp lại mỗi 30 phút (1800000 ms)
    setInterval(checkUpdate, 30 * 60 * 1000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    stopMonitor();
    if (process.platform !== 'darwin') app.quit();
});

function loadConfigObj() {
    if (!fs.existsSync(envPath)) return {};
    const dotenv = require('dotenv');
    const content = fs.readFileSync(envPath, 'utf8');
    return dotenv.parse(content);
}

ipcMain.handle('get-config', () => {
    return loadConfigObj();
});

ipcMain.handle('save-config', (event, newConfig) => {
    let envContent = `# Token của tài khoản Discord của bạn
DISCORD_TOKEN=${newConfig.DISCORD_TOKEN || ''}
CHANNEL_IDS=${newConfig.CHANNEL_IDS || ''}
CHANNEL_NAMES_MAP=${newConfig.CHANNEL_NAMES_MAP || '{}'}
SAVED_SERVERS_MAP=${newConfig.SAVED_SERVERS_MAP || '{}'}
SERVER_IDS=${newConfig.SERVER_IDS || ''}
KEYWORDS_FILTER=${newConfig.KEYWORDS_FILTER || ''}
ALLOWED_USER_IDS=${newConfig.ALLOWED_USER_IDS || ''}
COOLDOWN_SECONDS=${newConfig.COOLDOWN_SECONDS || '300'}
CHROME_PROFILE=${newConfig.CHROME_PROFILE || ''}
AUTO_START=${newConfig.AUTO_START === true || newConfig.AUTO_START === 'true'}
ENABLE_SOUND=${newConfig.ENABLE_SOUND === true || newConfig.ENABLE_SOUND === 'true'}
REQUIRE_IN_STOCK=${newConfig.REQUIRE_IN_STOCK === true || newConfig.REQUIRE_IN_STOCK === 'true'}
WEBHOOK_URL=${newConfig.WEBHOOK_URL || ''}
ANTI_KEYWORDS=${newConfig.ANTI_KEYWORDS || ''}
USE_INDEPENDENT_CHROME=${newConfig.USE_INDEPENDENT_CHROME === true || newConfig.USE_INDEPENDENT_CHROME === 'true'}
SUPER_SPEED_MODE=${newConfig.SUPER_SPEED_MODE === true || newConfig.SUPER_SPEED_MODE === 'true'}
`;
    fs.writeFileSync(envPath, envContent);

    // Xử lý Auto Start
    if (process.platform === 'win32') {
        const autoStart = newConfig.AUTO_START === true || newConfig.AUTO_START === 'true';
        app.setLoginItemSettings({
            openAtLogin: autoStart,
            path: app.getPath('exe')
        });
    }

    return true;
});

// Mở Chrome Debug Mode
ipcMain.on('open-chrome-debug', (event) => {
    const config = loadConfigObj();
    const profile = config.CHROME_PROFILE ? config.CHROME_PROFILE.trim() : 'Default';
    
    event.reply('bot-log', `⏳ Đang đóng ép Chrome cũ để giải phóng Port CDP...\n`);
    
    // Tự động kill trước
    exec('taskkill /F /FI "USERNAME eq %USERNAME%" /IM chrome.exe /T', (err, stdout, stderr) => {
        if (err && err.message.includes('Access is denied')) {
            event.reply('bot-log', `❌ LỖI QUYỀN TRUY CẬP: Không thể đóng ép Chrome ngầm do Chrome đang chạy quyền Admin. Vui lòng TẮT TOOL, sau đó CHUỘT PHẢI vào biểu tượng Tool chọn "Run as Administrator" rồi thử lại!\n`);
        } else if (err) {
            event.reply('bot-log', `⚠️ Cảnh báo đóng Chrome: ${stderr || err.message}\n`);
        }

        setTimeout(() => {
            const independentChrome = config.USE_INDEPENDENT_CHROME === 'true';
            let chromeCmd = '';
            
            if (independentChrome) {
                const userDataDir = require('path').join(require('electron').app.getPath('userData'), 'ChromeData');
                event.reply('bot-log', `🌍 Đang mở Chrome (CHẾ ĐỘ ĐỘC LẬP) để FIX LỖI CDP...\n`);
                chromeCmd = `cmd /c start chrome --remote-debugging-port=9222 --user-data-dir="${userDataDir}"`;
            } else {
                event.reply('bot-log', `🌍 Đang mở lại Chrome (Profile: ${profile}) với kết nối siêu tốc CDP...\n`);
                chromeCmd = `cmd /c start chrome --remote-debugging-port=9222 --profile-directory="${profile}"`;
            }
            exec(chromeCmd, (err2) => {
                if (err2) event.reply('bot-log', `❌ Lỗi mở Chrome: ${err2.message}\n`);
            });
        }, 1500); // Đợi 1.5s cho Chrome tắt hẳn
    });
});

// Nút Đóng ép Chrome thủ công
ipcMain.on('kill-chrome', (event) => {
    exec('taskkill /F /FI "USERNAME eq %USERNAME%" /IM chrome.exe /T', (err, stdout, stderr) => {
        if (err && err.message.includes('Access is denied')) {
            event.reply('bot-log', `❌ LỖI QUYỀN: Không thể diệt Chrome. Chrome có thể đang chạy bằng quyền Admin. Vui lòng tắt Tool, CHUỘT PHẢI chọn "Run as Administrator"!\n`);
        } else if (err) {
            event.reply('bot-log', `⚠️ ${stderr || err.message}\n`);
        } else {
            event.reply('bot-log', `💀 Đã tiêu diệt sạch sẽ mọi mầm mống Chrome!\n`);
        }
    });
});

// Khởi động Bot
ipcMain.on('start-bot', (event) => {
    if (isRunning) return;

    event.reply('bot-status', 'running');
    event.reply('bot-log', '⏳ Đang khởi động hệ thống...\n');

    const config = loadConfigObj();

    isRunning = true;
    startMonitor(config, 
        (logMsg) => { // logCallback
            event.reply('bot-log', logMsg);
        },
        () => { // soundCallback
            event.reply('play-sound');
        }
    );
});

// Dừng Bot
ipcMain.on('stop-bot', (event) => {
    if (isRunning) {
        stopMonitor((logMsg) => {
            event.reply('bot-log', logMsg);
        });
        isRunning = false;
        event.reply('bot-status', 'stopped');
        event.reply('bot-log', '🛑 Đã dừng hệ thống.\n');
    }
});

// Lấy danh sách kênh từ Discord API
ipcMain.handle('fetch-channels', async (event, { token, serverId }) => {
    try {
        const resGuild = await fetch(`https://discord.com/api/v9/guilds/${serverId}`, {
            headers: { 'Authorization': token }
        });
        if (!resGuild.ok) throw new Error(`Lỗi lấy Server ${resGuild.status}: Kiểm tra lại ID Server`);
        const guildData = await resGuild.json();

        const res = await fetch(`https://discord.com/api/v9/guilds/${serverId}/channels`, {
            headers: { 'Authorization': token }
        });
        if (!res.ok) {
            throw new Error(`Lỗi lấy kênh ${res.status}: ${res.statusText}`);
        }
        const channelsData = await res.json();
        // Lọc ra các kênh text (type 0) và announcement (type 5)
        const channels = channelsData.filter(c => c.type === 0 || c.type === 5).map(c => ({
            id: c.id,
            name: c.name
        }));
        
        return {
            serverName: guildData.name,
            channels: channels
        };
    } catch (e) {
        console.error(e);
        return { error: e.message };
    }
});
