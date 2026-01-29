import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    username?: string; // For display "Change password for admin"
    requireCurrentPassword?: boolean;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, userId, username, requireCurrentPassword = true }) => {
    const { t } = useLanguage();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError(t('password_mismatch'));
            return;
        }

        setLoading(true);
        try {
            let targetId = userId;
            // Try to recover ID if missing
            if (!targetId || targetId === 0) {
                try {
                    console.log("ChangePassword: User ID missing, attempting to fetch from /me");
                    const meRes = await api.get('/me');
                    if (meRes.data?.id) {
                        targetId = meRes.data.id;
                    }
                } catch (e) {
                    console.warn("ChangePassword: Failed to recover User ID:", e);
                }
            }

            if (!targetId) {
                throw new Error(t('session_expired'));
            }

            await api.put(`/users/${targetId}/password`, {
                new_password: newPassword,
                current_password: requireCurrentPassword ? currentPassword : undefined
            });
            alert(t('password_changed_success'));
            handleClose();
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || t('error_change_password');

            // Avoid console.error for expected session issues
            if (msg === t('session_expired')) {
                console.warn("ChangePassword: " + msg);
            } else {
                console.error(err);
            }

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0, // top:0, left:0, right:0, bottom:0
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
        }}>
            <div style={{
                backgroundColor: '#1e293b', // bg-card
                padding: '24px',
                borderRadius: '12px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid #334155'
            }}>
                <h2 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    marginBottom: '16px',
                    color: 'white'
                }}>
                    {username
                        ? `${t('change_password_title')} ${username}`
                        : t('change_own_password_title')
                    }
                </h2>

                {error && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    {requireCurrentPassword && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: '#cbd5e1' }}>
                                {t('current_password')}
                            </label>
                            <input
                                type="password"
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #334155',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    outline: 'none'
                                }}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: '#cbd5e1' }}>
                            {t('new_password')}
                        </label>
                        <input
                            type="password"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #334155',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                outline: 'none'
                            }}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: '#cbd5e1' }}>
                            {t('confirm_password')}
                        </label>
                        <input
                            type="password"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #334155',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                outline: 'none'
                            }}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleClose}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '6px',
                                border: '1px solid #334155',
                                backgroundColor: 'transparent',
                                color: '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#334155'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                fontWeight: 500
                            }}
                        >
                            {loading ? t('saving') : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
