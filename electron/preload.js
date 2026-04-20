const { contextBridge, shell } = require('electron');

contextBridge.exposeInMainWorld('kioskShell', {
  isElectron: true,
  openExternal: (url) => shell.openExternal(url),
});
