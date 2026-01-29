import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Shield, Clock, History, ChevronDown, ChevronRight, ListChecks, Calculator } from 'lucide-react';

interface User {
    username: string;
    role: string;
}

interface LayoutProps {
    children: ReactNode;
    currentUser: User | null;
}

interface NavItem {
    path?: string;
    label: string;
    icon: any;
    adminOnly: boolean;
    children?: NavItem[];
}

function Layout({ children, currentUser }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['employees']);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    };

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const navItems: NavItem[] = [
        { path: '/', label: 'Tổng quan', icon: LayoutDashboard, adminOnly: false },
        {
            label: 'Quản lý nhân viên',
            icon: Users,
            adminOnly: true,
            children: [
                { path: '/employees', label: 'Danh sách nhân viên', icon: ListChecks, adminOnly: true },
                { path: '/presence-logs', label: 'Lịch sử ra vào', icon: History, adminOnly: false },
                { path: '/attendance-calculator', label: 'Tính toán chấm công', icon: Calculator, adminOnly: true },
            ]
        },
        { path: '/shift-configs', label: 'Quản lý ca làm việc', icon: Clock, adminOnly: true },
        { path: '/users', label: 'Tài khoản hệ thống', icon: Shield, adminOnly: true },
        { path: '/settings', label: 'Cài đặt hệ thống', icon: Settings, adminOnly: true },
    ];

    const filterNavItems = (items: NavItem[]): NavItem[] => {
        return items.filter(item => {
            if (item.adminOnly && currentUser?.role !== 'admin') return false;
            if (item.children) {
                item.children = filterNavItems(item.children);
            }
            return true;
        });
    };

    const filteredNavItems = filterNavItems(navItems);

    const renderNavItem = (item: NavItem, isChild: boolean = false) => {
        const Icon = item.icon;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedMenus.includes(item.label);
        const isActive = item.path ? location.pathname === item.path : false;
        const isParentActive = item.children?.some(child => child.path === location.pathname);

        if (hasChildren) {
            return (
                <div key={item.label}>
                    <div
                        onClick={() => toggleMenu(item.label)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            padding: '12px 16px',
                            margin: '4px 0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            color: isParentActive ? '#3b82f6' : '#94a3b8',
                            background: isParentActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            fontWeight: isParentActive ? 600 : 400,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (!isParentActive) {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                                e.currentTarget.style.color = 'white';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isParentActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#94a3b8';
                            }
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Icon size={20} />
                            {item.label}
                        </div>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    {isExpanded && item.children && (
                        <div style={{ marginLeft: '12px', borderLeft: '2px solid #334155', paddingLeft: '8px' }}>
                            {item.children.map(child => renderNavItem(child, true))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div
                key={item.path}
                onClick={() => item.path && navigate(item.path)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: isChild ? '10px 16px' : '12px 16px',
                    margin: '4px 0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: isActive ? '#3b82f6' : '#94a3b8',
                    background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: isChild ? '0.9rem' : '1rem',
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
                <Icon size={isChild ? 18 : 20} />
                {item.label}
            </div>
        );
    };

    const getPageTitle = () => {
        for (const item of filteredNavItems) {
            if (item.path === location.pathname) return item.label;
            if (item.children) {
                const child = item.children.find(c => c.path === location.pathname);
                if (child) return child.label;
            }
        }
        return 'SmartCore';
    };

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

                <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
                    {filteredNavItems.map(item => renderNavItem(item))}
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
                        {getPageTitle()}
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
