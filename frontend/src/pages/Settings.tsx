import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Monitor, Bell, Eye, PhoneOff, Globe, Upload } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Settings = () => {
    const { refreshLanguages, t } = useLanguage();
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
            alert(t('error_save_settings'));
        } finally {
            setLoading(false);
        }
    };

    const [uploadingLang, setUploadingLang] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploadingLang(true);
        try {
            await api.post('/languages/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(t('upload_lang_success'));
            await refreshLanguages();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            alert(t('upload_lang_error'));
        } finally {
            setUploadingLang(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
                    <SettingsIcon size={32} color="#3b82f6" />
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('settings_title')}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('settings_subtitle')}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Camera Source */}
                    <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'white' }}>
                            <Monitor size={20} color="#3b82f6" /> {t('camera_source')}
                        </label>
                        <input
                            type="text"
                            value={settings.camera_src}
                            onChange={(e) => setSettings({ ...settings, camera_src: e.target.value })}
                            style={{ width: '100%', padding: '12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                            placeholder={t('camera_placeholder')}
                        />
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                            {t('camera_source_hint')}
                        </div>
                    </div>

                    {/* RTSP Camera URL */}
                    <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'white' }}>
                            <Monitor size={20} color="#10b981" /> {t('rtsp_camera_url')}
                        </label>
                        <input
                            type="text"
                            value={settings.rtsp_url || ''}
                            onChange={(e) => setSettings({ ...settings, rtsp_url: e.target.value })}
                            style={{ width: '100%', padding: '12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                            placeholder={t('rtsp_placeholder')}
                        />
                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                            {t('rtsp_hint')}
                        </div>
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Eye size={24} color="#3b82f6" />
                                <div>
                                    <div style={{ fontWeight: 600 }}>{t('show_age_gender')}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('show_on_camera')}</div>
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
                                    <div style={{ fontWeight: 600 }}>{t('phone_detection')}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('detect_violation')}</div>
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
                                    <div style={{ fontWeight: 600 }}>{t('alarm')}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('on_incident')}</div>
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

                    {/* Language Management */}
                    <div style={{ background: '#0f172a', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'white' }}>
                            <Globe size={20} color="#3b82f6" /> {t('upload_language')} (XML)
                        </label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="file"
                                accept=".xml"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingLang}
                                style={{
                                    padding: '10px 20px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 600
                                }}
                            >

                                <Upload size={18} />
                                {uploadingLang ? t('uploading') : t('upload_language')}
                            </button>
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                {t('upload_language_format')}
                            </span>
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
                        {saveSuccess ? t('save_settings_success') : t('save_all_changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
