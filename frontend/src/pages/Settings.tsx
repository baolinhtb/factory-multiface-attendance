import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Monitor, Bell, Eye, PhoneOff, Globe, Upload, Flame, Brain, RotateCcw, User, Activity, RefreshCw, Camera, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Settings = () => {
    const navigate = useNavigate();
    const { refreshLanguages, t } = useLanguage();
    const [settings, setSettings] = useState<any>({
        camera_type: 'usb',
        camera_src: '0',
        rtsp_url: '',
        show_age_gender: 'true',
        enable_alarm: 'true',
        enable_phone_det: 'true',
        enable_fire_det: 'true',
        enable_pose_det: 'true',
        enable_fall_det: 'false',
        face_recognition_threshold: '0.45',
        phone_detection_confidence: '0.15',
        fire_detection_confidence: '0.30',
        pose_detection_confidence: '0.50',
        // Ollama settings
        ollama_base_url: 'http://localhost:11434',
        ollama_model_name: 'qwen2.5-vl:7b-instruct-q4_K_M',
        ollama_timeout: '120',
        ollama_enabled: 'true'
    });
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>([]);
    const [availableCameras, setAvailableCameras] = useState<any[]>([]);
    const [scanningCameras, setScanningCameras] = useState(false);

    const handleScanCameras = async () => {
        setScanningCameras(true);
        try {
            const res = await api.get('/cameras');
            setAvailableCameras(res.data);
            if (res.data.length === 0) {
                alert("No cameras found. Please check connections.");
            }
        } catch (e) {
            console.error("Error scanning cameras", e);
            alert("Failed to scan cameras");
        } finally {
            setScanningCameras(false);
        }
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

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
            alert(t('error_save_settings') || 'Error saving settings');
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
            alert(t('upload_lang_success') || 'Language uploaded successfully');
            await refreshLanguages();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            alert(t('upload_lang_error') || 'Error uploading language');
        } finally {
            setUploadingLang(false);
        }
    };

    return (
        <div style={{ maxWidth: '800px' }}>
            <div style={{ padding: '30px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
                    <SettingsIcon size={32} color="#3b82f6" />
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('settings_title')}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('settings_subtitle')}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* 1. Camera Config Section */}
                    <div style={{ borderBottom: '1px solid #334155', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleSection('camera')}
                            style={{
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: expandedSections.includes('camera') ? '#1e293b' : 'transparent',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Camera size={20} color="#3b82f6" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{t('camera_settings') || 'Camera Settings'}</span>
                            </div>
                            <div style={{
                                transform: expandedSections.includes('camera') ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s',
                                color: '#94a3b8'
                            }}>
                                <SettingsIcon size={18} />
                            </div>
                        </div>

                        {expandedSections.includes('camera') && (
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b' }}>
                                <div style={{
                                    padding: '24px',
                                    background: 'rgba(59, 130, 246, 0.05)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px'
                                }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                                        <div style={{ padding: '10px', background: '#3b82f620', borderRadius: '12px' }}>
                                            <Camera size={24} color="#3b82f6" />
                                        </div>
                                        <div>
                                            <h4 style={{ fontWeight: 700, marginBottom: '5px' }}>{t('multi_camera_management') || 'Multi-Camera Management'}</h4>
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>
                                                {t('camera_settings_moved_desc') || 'Settings for camera sources (USB, RTSP) have been moved to a dedicated management page to support multiple cameras simultaneously.'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate('/cameras')}
                                        style={{
                                            padding: '12px',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t('go_to_camera_management') || 'Go to Camera Management'}
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. General Preferences */}
                    <div style={{ borderBottom: '1px solid #334155', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleSection('general')}
                            style={{
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: expandedSections.includes('general') ? '#1e293b' : 'transparent',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <SettingsIcon size={20} color="#a78bfa" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{t('general_settings') || 'General Settings'}</span>
                            </div>
                            <div style={{
                                transform: expandedSections.includes('general') ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s',
                                color: '#94a3b8'
                            }}>
                                <SettingsIcon size={18} />
                            </div>
                        </div>

                        {expandedSections.includes('general') && (
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{t('show_age_gender')}</span>
                                            <input type="checkbox" checked={settings.show_age_gender === 'true'} onChange={(e) => setSettings({ ...settings, show_age_gender: e.target.checked ? 'true' : 'false' })} style={{ width: '18px', height: '18px' }} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{t('alarm')}</span>
                                            <input type="checkbox" checked={settings.enable_alarm === 'true'} onChange={(e) => setSettings({ ...settings, enable_alarm: e.target.checked ? 'true' : 'false' })} style={{ width: '18px', height: '18px' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Ollama AI Configuration */}
                    <div style={{ borderBottom: '1px solid #334155', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleSection('ollama')}
                            style={{
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: expandedSections.includes('ollama') ? '#1e293b' : 'transparent',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Brain size={20} color="#a78bfa" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>Ollama AI Configuration</span>
                            </div>
                            <div style={{
                                transform: expandedSections.includes('ollama') ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s',
                                color: '#94a3b8'
                            }}>
                                <SettingsIcon size={18} />
                            </div>
                        </div>

                        {expandedSections.includes('ollama') && (
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '0.9rem' }}>Enable Ollama AI</span>
                                        <input type="checkbox" checked={settings.ollama_enabled === 'true'} onChange={(e) => setSettings({ ...settings, ollama_enabled: e.target.checked ? 'true' : 'false' })} style={{ width: '18px', height: '18px' }} />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Ollama Server URL</label>
                                        <input
                                            type="text"
                                            value={settings.ollama_base_url || ''}
                                            onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                                            placeholder="http://localhost:11434"
                                            style={{
                                                padding: '10px',
                                                background: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '8px',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Model Name</label>
                                        <input
                                            type="text"
                                            value={settings.ollama_model_name || ''}
                                            onChange={(e) => setSettings({ ...settings, ollama_model_name: e.target.value })}
                                            placeholder="qwen2.5-vl:7b-instruct-q4_K_M"
                                            style={{
                                                padding: '10px',
                                                background: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '8px',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Request Timeout (seconds)</label>
                                            <span style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: 600 }}>{settings.ollama_timeout}s</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="30"
                                            max="300"
                                            step="10"
                                            value={settings.ollama_timeout || '120'}
                                            onChange={(e) => setSettings({ ...settings, ollama_timeout: e.target.value })}
                                            style={{ width: '100%', accentColor: '#a78bfa' }}
                                        />
                                    </div>

                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await api.post('/api/ollama/reload');
                                                alert(`Configuration reloaded!\nStatus: ${res.data.connection_status}\nModel: ${res.data.model}`);
                                            } catch (error: any) {
                                                alert(`Failed to reload: ${error.response?.data?.detail || error.message}`);
                                            }
                                        }}
                                        style={{
                                            padding: '10px',
                                            background: '#6366f1',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <RefreshCw size={16} /> Test & Reload Configuration
                                    </button>

                                    <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '10px', background: '#1e293b', borderRadius: '6px', borderLeft: '3px solid #a78bfa' }}>
                                        <strong>Note:</strong> Make sure Ollama is installed and running with the specified model before enabling this feature.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Language Section */}
                    <div style={{ borderBottom: '1px solid #334155', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleSection('lang')}
                            style={{
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: expandedSections.includes('lang') ? '#1e293b' : 'transparent',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Globe size={20} color="#3b82f6" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{t('upload_language')}</span>
                            </div>
                            <div style={{
                                transform: expandedSections.includes('lang') ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s',
                                color: '#94a3b8'
                            }}>
                                <SettingsIcon size={18} />
                            </div>
                        </div>

                        {expandedSections.includes('lang') && (
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <input type="file" accept=".xml" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLang} style={{ padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}>
                                        <Upload size={18} /> {uploadingLang ? t('uploading') : t('upload_language')}
                                    </button>
                                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>{t('upload_language_format')}</p>
                                </div>
                            </div>
                        )}
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
