import { IpcMain, shell } from 'electron'
import { SSOOIDCClient, RegisterClientCommand, StartDeviceAuthorizationCommand, CreateTokenCommand } from '@aws-sdk/client-sso-oidc'
import { SSOClient, GetRoleCredentialsCommand } from '@aws-sdk/client-sso'
import Store from 'electron-store'

interface SessionData {
    accessToken: string
    accessTokenExpiry: number
    credentials: {
        accessKeyId: string
        secretAccessKey: string
        sessionToken: string
        expiration: number
    }
    startUrl: string
    region: string
    accountId: string
    roleName: string
}

const store = new Store<{ session: SessionData | null }>({ name: 'dynamore-auth' })
const configStore = new Store<{
    lastSSOConfig: { startUrl: string; region: string; accountId: string; roleName: string } | null
}>({ name: 'dynamore-config' })

let currentSession: SessionData | null = store.get('session', null)

export function getCredentials() {
    if (!currentSession) throw new Error('Not authenticated')
    if (Date.now() > currentSession.credentials.expiration - 60_000) {
        throw new Error('Credentials expired – please log in again')
    }
    return {
        accessKeyId: currentSession.credentials.accessKeyId,
        secretAccessKey: currentSession.credentials.secretAccessKey,
        sessionToken: currentSession.credentials.sessionToken,
        region: currentSession.region
    }
}

export function registerAuthHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('auth:getLastSSOConfig', () => {
        return configStore.get('lastSSOConfig', null)
    })

    ipcMain.handle('auth:startSSOLogin', async (event, { startUrl, region, accountId, roleName }) => {
        try {
            const oidcClient = new SSOOIDCClient({ region })

            // Step 1: Register client
            event.sender.send('auth:loginProgress', 'Registering client…')
            const registerRes = await oidcClient.send(new RegisterClientCommand({
                clientName: 'dynamore',
                clientType: 'public'
            }))

            // Step 2: Start device authorization
            event.sender.send('auth:loginProgress', 'Starting device authorization…')
            const authRes = await oidcClient.send(new StartDeviceAuthorizationCommand({
                clientId: registerRes.clientId!,
                clientSecret: registerRes.clientSecret!,
                startUrl
            }))

            // Step 3: Open browser for user to login
            event.sender.send('auth:loginProgress', 'Opening browser for login…')
            await shell.openExternal(authRes.verificationUriComplete!)

            // Step 4: Poll for token
            event.sender.send('auth:loginProgress', 'Waiting for login completion…')
            const interval = (authRes.interval ?? 5) * 1000
            const expiresAt = Date.now() + (authRes.expiresIn ?? 600) * 1000

            let accessToken: string | undefined
            while (Date.now() < expiresAt) {
                await new Promise(r => setTimeout(r, interval))
                try {
                    const tokenRes = await oidcClient.send(new CreateTokenCommand({
                        clientId: registerRes.clientId!,
                        clientSecret: registerRes.clientSecret!,
                        grantType: 'urn:ietf:params:oauth:grant-type:device_code',
                        deviceCode: authRes.deviceCode!
                    }))
                    accessToken = tokenRes.accessToken!
                    break
                } catch (e: unknown) {
                    const err = e as { name?: string }
                    if (err.name !== 'AuthorizationPendingException') throw e
                }
            }

            if (!accessToken) throw new Error('Login timed out')

            // Step 5: Get role credentials
            event.sender.send('auth:loginProgress', 'Fetching credentials…')
            const ssoClient = new SSOClient({ region })
            const credRes = await ssoClient.send(new GetRoleCredentialsCommand({
                accessToken,
                accountId,
                roleName
            }))

            const c = credRes.roleCredentials!
            currentSession = {
                accessToken,
                accessTokenExpiry: Date.now() + 8 * 3600_000,
                credentials: {
                    accessKeyId: c.accessKeyId!,
                    secretAccessKey: c.secretAccessKey!,
                    sessionToken: c.sessionToken!,
                    expiration: c.expiration!
                },
                startUrl,
                region,
                accountId,
                roleName
            }

            store.set('session', currentSession)
            configStore.set('lastSSOConfig', { startUrl, region, accountId, roleName })
            return { success: true, accountId, roleName, region }
        } catch (err: unknown) {
            const error = err as Error
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('auth:logout', () => {
        currentSession = null
        store.delete('session')
        return { success: true }
    })

    ipcMain.handle('auth:getSession', () => {
        if (!currentSession) return null
        // Check if credentials or token are expired
        if (Date.now() > currentSession.credentials.expiration - 60_000) {
            currentSession = null
            store.delete('session')
            return null
        }
        return {
            accountId: currentSession.accountId,
            roleName: currentSession.roleName,
            region: currentSession.region
        }
    })
}
