import { useState, useEffect } from 'react'
import { Form, Input, Button, Typography, Space, Steps, Alert, Divider } from 'antd'
import { AmazonOutlined, LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'

const { Title, Text, Paragraph } = Typography

type LoginStep = 'form' | 'browser' | 'polling' | 'success' | 'error'

interface LoginFormValues {
    startUrl: string
    region: string
    accountId: string
    roleName: string
}

export default function LoginPage() {
    const [form] = Form.useForm<LoginFormValues>()
    const { setSession } = useAppStore()
    const [step, setStep] = useState<LoginStep>('form')
    const [progressMsg, setProgressMsg] = useState('')
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        const unsubscribe = window.api.auth.onLoginProgress((_event, msg) => {
            setProgressMsg(msg)
            if (msg.toLowerCase().includes('browser')) setStep('browser')
            else if (msg.toLowerCase().includes('waiting')) setStep('polling')
        })
        return unsubscribe
    }, [])

    const handleLogin = async (values: LoginFormValues) => {
        setStep('polling')
        setErrorMsg('')
        const res = await window.api.auth.startSSOLogin(values)
        if (res.success) {
            setStep('success')
            setTimeout(async () => {
                const session = await window.api.auth.getSession()
                setSession(session)
            }, 800)
        } else {
            setStep('error')
            setErrorMsg(res.error ?? 'Unknown error')
        }
    }

    const currentStepIndex = step === 'form' ? 0 : step === 'browser' ? 1 : step === 'polling' ? 2 : 3

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg)',
            overflow: 'hidden'
        }}>
            {/* Title bar */}
            <div className="titlebar">
                <div style={{ flex: 1 }} />
                <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>Dynamore</Text>
                <div style={{ flex: 1 }} />
            </div>

            {/* Login card */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24
            }}>
                <div className="fade-in" style={{
                    width: '100%',
                    maxWidth: 460,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '40px 40px 32px'
                }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #58a6ff22, #58a6ff44)',
                            border: '1px solid #58a6ff44',
                            marginBottom: 16
                        }}>
                            <AmazonOutlined style={{ fontSize: 26, color: '#58a6ff' }} />
                        </div>
                        <Title level={4} style={{ margin: 0, color: 'var(--color-text-primary)' }}>
                            Sign in to DynamoDB
                        </Title>
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                            via AWS Identity Center (SSO)
                        </Text>
                    </div>

                    {/* Progress steps */}
                    {step !== 'form' && (
                        <Steps
                            size="small"
                            current={currentStepIndex}
                            style={{ marginBottom: 24 }}
                            status={step === 'error' ? 'error' : step === 'success' ? 'finish' : 'process'}
                            items={[
                                { title: 'Configure' },
                                { title: 'Browser', icon: step === 'browser' ? <LoadingOutlined /> : undefined },
                                { title: 'Authorize', icon: step === 'polling' ? <LoadingOutlined /> : undefined },
                                { title: 'Done', icon: step === 'success' ? <CheckCircleOutlined /> : undefined }
                            ]}
                        />
                    )}

                    {step !== 'form' && step !== 'error' && (
                        <Paragraph style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: 13,
                            textAlign: 'center',
                            marginBottom: 20
                        }}>
                            {progressMsg || 'Processing…'}
                        </Paragraph>
                    )}

                    {step === 'error' && (
                        <Alert
                            type="error"
                            message={errorMsg}
                            showIcon
                            style={{ marginBottom: 20 }}
                            action={
                                <Button size="small" onClick={() => setStep('form')}>
                                    Retry
                                </Button>
                            }
                        />
                    )}

                    {(step === 'form' || step === 'error') && (
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleLogin}
                            initialValues={{ region: 'us-east-1', roleName: 'AdministratorAccess' }}
                            requiredMark={false}
                        >
                            <Form.Item
                                label="SSO Start URL"
                                name="startUrl"
                                rules={[{ required: true, message: 'Required' }, { type: 'url', message: 'Must be a valid URL' }]}
                            >
                                <Input
                                    placeholder="https://yourorg.awsapps.com/start"
                                    size="large"
                                />
                            </Form.Item>

                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item
                                    label="AWS Region"
                                    name="region"
                                    style={{ flex: 1, marginRight: 8 }}
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="us-east-1" size="large" />
                                </Form.Item>
                                <Form.Item
                                    label="Account ID"
                                    name="accountId"
                                    style={{ flex: 1 }}
                                    rules={[{ required: true }, { pattern: /^\d{12}$/, message: '12-digit ID' }]}
                                >
                                    <Input placeholder="123456789012" size="large" />
                                </Form.Item>
                            </Space.Compact>

                            <Form.Item
                                label="IAM Role Name"
                                name="roleName"
                                rules={[{ required: true }]}
                            >
                                <Input placeholder="AdministratorAccess" size="large" />
                            </Form.Item>

                            <Divider style={{ borderColor: 'var(--color-border)', margin: '16px 0' }} />

                            <Button
                                type="primary"
                                htmlType="submit"
                                size="large"
                                block
                                style={{ height: 44 }}
                            >
                                Continue with SSO →
                            </Button>
                        </Form>
                    )}
                </div>
            </div>
        </div>
    )
}
