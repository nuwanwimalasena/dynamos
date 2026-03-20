import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Typed IPC API exposed to renderer
const api = {
    // Auth
    auth: {
        initSSO: (params: { startUrl: string; region: string }) =>
            ipcRenderer.invoke('auth:initSSO', params),
        pollSSOToken: (params: { region: string; clientId: string; clientSecret: string; deviceCode: string; interval: number; expiresAt: number }) =>
            ipcRenderer.invoke('auth:pollSSOToken', params),
        listSSOAccounts: (params: { accessToken: string; region: string }) =>
            ipcRenderer.invoke('auth:listSSOAccounts', params),
        listSSOAccountRoles: (params: { accessToken: string; region: string; accountId: string }) =>
            ipcRenderer.invoke('auth:listSSOAccountRoles', params),
        completeSSOLogin: (params: { accessToken: string; region: string; accountId: string; roleName: string; startUrl: string }) =>
            ipcRenderer.invoke('auth:completeSSOLogin', params),
        logout: () => ipcRenderer.invoke('auth:logout'),
        getSession: () => ipcRenderer.invoke('auth:getSession'),
        getLastSSOConfig: () => ipcRenderer.invoke('auth:getLastSSOConfig'),
        clearSSOConfig: () => ipcRenderer.invoke('auth:clearSSOConfig'),
        onSSOProgress: (callback: (step: string, message: string) => void) => {
            const listener = (_event: unknown, data: { step: string; message: string }) => callback(data.step, data.message)
            ipcRenderer.on('auth:ssoProgress', listener)
            return () => ipcRenderer.removeListener('auth:ssoProgress', listener)
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
