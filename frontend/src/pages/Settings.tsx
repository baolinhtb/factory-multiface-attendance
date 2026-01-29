import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Monitor, Bell, Eye, PhoneOff } from 'lucide-react';

const Settings = () => {
    const [settings, setSettings] = useState<any>({
        camera_src: '0',
        show_age_gender: 'true',
        enable_alarm: 'true',
        enable_phone_det: 'true'
    });
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fetchData = async () => {
        try {
            const res = await api.get('/settings');
            setSettings(res.data);
        } catch (e) { }
    };

    useEffect(() => {
        fetchData();
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

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
                    <SettingsIcon size={32} color="#3b82f6" />
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Cấu hình hệ thống</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Quản lý các thiết lập chung của AI và phần cứng</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Camera Source */}
                    <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'white' }}>
                            <Monitor size={20} color="#3b82f6" /> Nguồn video (Camera ID hoặc URL)
                        </label>
                        <input
                            type="text"
                            value={settings.camera_src}
                            onChange={(e) => setSettings({ ...settings, camera_src: e.target.value })}
                            style={{ width: '100%', padding: '12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                            placeholder="Ví dụ: 0, 1 hoặc rtsp://..."
                        />
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Eye size={24} color="#3b82f6" />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Tuổi & Giới tính</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Hiển thị trên camera</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.show_age_gender === 'true'}
                                onChange={(e) => setSettings({ ...settings, show_age_gender: e.target.checked ? 'true' : 'false' })}
                                style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                            />
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <PhoneOff size={24} color="#f59e0b" />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Sử dụng điện thoại</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Phát hiện vi phạm</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enable_phone_det === 'true'}
                                onChange={(e) => setSettings({ ...settings, enable_phone_det: e.target.checked ? 'true' : 'false' })}
                                style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                            />
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Bell size={24} color="#ef4444" />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Chuông báo động</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Khi có sự cố</div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.enable_alarm === 'true'}
                                onChange={(e) => setSettings({ ...settings, enable_alarm: e.target.checked ? 'true' : 'false' })}
                                style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={loading}
                        style={{
                            marginTop: '20px',
                            padding: '15px',
                            background: saveSuccess ? '#10b981' : '#3b82f6',
                            color: 'white',
                            fontWeight: 700,
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Save size={20} />
                        {saveSuccess ? 'Đã lưu thiết lập!' : 'Lưu tất cả thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
