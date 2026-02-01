import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Shield, Clock, History, ChevronDown, ChevronRight, ListChecks, Calculator, Menu, Globe, Lock, MessageSquare, Camera } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import { useLanguage } from '../contexts/LanguageContext';

interface User {
    id?: number;
    username: string;
    role: string;
}

interface LayoutProps {
    children: ReactNode;
    currentUser: User | null;
}

interface NavItem {
    id: string;
    path?: string;
    label: string;
    icon: any;
    adminOnly: boolean;
    children?: NavItem[];
}

function Layout({ children, currentUser }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language, setLanguage, availableLanguages } = useLanguage();
    // Default expanded based on translations or fixed? 
    // Usually expanded state logic is independent, but keys change.
    // Let's keep it simple for now, using translated strings as keys could be tricky if they change.
    // Better to use static keys for expansion or just rely on 'label' which is now translated.
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['employees', 'settings_menu']);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChangePassOpen, setIsChangePassOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
    };

    const toggleMenu = (id: string) => {
        setExpandedMenus(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const navItems = [
        { id: 'dashboard', path: '/', label: t('dashboard'), icon: LayoutDashboard, adminOnly: false },
        {
            id: 'employees',
            label: t('employee_management'),
            icon: Users,
            adminOnly: true,
            children: [
                { id: 'emp_list', path: '/employees', label: t('employee_list'), icon: ListChecks, adminOnly: true },
                { id: 'attendance_hist', path: '/presence-logs', label: t('attendance_history'), icon: History, adminOnly: false },
                { id: 'calc', path: '/attendance-calculator', label: t('attendance_calculator'), icon: Calculator, adminOnly: true },
            ]
        },
        { id: 'chat', path: '/ollama-chat', label: t('ai_assistant') || 'AI Assistant', icon: MessageSquare, adminOnly: false },
        {
            id: 'settings_menu',
            label: t('system_settings'),
            icon: Settings,
            adminOnly: true,
            children: [
                { id: 'settings_gen', path: '/settings', label: t('general_settings'), icon: Settings, adminOnly: true },
                { id: 'cameras', path: '/cameras', label: t('camera_management') || 'Quản lý Camera', icon: Camera, adminOnly: true },
                { id: 'shifts', path: '/shift-configs', label: t('shift_management'), icon: Clock, adminOnly: true },
                { id: 'users', path: '/users', label: t('user_management'), icon: Shield, adminOnly: true },
            ]
        },
    ];

    const filterNavItems = (items: any[]): any[] => {
        return items
            .filter(item => !item.adminOnly || currentUser?.role === 'admin')
            .map(item => {
                if (item.children) {
                    return { ...item, children: filterNavItems(item.children) };
                }
                return item;
            });
    };

    const filteredNavItems = filterNavItems(navItems);

    const renderNavItem = (item: NavItem, isChild: boolean = false) => {
        const Icon = item.icon;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedMenus.includes(item.id);
        const isActive = item.path ? location.pathname === item.path : false;
        const isParentActive = item.children?.some(child => child.path === location.pathname);

        if (hasChildren) {
            return (
                <div key={item.id}>
                    <div
                        onClick={() => toggleMenu(item.id)}
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
                onClick={() => {
                    if (item.path) {
                        navigate(item.path);
                        setIsSidebarOpen(false); // Close sidebar on navigate
                    }
                }}
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
                const child = item.children.find((c: any) => c.path === location.pathname);
                if (child) return child.label;
            }
        }
        return 'SmartCore';
    };

    return (
        <div style={{ display: 'flex', height: '100vh', position: 'relative' }}>
            {/* Mobile Overlay */}
            <div
                className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div style={{
                    padding: '24px',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: 'var(--bg-card)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Shield size={28} color="#3b82f6" />
                        SmartCore
                    </div>
                    {/* Close button for mobile inside sidebar */}
                    <div className="sidebar-toggle" onClick={() => setIsSidebarOpen(false)}>
                        <Menu size={20} />
                    </div>
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
                                {currentUser?.role === 'admin' ? t('admin_role') : t('user_role')}
                            </div>
                        </div>
                    </div>

                    {/* Language Selector */}
                    <div style={{ marginBottom: '12px' }}>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: '#1e293b',
                                color: '#cbd5e1',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                outline: 'none',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {availableLanguages.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {t(`language_${lang.code}`) || lang.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setIsChangePassOpen(true)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            marginBottom: '8px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        }}
                    >
                        <Lock size={16} />
                        {t('change_password')}
                    </button>
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
                        {t('logout')}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-dark)' }}>
                <header style={{
                    height: '64px',
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px'
                }} className="header-content">
                    <button
                        className="sidebar-toggle"
                        onClick={() => setIsSidebarOpen(true)}
                        style={{ marginRight: '15px', background: 'transparent' }}
                    >
                        <Menu size={24} color="white" />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                        {getPageTitle()}
                    </h2>
                </header>
                <div style={{
                    flex: 1,
                    overflowY: location.pathname === '/ollama-chat' ? 'hidden' : 'auto',
                    padding: location.pathname === '/ollama-chat' ? 0 : '24px',
                    position: 'relative'
                }} className="main-content">
                    {children}
                </div>
            </div>
            <ChangePasswordModal
                isOpen={isChangePassOpen}
                onClose={() => setIsChangePassOpen(false)}
                userId={currentUser?.id || 0}
            />
        </div>
    );
}

export default Layout;
