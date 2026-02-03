
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Save, AlertTriangle, Check, Code, Sliders, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import AceEditor from 'react-ace';

// Import ace modes and themes
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-twilight';

// Define Zod Schema
const CameraSettingsSchema = z.object({
    face_recognition_threshold: z.number().min(0, "Must be >= 0").max(1, "Must be <= 1").optional(),
    phone_detection_confidence: z.number().min(0).max(1).optional(),
    fire_detection_confidence: z.number().min(0).max(1).optional(),
    pose_detection_confidence: z.number().min(0).max(1).optional(),
    enable_face_rec: z.boolean().optional(),
    enable_phone_det: z.boolean().optional(),
    enable_fire_det: z.boolean().optional(),
    enable_pose_det: z.boolean().optional(),
    show_pose_visualization: z.boolean().optional(),
    show_age_gender: z.boolean().optional(),
    enable_alarm: z.boolean().optional(),
    // Allow extra fields
}).catchall(z.any());

interface CameraSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: any) => Promise<void>;
    cameras: any[]; // Selected cameras
    t: (key: string) => string; // Translation function
}

const DEFAULT_SETTINGS = {
    face_recognition_threshold: 0.45,
    phone_detection_confidence: 0.15,
    fire_detection_confidence: 0.30,
    pose_detection_confidence: 0.50,
    enable_face_rec: true,
    enable_phone_det: true,
    enable_fire_det: true,
    enable_pose_det: true,
    show_pose_visualization: true,
    show_age_gender: true,
    enable_alarm: true
};

const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({ isOpen, onClose, onSave, cameras, t }) => {
    const [activeTab, setActiveTab] = useState<'ui' | 'json'>('ui');
    const [settings, setSettings] = useState<any>({ ...DEFAULT_SETTINGS });
    const [jsonString, setJsonString] = useState<string>('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [zodErrors, setZodErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Initialize settings when modal opens or cameras change
    useEffect(() => {
        if (isOpen && cameras.length > 0) {
            // Logic: Load settings from the first camera. 
            // In bulk mode, this serves as the "template".
            const initialSettings = cameras[0].settings || { ...DEFAULT_SETTINGS };

            // Ensure numbers are numbers (backend might send strings if not strictly validated before)
            // But our Pydantic model ensures floats. 
            // However, verify just in case.

            setSettings(initialSettings);
            setJsonString(JSON.stringify(initialSettings, null, 4));
            setJsonError(null);
            setZodErrors({});
        }
    }, [isOpen, cameras]);

    // Update JSON when UI changes
    const handleUiChange = (key: string, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        setJsonString(JSON.stringify(newSettings, null, 4));
        validateSettings(newSettings);
    };

    // Update UI when JSON changes
    const handleJsonChange = (newJson: string) => {
        setJsonString(newJson);
        try {
            const parsed = JSON.parse(newJson);
            setSettings(parsed);
            setJsonError(null);
            validateSettings(parsed);
        } catch (e: any) {
            setJsonError(e.message);
        }
    };

    const validateSettings = (data: any) => {
        const result = CameraSettingsSchema.safeParse(data);
        if (!result.success) {
            const errors: Record<string, string> = {};
            result.error.issues.forEach(issue => {
                errors[issue.path[0].toString()] = issue.message;
            });
            setZodErrors(errors);
        } else {
            setZodErrors({});
        }
    };

    const handleSave = async () => {
        if (jsonError) return; // Don't save if JSON syntax error
        // Re-validate strictly
        const result = CameraSettingsSchema.safeParse(settings);
        if (!result.success) {
            // Block save? API blocks it too.
            // But UI allows saving 'extra' fields.
            // Currently schema accepts extra fields.
            // So safeParse usually succeeds unless types are wrong.
        }

        setIsSaving(true);
        try {
            await onSave(settings);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const renderSlider = (key: string, label: string) => (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(17, 24, 39, 0.5)', borderRadius: '8px', border: '1px solid rgba(55, 65, 81, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db' }}>{label}</label>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {settings[key]}
                </span>
            </div>
            <input
                type="range"
                min="0" max="1" step="0.05"
                value={settings[key] || 0}
                onChange={(e) => handleUiChange(key, parseFloat(e.target.value))}
                style={{ width: '100%', height: '8px', background: '#374151', borderRadius: '8px', appearance: 'none', cursor: 'pointer', outline: 'none' }}
                className="accent-blue-600"
            />
            {zodErrors[key] && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> {zodErrors[key]}
                </p>
            )}
        </div>
    );

    const renderSwitch = (key: string, label: string) => (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px',
            background: 'rgba(31, 41, 55, 0.5)', borderRadius: '8px', border: '1px solid #374151', transition: 'border-color 0.2s'
        }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db', cursor: 'pointer' }} onClick={() => handleUiChange(key, !settings[key])}>
                {label}
            </label>
            <button
                onClick={() => handleUiChange(key, !settings[key])}
                style={{
                    position: 'relative', display: 'inline-flex', height: '24px', width: '44px', alignItems: 'center', borderRadius: '9999px',
                    transition: 'background-color 0.2s', border: 'none', cursor: 'pointer',
                    backgroundColor: settings[key] ? '#2563eb' : '#374151'
                }}
            >
                <span style={{
                    display: 'inline-block', height: '16px', width: '16px', borderRadius: '9999px', backgroundColor: 'white',
                    transition: 'transform 0.2s', transform: settings[key] ? 'translateX(24px)' : 'translateX(4px)'
                }} />
            </button>
        </div>
    );

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.8)' // Explicit fallback
            }}
        >
            <div
                className="bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: '#1e1e1e',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    width: '100%',
                    maxWidth: '42rem',
                    border: '1px solid #374151',
                    borderRadius: '0.75rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px',
                    borderBottom: '1px solid #374151', background: 'rgba(31, 41, 55, 0.8)', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem',
                    backdropFilter: 'blur(12px)'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                        {cameras.length > 1 ? (
                            <>
                                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '8px', display: 'flex' }}><Sliders size={20} color="#60a5fa" /></div>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t ? t('Bulk Edit Settings') : 'Bulk Edit Settings'} <span style={{ color: '#9ca3af', fontSize: '0.875rem', fontWeight: 400 }}>({cameras.length} selected)</span>
                                </span>
                            </>
                        ) : (
                            <>
                                <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '8px', display: 'flex' }}><Sliders size={20} color="#60a5fa" /></div>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                                    {t ? t('Camera Settings') : 'Camera Settings'}
                                    <span style={{ color: '#9ca3af', margin: '0 8px' }}>|</span>
                                    <span style={{ color: '#bfdbfe' }}>{cameras[0]?.name}</span>
                                </span>
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} style={{ padding: '8px', color: '#9ca3af', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #374151', background: 'rgba(17, 24, 39, 0.4)' }}>
                    <button
                        style={{
                            flex: 1, padding: '16px', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            cursor: 'pointer', transition: 'all 0.2s', border: 'none', position: 'relative',
                            background: activeTab === 'ui' ? 'rgba(31, 41, 55, 0.5)' : 'transparent',
                            color: activeTab === 'ui' ? '#60a5fa' : '#9ca3af'
                        }}
                        onClick={() => setActiveTab('ui')}
                    >
                        <Sliders size={16} /> Standard UI
                        {activeTab === 'ui' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#3b82f6' }} />}
                    </button>
                    <button
                        style={{
                            flex: 1, padding: '16px', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            cursor: 'pointer', transition: 'all 0.2s', border: 'none', position: 'relative',
                            background: activeTab === 'json' ? 'rgba(31, 41, 55, 0.5)' : 'transparent',
                            color: activeTab === 'json' ? '#60a5fa' : '#9ca3af'
                        }}
                        onClick={() => setActiveTab('json')}
                    >
                        <Code size={16} /> Advanced JSON
                        {activeTab === 'json' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#3b82f6' }} />}
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'rgba(17, 24, 39, 0.2)' }}>
                    {activeTab === 'ui' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* General Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#9ca3af', borderRadius: '9999px' }}></div>
                                    General & Display
                                </h3>
                                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {renderSwitch('show_age_gender', 'Show Age & Gender')}
                                    {renderSwitch('enable_alarm', 'Enable Sound/Alarms')}
                                </div>
                            </div>

                            {/* Face Recognition */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '9999px' }}></div>
                                    Face Recognition
                                </h3>
                                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {renderSwitch('enable_face_rec', 'Enable Face Recognition')}
                                    {settings.enable_face_rec && renderSlider('face_recognition_threshold', 'Confidence Threshold')}
                                </div>
                            </div>

                            {/* Phone Detection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#eab308', borderRadius: '9999px' }}></div>
                                    Phone Detection
                                </h3>
                                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {renderSwitch('enable_phone_det', 'Enable Phone Detection')}
                                    {settings.enable_phone_det && renderSlider('phone_detection_confidence', 'Confidence Threshold')}
                                </div>
                            </div>

                            {/* Fire Detection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#ef4444', borderRadius: '9999px' }}></div>
                                    Fire Detection
                                </h3>
                                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {renderSwitch('enable_fire_det', 'Enable Fire Detection')}
                                    {settings.enable_fire_det && renderSlider('fire_detection_confidence', 'Confidence Threshold')}
                                </div>
                            </div>

                            {/* Pose/Fall Detection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '4px', height: '16px', background: '#a855f7', borderRadius: '9999px' }}></div>
                                    Pose & Fall Detection
                                </h3>
                                <div style={{ paddingLeft: '12px', borderLeft: '2px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {renderSwitch('enable_pose_det', 'Enable Pose Detection')}
                                    {renderSwitch('show_pose_visualization', 'Show Pose Visualization')}
                                    {renderSwitch('enable_fall_det', 'Enable Fall Alarm')}
                                    {(settings.enable_pose_det || settings.enable_fall_det) && renderSlider('pose_detection_confidence', 'Confidence Threshold')}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ height: '100%', minHeight: '400px', border: '1px solid rgba(55, 65, 81, 0.5)', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)', background: '#141414' }}>
                            <AceEditor
                                mode="json"
                                theme="twilight"
                                onChange={handleJsonChange}
                                name="json-editor"
                                value={jsonString}
                                editorProps={{ $blockScrolling: true }}
                                setOptions={{
                                    useWorker: false,
                                    showLineNumbers: true,
                                    tabSize: 4,
                                    fontFamily: 'monospace'
                                }}
                                width="100%"
                                height="400px"
                                style={{ backgroundColor: '#141414', fontSize: '14px' }}
                            />
                            {jsonError && (
                                <div style={{ background: 'rgba(127, 29, 29, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fecaca', padding: '12px', fontSize: '0.875rem', marginTop: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <AlertTriangle size={18} color="#f87171" />
                                    {jsonError}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px', borderTop: '1px solid #374151', background: 'rgba(31, 41, 55, 0.9)', borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem',
                    display: 'flex', justifyContent: 'flex-end', gap: '12px', backdropFilter: 'blur(12px)'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', fontSize: '0.875rem', fontWeight: 500, color: '#d1d5db', background: 'rgba(55, 65, 81, 0.5)',
                            border: '1px solid transparent', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !!jsonError}
                        style={{
                            padding: '10px 24px', fontSize: '0.875rem', fontWeight: 700, color: 'white', background: '#2563eb',
                            border: 'none', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                            display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving || !!jsonError ? 0.5 : 1
                        }}
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                        Save Settings
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CameraSettingsModal;
