import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed IPC API exposed to renderer
const api = {
    // Auth
    auth: {
        startSSOLogin: (params: { startUrl: string; region: string; accountId: string; roleName: string }) =>
            ipcRenderer.invoke('auth:startSSOLogin', params),
        logout: () => ipcRenderer.invoke('auth:logout'),
        getSession: () => ipcRenderer.invoke('auth:getSession'),
        getLastSSOConfig: () => ipcRenderer.invoke('auth:getLastSSOConfig'),
        onLoginProgress: (callback: (event: unknown, message: string) => void) => {
            ipcRenderer.on('auth:loginProgress', callback)
            return () => ipcRenderer.removeListener('auth:loginProgress', callback)
        }
    },

    // Tables
    tables: {
        list: () => ipcRenderer.invoke('tables:list'),
        describe: (tableName: string) => ipcRenderer.invoke('tables:describe', tableName),
        create: (params: unknown) => ipcRenderer.invoke('tables:create', params),
        delete: (tableName: string) => ipcRenderer.invoke('tables:delete', tableName)
    },

    // Items
    items: {
        put: (params: { tableName: string; item: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:put', params),
        get: (params: { tableName: string; key: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:get', params),
        update: (params: unknown) => ipcRenderer.invoke('items:update', params),
        delete: (params: { tableName: string; key: Record<string, unknown> }) =>
            ipcRenderer.invoke('items:delete', params),
        batchDelete: (params: { tableName: string; keys: Record<string, unknown>[] }) =>
            ipcRenderer.invoke('items:batchDelete', params)
    },

    // Query & Scan
    query: {
        query: (params: unknown) => ipcRenderer.invoke('query:query', params),
        scan: (params: unknown) => ipcRenderer.invoke('query:scan', params)
    }
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (for dev fallback)
    window.electron = electronAPI
    // @ts-ignore
    window.api = api
}
