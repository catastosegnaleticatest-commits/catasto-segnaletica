const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
    platform: process.platform,
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
