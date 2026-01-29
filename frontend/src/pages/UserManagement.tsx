import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Trash2, UserCog, User, Shield, Info } from 'lucide-react';

const UserManagement = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) { }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('role', role);

        try {
            await api.post('/users', formData);
            setUsername('');
            setPassword('');
            fetchUsers();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi khi thêm người dùng');
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
        } catch (e) { }
    };

    return (
        <div className="grid-dashboard">
            {/* Left: User List */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <UserCog size={24} color="#3b82f6" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Của nhân viên hệ thống</h3>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                            <th style={{ padding: '12px 10px' }}>Tài khoản</th>
                            <th style={{ padding: '12px 10px' }}>Quyền hạn</th>
                            <th style={{ padding: '12px 10px', textAlign: 'right' }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #334155' }}>
                                <td style={{ padding: '15px 10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.role === 'admin' ? '#3b82f620' : '#47556920', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={16} color={u.role === 'admin' ? '#3b82f6' : '#94a3b8'} />
                                        </div>
                                        {u.username}
                                    </div>
                                </td>
                                <td style={{ padding: '15px 10px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        background: u.role === 'admin' ? '#3b82f6' : '#475569',
                                        color: 'white'
                                    }}>
                                        {u.role === 'admin' ? 'Quản trị' : 'Thường'}
                                    </span>
                                </td>
                                <td style={{ padding: '15px 10px', textAlign: 'right' }}>
                                    {u.username !== 'admin' && (
                                        <button onClick={() => deleteUser(u.id)} style={{ padding: '6px', color: '#ef4444', background: 'transparent' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Right: Add User Form */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155',
                height: 'fit-content'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <UserPlus size={24} color="#10b981" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Thêm tài khoản mới</h3>
                </div>

                <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Tên đăng nhập</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Mật khẩu</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Phân quyền</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#0f172a',
                                color: 'white',
                                border: '1px solid #334155',
                                borderRadius: '6px'
                            }}
                        >
                            <option value="user">Người dùng thông thường</option>
                            <option value="admin">Quản trị viên (Toàn quyền)</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '10px',
                            padding: '12px',
                            background: '#3b82f6',
                            color: 'white',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                    </button>
                </form>

                <div style={{ marginTop: '20px', padding: '12px', background: '#3b82f610', borderRadius: '8px', display: 'flex', gap: '10px' }}>
                    <Info size={18} color="#3b82f6" />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mọi tài khoản mới được tạo sẽ có quyền truy cập dashboard và lịch sử nhưng chỉ Admin mới có quyền cấu hình hệ thống.</p>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
