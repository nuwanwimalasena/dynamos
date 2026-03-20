import { useState, useEffect, useRef } from 'react'
import { Form, Input, Button, Typography, Steps, Alert, List, Select } from 'antd'
import { AmazonOutlined, LoadingOutlined, CheckCircleOutlined, ArrowRightOutlined, RightOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import type { AWSAccount, AWSRole } from '../types/global'

const { Title, Text, Paragraph } = Typography

type LoginStep = 'config' | 'authenticating' | 'account' | 'role' | 'completing' | 'success' | 'error'

interface LoginFormValues {
    startUrl: string
    region: string
}

const AWS_REGIONS = [
    { label: 'US East (N. Virginia)', value: 'us-east-1' },
    { label: 'US East (Ohio)', value: 'us-east-2' },
    { label: 'US West (N. California)', value: 'us-west-1' },
    { label: 'US West (Oregon)', value: 'us-west-2' },
    { label: 'Africa (Cape Town)', value: 'af-south-1' },
    { label: 'Asia Pacific (Hong Kong)', value: 'ap-east-1' },
    { label: 'Asia Pacific (Hyderabad)', value: 'ap-south-2' },
    { label: 'Asia Pacific (Jakarta)', value: 'ap-southeast-3' },
    { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
    { label: 'Asia Pacific (Osaka)', value: 'ap-northeast-3' },
    { label: 'Asia Pacific (Seoul)', value: 'ap-northeast-2' },
    { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
    { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
    { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
    { label: 'Canada (Central)', value: 'ca-central-1' },
    { label: 'Canada West (Calgary)', value: 'ca-west-1' },
    { label: 'Europe (Frankfurt)', value: 'eu-central-1' },
    { label: 'Europe (Ireland)', value: 'eu-west-1' },
    { label: 'Europe (London)', value: 'eu-west-2' },
    { label: 'Europe (Milan)', value: 'eu-south-1' },
    { label: 'Europe (Paris)', value: 'eu-west-3' },
    { label: 'Europe (Spain)', value: 'eu-south-2' },
    { label: 'Europe (Stockholm)', value: 'eu-north-1' },
    { label: 'Europe (Zurich)', value: 'eu-central-2' },
    { label: 'Middle East (Bahrain)', value: 'me-south-1' },
    { label: 'Middle East (UAE)', value: 'me-central-1' },
    { label: 'South America (São Paulo)', value: 'sa-east-1' },
]

export default function LoginPage() {
    const [form] = Form.useForm<LoginFormValues>()
    const { setSession } = useAppStore()
    const [step, setStep] = useState<LoginStep>('config')
    const [statusMsg, setStatusMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')
    const [loading, setLoading] = useState(false)

    const [accessToken, setAccessToken] = useState('')
    const [startUrlRef, setStartUrlRef] = useState('')
    const [regionRef, setRegionRef] = useState('')
    const [accounts, setAccounts] = useState<AWSAccount[]>([])
    const [roles, setRoles] = useState<AWSRole[]>([])
    const [selectedAccount, setSelectedAccount] = useState<AWSAccount | null>(null)
    const unsubscribeRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        window.api.auth.getLastSSOConfig().then(config => {
            if (config?.startUrl) {
                form.setFieldsValue({
                    startUrl: config.startUrl,
                    region: config.region || 'us-east-1'
                })
            }
        })

        const unsub = window.api.auth.onSSOProgress((_progressStep, message) => {
            setStatusMsg(message)
        })
        unsubscribeRef.current = unsub
        return () => unsub()
    }, [form])

    const handleError = (err: unknown, fallback = 'An error occurred') => {
        const msg = err instanceof Error ? err.message : fallback
        setErrorMsg(msg)
        setStep('error')
        setLoading(false)
    }

    const handleInitSSO = async (values: LoginFormValues) => {
        setLoading(true)
        setErrorMsg('')
        setStatusMsg('Connecting to AWS SSO…')
        setStep('authenticating')

        try {
            const initRes = await window.api.auth.initSSO(values)
            setStartUrlRef(initRes.startUrl ?? values.startUrl)
            setRegionRef(values.region)
            setStatusMsg('Waiting for you to sign in via the browser…')

            const { accessToken } = await window.api.auth.pollSSOToken({
                region: values.region,
                clientId: initRes.clientId,
                clientSecret: initRes.clientSecret,
                deviceCode: initRes.deviceCode,
                interval: initRes.interval,
                expiresAt: initRes.expiresAt
            })

            setAccessToken(accessToken)
            setStatusMsg('Fetching your AWS accounts…')

            const { accounts } = await window.api.auth.listSSOAccounts({ accessToken, region: values.region })
            if (!accounts.length) throw new Error('No AWS accounts found for this user.')
            setAccounts(accounts)
            setStep('account')
        } catch (err) {
            handleError(err, 'Authentication failed. Please check your SSO URL and region.')
        } finally {
            setLoading(false)
        }
    }

    const handleSelectAccount = async (account: AWSAccount) => {
        setSelectedAccount(account)
        setLoading(true)
        try {
            const { roles } = await window.api.auth.listSSOAccountRoles({
                accessToken, region: regionRef, accountId: account.accountId
            })
            if (!roles.length) throw new Error('No roles found for this account.')
            setRoles(roles)
            setStep('role')
        } catch (err) {
            handleError(err, 'Failed to load roles for that account.')
        } finally {
            setLoading(false)
        }
    }

    const handleSelectRole = async (role: AWSRole) => {
        setLoading(true)
        setStep('completing')
        setStatusMsg(`Signing in as ${role.roleName}…`)
        try {
            const res = await window.api.auth.completeSSOLogin({
                accessToken, region: regionRef,
                accountId: selectedAccount!.accountId,
                roleName: role.roleName, startUrl: startUrlRef
            })
            if (!res.success) throw new Error(res.error ?? 'Login failed')
            setStep('success')
            setTimeout(async () => {
                const session = await window.api.auth.getSession()
                setSession(session)
            }, 600)
        } catch (err) {
            handleError(err, 'Failed to complete login.')
        } finally {
            setLoading(false)
        }
    }

    const handleReset = async () => {
        await window.api.auth.clearSSOConfig()
        form.resetFields()
        form.setFieldsValue({ region: 'us-east-1' })
        setStep('config'); setErrorMsg(''); setStatusMsg('')
        setAccessToken(''); setAccounts([]); setRoles([]); setSelectedAccount(null)
    }

    const stepIndex = {
        config: 0, authenticating: 1, account: 2, role: 3, completing: 4, success: 4, error: 0
    }[step] ?? 0

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div className="auth-bg" />

            <div className="titlebar" style={{ background: 'transparent', borderBottom: 'none' }}>
                <div style={{ flex: 1 }} />
                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12, opacity: 0.6 }}>Dynamore</Text>
                <div style={{ flex: 1 }} />
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1 }}>
                <div className="fade-in glass-card" style={{ width: '100%', maxWidth: 500, borderRadius: 24, padding: '48px 40px 40px', position: 'relative' }}>
                    {/* Top accent bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, var(--color-accent-blue), transparent)', borderRadius: '24px 24px 0 0' }} />

                    {/* Logo + Title */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 18, background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.2)', marginBottom: 16, boxShadow: '0 0 24px rgba(88, 166, 255, 0.15)' }}>
                            <AmazonOutlined style={{ fontSize: 30, color: 'var(--color-accent-blue)' }} />
                        </div>
                        <Title level={3} style={{ margin: 0, color: 'var(--color-text-primary)', fontWeight: 700 }}>
                            {step === 'account' ? 'Select Account' : step === 'role' ? 'Select Role' : 'AWS SSO Sign In'}
                        </Title>
                    </div>

                    {/* Progress Steps */}
                    <Steps
                        size="small"
                        current={stepIndex}
                        status={step === 'error' ? 'error' : step === 'success' ? 'finish' : 'process'}
                        style={{ marginBottom: 32 }}
                        items={[
                            { title: 'Connect' },
                            { title: 'Authorize', icon: step === 'authenticating' ? <LoadingOutlined /> : undefined },
                            { title: 'Account' },
                            { title: 'Role' },
                            { title: 'Done', icon: step === 'success' ? <CheckCircleOutlined /> : undefined }
                        ]}
                    />

                    {/* Error Alert */}
                    {step === 'error' && (
                        <Alert
                            type="error"
                            message="Login Failed"
                            description={errorMsg}
                            showIcon
                            style={{ marginBottom: 24, borderRadius: 12 }}
                            action={<Button size="small" onClick={handleReset}>Try Again</Button>}
                        />
                    )}

                    {/* ─── STEP: Config Form ─── */}
                    {(step === 'config' || step === 'error') && (
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleInitSSO}
                            initialValues={{ region: 'us-east-1' }}
                            requiredMark={false}
                            size="large"
                        >
                            <Form.Item
                                label="SSO Start URL"
                                name="startUrl"
                                rules={[
                                    { required: true, message: 'Please enter your SSO Start URL' },
                                    { type: 'url', message: 'Please enter a valid URL' }
                                ]}
                            >
                                <Input
                                    placeholder="https://d-xxxxxxxxxx.awsapps.com/start"
                                    spellCheck={false}
                                    autoComplete="off"
                                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                                />
                            </Form.Item>

                            <Form.Item
                                label="AWS Region"
                                name="region"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="Select a region"
                                    optionFilterProp="label"
                                    options={AWS_REGIONS}
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                                        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>

                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={{ height: 52, borderRadius: 14, fontWeight: 600, marginTop: 8, fontSize: 15 }}
                                icon={<ArrowRightOutlined />}
                                iconPosition="end"
                            >
                                Continue with SSO
                            </Button>
                            <Button type="text" block onClick={handleReset} style={{ color: 'var(--color-text-tertiary)', marginTop: 8 }}>
                                Reset
                            </Button>
                        </Form>
                    )}

                    {/* ─── STEP: Authenticating (browser + polling unified) ─── */}
                    {step === 'authenticating' && (
                        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                            {/* Animated ring */}
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
                                <LoadingOutlined style={{ fontSize: 56, color: 'var(--color-accent-blue)' }} />
                                <div style={{
                                    position: 'absolute', inset: -8,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(88,166,255,0.15)',
                                    animation: 'spin 3s linear infinite'
                                }} />
                            </div>

                            <Paragraph style={{ fontSize: 15, color: 'var(--color-text-primary)', margin: '0 0 8px', fontWeight: 500 }}>
                                {statusMsg || 'Opening your browser…'}
                            </Paragraph>
                            <Text style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                                Complete the sign-in in your browser and come back here.
                            </Text>

                            {/* Subtle instruction card */}
                            <div style={{
                                marginTop: 28,
                                padding: '12px 16px',
                                background: 'rgba(88,166,255,0.06)',
                                borderRadius: 12,
                                border: '1px solid rgba(88,166,255,0.15)',
                                textAlign: 'left'
                            }}>
                                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                                    1. A browser window should have opened automatically.<br />
                                    2. Sign in with your corporate credentials.<br />
                                    3. This screen will update once you've approved access.
                                </Text>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP: Account Selection ─── */}
                    {step === 'account' && (
                        <div>
                            {loading
                                ? <div style={{ textAlign: 'center', padding: 20 }}><LoadingOutlined style={{ fontSize: 32, color: 'var(--color-accent-blue)' }} /></div>
                                : (
                                    <List
                                        dataSource={accounts}
                                        style={{ maxHeight: 300, overflowY: 'auto' }}
                                        renderItem={(item) => (
                                            <List.Item
                                                onClick={() => handleSelectAccount(item)}
                                                className="sidebar-item"
                                                style={{ padding: '12px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 8, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}
                                            >
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.accountName}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{item.accountId}</div>
                                                </div>
                                                <RightOutlined style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                            </List.Item>
                                        )}
                                    />
                                )
                            }
                        </div>
                    )}

                    {/* ─── STEP: Role Selection ─── */}
                    {step === 'role' && (
                        <div>
                            {/* Selected account badge */}
                            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(88,166,255,0.06)', borderRadius: 10, border: '1px solid rgba(88,166,255,0.15)' }}>
                                <Text style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 2 }}>Account</Text>
                                <Text style={{ fontWeight: 600, display: 'block' }}>{selectedAccount?.accountName}</Text>
                                <Text style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{selectedAccount?.accountId}</Text>
                            </div>

                            {loading
                                ? <div style={{ textAlign: 'center', padding: 20 }}><LoadingOutlined style={{ fontSize: 32, color: 'var(--color-accent-blue)' }} /></div>
                                : (
                                    <List
                                        dataSource={roles}
                                        style={{ maxHeight: 240, overflowY: 'auto' }}
                                        renderItem={(item) => (
                                            <List.Item
                                                onClick={() => handleSelectRole(item)}
                                                className="sidebar-item"
                                                style={{ padding: '12px 16px', borderRadius: 10, cursor: 'pointer', marginBottom: 8, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12 }}
                                            >
                                                <Text style={{ fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>{item.roleName}</Text>
                                                <RightOutlined style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                            </List.Item>
                                        )}
                                    />
                                )
                            }
                            <Button type="link" onClick={() => setStep('account')} style={{ paddingLeft: 0, marginTop: 4 }}>
                                ← Back to accounts
                            </Button>
                        </div>
                    )}

                    {/* ─── STEP: Completing ─── */}
                    {step === 'completing' && (
                        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                            <LoadingOutlined style={{ fontSize: 48, color: 'var(--color-accent-blue)', marginBottom: 20 }} />
                            <Paragraph style={{ fontSize: 15, color: 'var(--color-text-primary)', margin: 0, fontWeight: 500 }}>
                                {statusMsg || 'Setting up your session…'}
                            </Paragraph>
                        </div>
                    )}

                    {/* ─── STEP: Success ─── */}
                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                            <CheckCircleOutlined style={{ fontSize: 60, color: 'var(--color-accent-green)', marginBottom: 20 }} />
                            <Title level={4} style={{ color: 'var(--color-text-primary)', margin: '0 0 8px' }}>You're in!</Title>
                            <Text style={{ color: 'var(--color-text-secondary)' }}>Loading your workspace…</Text>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
