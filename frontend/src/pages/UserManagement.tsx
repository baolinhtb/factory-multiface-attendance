import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Trash2, UserCog, User, Shield, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const UserManagement = () => {
    const { t } = useLanguage();
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
            alert(err.response?.data?.detail || t('error_add_user'));
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm(t('delete_user_confirm'))) return;
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
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('user_management_title')}</h3>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                            <th style={{ padding: '12px 10px' }}>{t('user_account')}</th>
                            <th style={{ padding: '12px 10px' }}>{t('permissions')}</th>
                            <th style={{ padding: '12px 10px', textAlign: 'right' }}>{t('actions')}</th>
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
                                        {u.role === 'admin' ? t('admin_role') : t('user_role')}
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
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('add_account_title')}</h3>
                </div>

                <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('username')}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('role')}</label>
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
                            <option value="user">{t('role_user_desc')}</option>
                            <option value="admin">{t('role_admin_desc')}</option>
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
                        {loading ? t('creating') : t('create_btn')}
                    </button>
                </form>

                <div style={{ marginTop: '20px', padding: '12px', background: '#3b82f610', borderRadius: '8px', display: 'flex', gap: '10px' }}>
                    <Info size={18} color="#3b82f6" />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('note_user_create')}</p>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
