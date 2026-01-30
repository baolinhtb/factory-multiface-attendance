import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Settings as SettingsIcon, Save, Monitor, Bell, Eye, PhoneOff, Globe, Upload, Flame, Brain, RotateCcw, User, Activity, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Settings = () => {
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
        pose_detection_confidence: '0.50'
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
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
                    <SettingsIcon size={32} color="#3b82f6" />
                    <div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('settings_title')}</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('settings_subtitle')}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* 1. Camera Config Section */}
                    <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
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
                                <Monitor size={20} color="#3b82f6" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{t('camera_type')}</span>
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
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                    {/* USB Camera Card */}
                                    <div
                                        onClick={() => setSettings({ ...settings, camera_type: 'usb' })}
                                        style={{
                                            padding: '20px',
                                            background: settings.camera_type === 'usb' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            border: '2px solid',
                                            borderColor: settings.camera_type === 'usb' ? '#3b82f6' : '#334155',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '15px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <input
                                                    type="radio"
                                                    name="camera_type"
                                                    value="usb"
                                                    checked={settings.camera_type === 'usb'}
                                                    onChange={() => setSettings({ ...settings, camera_type: 'usb' })}
                                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{t('usb_camera')}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Webcam, USB Cam</div>
                                                </div>
                                            </div>

                                            {/* Scan Button */}
                                            {settings.camera_type === 'usb' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleScanCameras();
                                                    }}
                                                    disabled={scanningCameras}
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <RefreshCw size={14} className={scanningCameras ? "spin" : ""} />
                                                    {scanningCameras ? "Scanning..." : "Scan"}
                                                </button>
                                            )}
                                        </div>

                                        <div style={{
                                            opacity: settings.camera_type === 'usb' ? 1 : 0.4,
                                            transition: 'all 0.3s',
                                            pointerEvents: settings.camera_type === 'usb' ? 'auto' : 'none'
                                        }} onClick={(e) => e.stopPropagation()}>

                                            {/* Camera List */}
                                            {availableCameras.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                                    {availableCameras.map((cam: any) => (
                                                        <div
                                                            key={cam.id}
                                                            onClick={() => setSettings({ ...settings, camera_src: cam.id })}
                                                            style={{
                                                                padding: '6px 12px',
                                                                background: settings.camera_src === cam.id ? '#3b82f6' : '#1e293b',
                                                                border: '1px solid',
                                                                borderColor: settings.camera_src === cam.id ? '#3b82f6' : '#334155',
                                                                borderRadius: '8px',
                                                                color: 'white',
                                                                fontSize: '0.85rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px'
                                                            }}
                                                        >
                                                            <Monitor size={14} />
                                                            {cam.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <input
                                                type="text"
                                                value={settings.camera_src}
                                                onChange={(e) => setSettings({ ...settings, camera_src: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: '#1e293b',
                                                    border: '1px solid #334155',
                                                    borderRadius: '8px',
                                                    color: 'white',
                                                    outline: 'none',
                                                    fontSize: '0.9rem'
                                                }}
                                                placeholder={t('camera_placeholder')}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '5px' }}>
                                                {availableCameras.length > 0 ? "Select a detected camera or enter Index manually" : "Enter Camera Index (0, 1, 2...) manually"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* RTSP Camera Card */}
                                    <div
                                        onClick={() => setSettings({ ...settings, camera_type: 'rtsp' })}
                                        style={{
                                            padding: '20px',
                                            background: settings.camera_type === 'rtsp' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            border: '2px solid',
                                            borderColor: settings.camera_type === 'rtsp' ? '#10b981' : '#334155',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '15px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <input
                                                type="radio"
                                                name="camera_type"
                                                value="rtsp"
                                                checked={settings.camera_type === 'rtsp'}
                                                onChange={() => setSettings({ ...settings, camera_type: 'rtsp' })}
                                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{t('rtsp_camera')}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Network Stream</div>
                                            </div>
                                        </div>

                                        <div style={{
                                            opacity: settings.camera_type === 'rtsp' ? 1 : 0.4,
                                            transition: 'all 0.3s',
                                            pointerEvents: settings.camera_type === 'rtsp' ? 'auto' : 'none'
                                        }} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={settings.rtsp_url || ''}
                                                onChange={(e) => setSettings({ ...settings, rtsp_url: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: '#1e293b',
                                                    border: '1px solid #334155',
                                                    borderRadius: '8px',
                                                    color: 'white',
                                                    outline: 'none',
                                                    fontSize: '0.9rem'
                                                }}
                                                placeholder={t('rtsp_placeholder')}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. AI & Analysis Section */}
                    <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleSection('ai')}
                            style={{
                                padding: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: expandedSections.includes('ai') ? '#1e293b' : 'transparent',
                                transition: 'all 0.3s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Brain size={20} color="#a78bfa" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{t('ai_settings_title')}</span>
                            </div>
                            <div style={{
                                transform: expandedSections.includes('ai') ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 0.3s',
                                color: '#94a3b8'
                            }}>
                                <SettingsIcon size={18} />
                            </div>
                        </div>

                        {expandedSections.includes('ai') && (
                            <div style={{ padding: '24px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Phone Detection */}
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.enable_phone_det === 'true' ? '15px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <PhoneOff size={20} color="#f59e0b" />
                                            <span style={{ fontWeight: 600 }}>{t('phone_detection')}</span>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                                            <input type="checkbox" checked={settings.enable_phone_det === 'true'} onChange={(e) => setSettings({ ...settings, enable_phone_det: e.target.checked ? 'true' : 'false' })} style={{ opacity: 0, width: 0, height: 0 }} />
                                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.enable_phone_det === 'true' ? '#f59e0b' : '#334155', transition: '.4s', borderRadius: '34px' }}>
                                                <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: settings.enable_phone_det === 'true' ? 'translateX(22px)' : 'translateX(0)' }}></span>
                                            </span>
                                        </label>
                                    </div>
                                    {settings.enable_phone_det === 'true' && (
                                        <div style={{ padding: '15px', background: '#0f172a', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.85rem' }}>{t('phone_detection_confidence')}</span>
                                                <button onClick={() => setSettings({ ...settings, phone_detection_confidence: '0.15' })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}><RotateCcw size={12} /> {t('default')}</button>
                                            </div>
                                            <input type="range" min="0.1" max="0.9" step="0.05" value={settings.phone_detection_confidence} onChange={(e) => setSettings({ ...settings, phone_detection_confidence: e.target.value })} style={{ width: '100%', accentColor: '#f59e0b' }} />
                                            <div style={{ textAlign: 'center', fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem' }}>{settings.phone_detection_confidence}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Fire Detection */}
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.enable_fire_det === 'true' ? '15px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Flame size={20} color="#ff6b35" />
                                            <span style={{ fontWeight: 600 }}>{t('fire_detection')}</span>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                                            <input type="checkbox" checked={settings.enable_fire_det === 'true'} onChange={(e) => setSettings({ ...settings, enable_fire_det: e.target.checked ? 'true' : 'false' })} style={{ opacity: 0, width: 0, height: 0 }} />
                                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.enable_fire_det === 'true' ? '#ff6b35' : '#334155', transition: '.4s', borderRadius: '34px' }}>
                                                <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: settings.enable_fire_det === 'true' ? 'translateX(22px)' : 'translateX(0)' }}></span>
                                            </span>
                                        </label>
                                    </div>
                                    {settings.enable_fire_det === 'true' && (
                                        <div style={{ padding: '15px', background: '#0f172a', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.85rem' }}>{t('fire_detection_confidence')}</span>
                                                <button onClick={() => setSettings({ ...settings, fire_detection_confidence: '0.30' })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}><RotateCcw size={12} /> {t('default')}</button>
                                            </div>
                                            <input type="range" min="0.1" max="0.9" step="0.05" value={settings.fire_detection_confidence} onChange={(e) => setSettings({ ...settings, fire_detection_confidence: e.target.value })} style={{ width: '100%', accentColor: '#ff6b35' }} />
                                            <div style={{ textAlign: 'center', fontWeight: 700, color: '#ff6b35', fontSize: '0.9rem' }}>{settings.fire_detection_confidence}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Pose Detection */}
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: settings.enable_pose_det === 'true' ? '15px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <User size={20} color="#06b6d4" />
                                            <span style={{ fontWeight: 600 }}>{t('pose_detection')}</span>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                                            <input type="checkbox" checked={settings.enable_pose_det === 'true'} onChange={(e) => setSettings({ ...settings, enable_pose_det: e.target.checked ? 'true' : 'false' })} style={{ opacity: 0, width: 0, height: 0 }} />
                                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.enable_pose_det === 'true' ? '#06b6d4' : '#334155', transition: '.4s', borderRadius: '34px' }}>
                                                <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: settings.enable_pose_det === 'true' ? 'translateX(22px)' : 'translateX(0)' }}></span>
                                            </span>
                                        </label>
                                    </div>
                                    {settings.enable_pose_det === 'true' && (
                                        <div style={{ padding: '15px', background: '#0f172a', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.85rem' }}>{t('pose_detection_confidence')}</span>
                                                <button onClick={() => setSettings({ ...settings, pose_detection_confidence: '0.50' })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}><RotateCcw size={12} /> {t('default')}</button>
                                            </div>
                                            <input type="range" min="0.1" max="0.9" step="0.05" value={settings.pose_detection_confidence} onChange={(e) => setSettings({ ...settings, pose_detection_confidence: e.target.value })} style={{ width: '100%', accentColor: '#06b6d4' }} />
                                            <div style={{ textAlign: 'center', fontWeight: 700, color: '#06b6d4', fontSize: '0.9rem' }}>{settings.pose_detection_confidence}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Fall Detection Card */}
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Activity size={20} color="#fcd34d" />
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'white' }}>{t('fall_detection_title') || 'Phát hiện té ngã'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('fall_detection_desc') || 'Cảnh báo khi người bị ngã'}</div>
                                            </div>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px' }}>
                                            <input
                                                type="checkbox"
                                                checked={settings.enable_fall_det === 'true'}
                                                onChange={(e) => setSettings({ ...settings, enable_fall_det: e.target.checked ? 'true' : 'false' })}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.enable_fall_det === 'true' ? '#fcd34d' : '#334155', transition: '.4s', borderRadius: '34px' }}>
                                                <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: settings.enable_fall_det === 'true' ? 'translateX(22px)' : 'translateX(0)' }}></span>
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Face & General */}
                                <div style={{ padding: '16px', borderRadius: '12px', background: '#1e293b50', border: '1px solid #334155' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '15px' }}>{t('general_settings')}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={{ padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <span style={{ fontSize: '0.8rem' }}>{t('face_recognition_threshold')}</span>
                                                <button onClick={() => setSettings({ ...settings, face_recognition_threshold: '0.45' })} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem' }}><RotateCcw size={10} /> {t('default')}</button>
                                            </div>
                                            <input type="range" min="0.3" max="0.7" step="0.01" value={settings.face_recognition_threshold} onChange={(e) => setSettings({ ...settings, face_recognition_threshold: e.target.value })} style={{ width: '100%', accentColor: '#a78bfa' }} />
                                            <div style={{ textAlign: 'center', fontWeight: 700, color: '#a78bfa', fontSize: '0.85rem' }}>{settings.face_recognition_threshold}</div>
                                        </div>
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

                    {/* 3. Language Section */}
                    <div style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
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
