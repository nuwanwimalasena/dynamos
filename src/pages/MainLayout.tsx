import { useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Typography, Button, Tooltip, App as AntApp } from 'antd'
import { LogoutOutlined, CloudServerOutlined } from '@ant-design/icons'
import { useAppStore } from '../store/appStore'
import Sidebar from '../components/Sidebar'
import TableDetailPage from './TableDetailPage'

const { Text } = Typography

export default function MainLayout() {
    const { session, setSession, setTableNames } = useAppStore()
    const { message } = AntApp.useApp()

    const handleLogout = useCallback(async () => {
        await window.api.auth.logout()
        setSession(null)
        setTableNames([])
    }, [setSession, setTableNames])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        if (session) {
            // Auto-logout ~1 min before credentials expire
            // credentials expire in ~1 hour for STS tokens
            timer = setTimeout(() => {
                message.warning('Session expired – please log in again')
                handleLogout()
            }, 55 * 60 * 1000)
        }
        return () => clearTimeout(timer)
    }, [session, handleLogout, message])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Titlebar */}
            <div className="titlebar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 80 }}>
                    <CloudServerOutlined style={{ color: 'var(--color-accent-blue)', fontSize: 16 }} />
                    <Text style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: 13 }}>
                        Dynamore
                    </Text>
                </div>

                <div style={{ flex: 1 }} />

                {session && (
                    <div className="titlebar-nodrag" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
                        <Text style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {session.accountId} / {session.roleName} / {session.region}
                        </Text>
                        <Tooltip title="Log out">
                            <Button
                                type="text"
                                size="small"
                                icon={<LogoutOutlined />}
                                onClick={handleLogout}
                                style={{ color: 'var(--color-text-secondary)' }}
                            />
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="app-layout">
                <Sidebar />
                <div className="main-content">
                    <Routes>
                        <Route path="/tables" element={<TableDetailPage />} />
                        <Route path="*" element={<Navigate to="/tables" replace />} />
                    </Routes>
                </div>
            </div>
        </div>
    )
}
