const { contextBridge } = require('electron');

// Expor informações seguras ao renderer se necessário
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
