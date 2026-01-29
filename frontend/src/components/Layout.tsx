import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Shield, Clock, History } from 'lucide-react';

interface User {
    username: string;
    role: string;
}

interface LayoutProps {
    children: ReactNode;
    currentUser: User | null;
}

function Layout({ children, currentUser }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    };

    const navItems = [
        { path: '/', label: 'Tổng quan', icon: LayoutDashboard, adminOnly: false },
        { path: '/presence-logs', label: 'Lịch sử ra vào', icon: History, adminOnly: false },
        { path: '/employees', label: 'Quản lý nhân viên', icon: Users, adminOnly: true },
        { path: '/shift-configs', label: 'Quản lý ca làm việc', icon: Clock, adminOnly: true },
        { path: '/users', label: 'Tài khoản hệ thống', icon: Shield, adminOnly: true },
        { path: '/settings', label: 'Cài đặt hệ thống', icon: Settings, adminOnly: true },
    ];

    const filteredNavItems = navItems.filter(
        (item) => !item.adminOnly || currentUser?.role === 'admin'
    );

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                background: '#1e293b',
                borderRight: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{
                    padding: '24px',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <Shield size={28} color="#3b82f6" />
                    SmartCore
                </div>

                <nav style={{ flex: 1, padding: '10px' }}>
                    {filteredNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <div
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    margin: '4px 0',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: isActive ? '#3b82f6' : '#94a3b8',
                                    background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                        e.currentTarget.style.color = 'white';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#94a3b8';
                                    }
                                }}
                            >
                                <Icon size={20} />
                                {item.label}
                            </div>
                        );
                    })}
                </nav>

                <div style={{ padding: '20px', borderTop: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: '#3b82f6',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.8rem'
                        }}>
                            {currentUser?.username?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{currentUser?.username}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                {currentUser?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        }}
                    >
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <header style={{
                    height: '64px',
                    background: '#1e293b',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 30px'
                }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                        {filteredNavItems.find(item => item.path === location.pathname)?.label || 'SmartCore'}
                    </h2>
                </header>
                <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default Layout;
