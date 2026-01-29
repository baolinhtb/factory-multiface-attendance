import React, { useState } from 'react';
import api from '../services/api';
import { Lock, User, ShieldCheck } from 'lucide-react';

interface LoginProps {
    onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await api.post('/login', formData);
            localStorage.setItem('token', response.data.access_token);
            localStorage.setItem('user', JSON.stringify({
                username: username,
                role: response.data.role
            }));
            onLoginSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Lỗi đăng nhập');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
        }}>
            <div style={{
                maxWidth: '400px',
                width: '90%',
                background: '#1e293b',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid #334155'
            }} className="mobile-padding">
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{
                        background: '#3b82f620',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 15px'
                    }}>
                        <ShieldCheck size={32} color="#3b82f6" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Hệ Thống SmartCore</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '5px' }}>Đăng nhập để quản lý giám sát</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#cbd5e1' }}>Tên đăng nhập</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#475569' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{ width: '100%', paddingLeft: '40px' }}
                                placeholder="admin"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#cbd5e1' }}>Mật khẩu</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '11px', color: '#475569' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', paddingLeft: '40px' }}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#3b82f6',
                            color: 'white',
                            fontSize: '1rem',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Đang xác thực...' : 'Đăng Nhập'}
                    </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                    Tài khoản mặc định: admin / admin123
                </div>
            </div>
        </div>
    );
};

export default Login;
