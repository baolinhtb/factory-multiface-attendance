import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Monitor, Bell, Eye, PhoneOff, UserPlus, FileImage, RefreshCw } from 'lucide-react';

const Settings = () => {
    const [settings, setSettings] = useState<any>({
        camera_src: '0',
        show_age_gender: 'true',
        enable_alarm: 'true',
        enable_phone_det: 'true'
    });
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // For person registration
    const [regName, setRegName] = useState('');
    const [regFile, setRegFile] = useState<File | null>(null);
    const [regLoading, setRegLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                setSettings(res.data);
            } catch (e) { }
        };
        fetchSettings();
    }, []);

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            await api.put('/settings', settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            alert('Lỗi khi lưu cài đặt');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regFile || !regName) return;
        setRegLoading(true);

        const formData = new FormData();
        formData.append('name', regName);
        formData.append('file', regFile);

        try {
            await api.post('/register', formData);
            alert('Đăng ký nhận diện thành công!');
            setRegName('');
            setRegFile(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi đăng ký');
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* Left: System Config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                        <SettingsIcon size={24} color="#3b82f6" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Cấu hình AI & Hệ thống</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Camera Source */}
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', marginBottom: '8px', color: '#94a3b8' }}>
                                <Monitor size={16} /> Nguồn video (Camera ID hoặc RTSP)
                            </label>
                            <input
                                type="text"
                                value={settings.camera_src}
                                onChange={(e) => setSettings({ ...settings, camera_src: e.target.value })}
                                style={{ width: '100%' }}
                                placeholder="0 hoặc link RTSP"
                            />
                        </div>

                        {/* Toggles */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Eye size={18} color="#3b82f6" />
                                    <span>Hiển thị tuổi & giới tính</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.show_age_gender === 'true'}
                                    onChange={(e) => setSettings({ ...settings, show_age_gender: e.target.checked ? 'true' : 'false' })}
                                    style={{ width: '20px', height: '20px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <PhoneOff size={18} color="#f59e0b" />
                                    <span>Kích hoạt phát hiện điện thoại</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.enable_phone_det === 'true'}
                                    onChange={(e) => setSettings({ ...settings, enable_phone_det: e.target.checked ? 'true' : 'false' })}
                                    style={{ width: '20px', height: '20px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Bell size={18} color="#ef4444" />
                                    <span>Chuông báo khi có vi phạm</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.enable_alarm === 'true'}
                                    onChange={(e) => setSettings({ ...settings, enable_alarm: e.target.checked ? 'true' : 'false' })}
                                    style={{ width: '20px', height: '20px' }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveSettings}
                            disabled={loading}
                            style={{
                                marginTop: '10px',
                                padding: '12px',
                                background: saveSuccess ? '#10b981' : '#3b82f6',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                            {saveSuccess ? 'Đã Lưu Thành Công' : 'Lưu Cấu Hình'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Face Registration */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155',
                height: 'fit-content'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }}>
                    <UserPlus size={24} color="#10b981" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Đăng ký khuôn mặt mới</h3>
                </div>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#94a3b8' }}>Họ và tên nhân viên</label>
                        <input
                            type="text"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            style={{ width: '100%' }}
                            placeholder="Nguyễn Văn A"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '8px', color: '#94a3b8' }}>Ảnh chân dung (Rõ mặt)</label>
                        <div style={{
                            border: '2px dashed #334155',
                            padding: '20px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            position: 'relative'
                        }}>
                            <FileImage size={32} color="#475569" style={{ marginBottom: '10px' }} />
                            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Click để tải ảnh lên ({regFile?.name || 'Chưa chọn file'})</p>
                            <input
                                type="file"
                                onChange={(e) => setRegFile(e.target.files?.[0] || null)}
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0,
                                    width: '100%', height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer'
                                }}
                                accept="image/*"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={regLoading}
                        style={{
                            padding: '12px',
                            background: '#10b981',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        {regLoading ? 'Đang xử lý...' : 'Thêm Vào Danh Sách'}
                    </button>
                </form>
            </div>

            <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

export default Settings;
