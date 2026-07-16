const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    startBot: () => ipcRenderer.send('start-bot'),
    stopBot: () => ipcRenderer.send('stop-bot'),
    openChromeDebug: () => ipcRenderer.send('open-chrome-debug'),
    killChrome: () => ipcRenderer.send('kill-chrome'),
    fetchChannels: (data) => ipcRenderer.invoke('fetch-channels', data),
    onBotLog: (callback) => ipcRenderer.on('bot-log', callback),
    onPlaySound: (callback) => ipcRenderer.on('play-sound', callback),
    onBotStatus: (callback) => ipcRenderer.on('bot-status', callback),
    onUpdateReady: (callback) => ipcRenderer.on('update-ready', callback),
    installUpdate: () => ipcRenderer.send('install-update')
});
