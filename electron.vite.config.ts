import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        // Do NOT use externalizeDepsPlugin — all deps must be bundled into
        // out/main/index.js so the packaged app doesn't need node_modules.
        build: {
            lib: {
                entry: resolve('electron/main/index.ts')
            },
            rollupOptions: {
                // Only these truly native Electron built-ins should stay external.
                external: ['electron']
            }
        },
        resolve: {
            alias: {
                '@main': resolve('electron/main')
            }
        }
    },
    preload: {
        // Same — bundle everything, only keep 'electron' external.
        build: {
            lib: {
                entry: resolve('electron/preload/index.ts')
            },
            rollupOptions: {
                external: ['electron']
            }
        }
    },
    renderer: {
        root: resolve('src/renderer'),
        build: {
            rollupOptions: {
                input: resolve('src/renderer/index.html')
            }
        },
        resolve: {
            alias: {
                '@': resolve('src'),
                '@renderer': resolve('src')
            }
        },
        plugins: [react()]
    }
})
