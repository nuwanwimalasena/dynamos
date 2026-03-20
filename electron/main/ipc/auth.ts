import { IpcMain, shell, WebContents } from 'electron'
import { SSOOIDCClient, RegisterClientCommand, StartDeviceAuthorizationCommand, CreateTokenCommand } from '@aws-sdk/client-sso-oidc'
import { SSOClient, GetRoleCredentialsCommand, ListAccountsCommand, ListAccountRolesCommand } from '@aws-sdk/client-sso'
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

function cleanStartUrl(url: string): string {
    // Remove trailing /#/, #/, /, etc.
    return url.trim().replace(/(\/+$|\/\#\/?$)/, '')
}

function sendProgress(sender: WebContents, step: string, message: string) {
    try {
        sender.send('auth:ssoProgress', { step, message })
    } catch (_) { /* window may have closed */ }
}

export function registerAuthHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('auth:getLastSSOConfig', () => {
        return configStore.get('lastSSOConfig', null)
    })

    // Step 1: Initiate SSO - register client, start device auth, open browser
    ipcMain.handle('auth:initSSO', async (event, { startUrl: rawUrl, region }) => {
        const startUrl = cleanStartUrl(rawUrl)
        console.log(`auth:initSSO startUrl=${startUrl} region=${region}`)

        configStore.set('lastSSOConfig', { startUrl, region, accountId: '', roleName: '' })

        sendProgress(event.sender, 'registering', 'Registering with AWS SSO…')
        const oidcClient = new SSOOIDCClient({ region })

        const registerRes = await oidcClient.send(new RegisterClientCommand({
            clientName: 'dynamore',
            clientType: 'public'
        }))

        sendProgress(event.sender, 'authorizing', 'Opening browser for sign-in…')
        const authRes = await oidcClient.send(new StartDeviceAuthorizationCommand({
            clientId: registerRes.clientId!,
            clientSecret: registerRes.clientSecret!,
            startUrl
        }))

        await shell.openExternal(authRes.verificationUriComplete!)

        return {
            clientId: registerRes.clientId!,
            clientSecret: registerRes.clientSecret!,
            deviceCode: authRes.deviceCode!,
            interval: (authRes.interval ?? 5) * 1000,
            expiresAt: Date.now() + (authRes.expiresIn ?? 600) * 1000,
            startUrl,
            region
        }
    })

    // Step 2: Poll for token (runs in background, sends progress events)
    ipcMain.handle('auth:pollSSOToken', async (event, { region, clientId, clientSecret, deviceCode, interval, expiresAt }) => {
        sendProgress(event.sender, 'polling', 'Waiting for browser sign-in to complete…')
        const oidcClient = new SSOOIDCClient({ region })

        while (Date.now() < expiresAt) {
            await new Promise(r => setTimeout(r, interval))
            try {
                const tokenRes = await oidcClient.send(new CreateTokenCommand({
                    clientId,
                    clientSecret,
                    grantType: 'urn:ietf:params:oauth:grant-type:device_code',
                    deviceCode
                }))
                sendProgress(event.sender, 'authenticated', 'Signed in! Fetching your accounts…')
                return { accessToken: tokenRes.accessToken! }
            } catch (e: unknown) {
                const err = e as { name?: string }
                if (err.name !== 'AuthorizationPendingException') throw e
                // Still pending - continue polling
            }
        }
        throw new Error('Login timed out. Please try again.')
    })

    // Step 3: List accounts
    ipcMain.handle('auth:listSSOAccounts', async (_event, { accessToken, region }) => {
        const ssoClient = new SSOClient({ region })
        const res = await ssoClient.send(new ListAccountsCommand({ accessToken }))
        return { accounts: res.accountList || [] }
    })

    // Step 4: List roles for an account
    ipcMain.handle('auth:listSSOAccountRoles', async (_event, { accessToken, region, accountId }) => {
        const ssoClient = new SSOClient({ region })
        const res = await ssoClient.send(new ListAccountRolesCommand({ accessToken, accountId }))
        return { roles: res.roleList || [] }
    })

    // Step 5: Complete login with selected account + role
    ipcMain.handle('auth:completeSSOLogin', async (_event, { accessToken, region, accountId, roleName, startUrl }) => {
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
    })

    ipcMain.handle('auth:logout', () => {
        currentSession = null
        store.delete('session')
        return { success: true }
    })

    ipcMain.handle('auth:getSession', () => {
        if (!currentSession) return null
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

    ipcMain.handle('auth:clearSSOConfig', () => {
        configStore.delete('lastSSOConfig')
        return { success: true }
    })
}
