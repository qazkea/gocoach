const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('secretAPI',Object.freeze({
 submitKey:value=>ipcRenderer.invoke('credentials:submit',value),
 cancel:()=>ipcRenderer.invoke('credentials:cancel')
}));
