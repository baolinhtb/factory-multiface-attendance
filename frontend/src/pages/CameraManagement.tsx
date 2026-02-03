import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
    Camera, Plus, Search, Trash2, Edit2, CheckCircle, XCircle, Settings, Monitor, Globe, PlusCircle, AlertCircle, RefreshCw,
    MoreVertical, Square, CheckSquare, X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import CameraSettingsModal from '../components/CameraSettingsModal';

const CameraManagement = () => {
    const { t } = useLanguage();
    const [cameras, setCameras] = useState<any[]>([]);
    const [availablePhysCameras, setAvailablePhysCameras] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCam, setEditingCam] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'usb',
        source: '0',
        is_active: 1,

        description: ''
    });

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsCameras, setSettingsCameras] = useState<any[]>([]); // Cameras being edited (1 or many)

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const fetchCameras = async () => {
        setLoading(true);
        try {
            const res = await api.get('/cameras');
            setCameras(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPhysCameras = async () => {
        setScanning(true);
        try {
            const res = await api.get('/cameras/available');
            setAvailablePhysCameras(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setScanning(false);
        }
    };

    useEffect(() => {
        fetchCameras();
    }, []);

    const handleOpenModal = (cam: any = null) => {
        if (cam) {
            setEditingCam(cam);
            setFormData({
                name: cam.name,
                type: cam.type,
                source: cam.source,
                is_active: cam.is_active,
                description: cam.description || ''
            });
        } else {
            setEditingCam(null);
            setFormData({
                name: '',
                type: 'usb',
                source: '0',
                is_active: 1,
                description: ''
            });
        }
        setShowModal(true);
        fetchPhysCameras();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                type: formData.type,
                source: formData.source,
                is_active: formData.is_active,
                description: formData.description
            };

            if (editingCam) {
                await api.put(`/cameras/${editingCam.id}`, payload);
            } else {
                await api.post('/cameras', payload);
            }
            setShowModal(false);
            fetchCameras();
        } catch (e) {
            console.error(e);
            alert("Error saving camera");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm(t('Are you sure you want to delete this camera?'))) return;
        setLoading(true);
        try {
            await api.delete(`/cameras/${id}`);
            fetchCameras();
            setSelectedIds(prev => prev.filter(pid => pid !== id));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Bulk Actions
    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === cameras.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(cameras.map(c => c.id));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(t(`Are you sure you want to delete ${selectedIds.length} cameras?`))) return;
        setLoading(true);
        try {
            for (const id of selectedIds) {
                await api.delete(`/cameras/${id}`);
            }
            fetchCameras();
            setSelectedIds([]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSettings = (cam: any) => {
        setSettingsCameras([cam]);
        setShowSettingsModal(true);
    };

    const handleOpenBulkSettings = () => {
        const selectedCams = cameras.filter(c => selectedIds.includes(c.id));
        setSettingsCameras(selectedCams);
        setShowSettingsModal(true);
    };

    const handleSaveSettings = async (payload: any) => {
        try {
            if (settingsCameras.length === 1) {
                const cam = settingsCameras[0];
                const { settings, restricted_zones } = payload;

                await api.put(`/cameras/${cam.id}`, {
                    ...cam,
                    settings: settings,
                    restricted_zones: restricted_zones
                });
            } else {
                const { settings } = payload;
                const ids = settingsCameras.map(c => c.id);
                await api.post('/cameras/bulk-settings', {
                    camera_ids: ids,
                    settings: settings
                });
            }
            fetchCameras();
        } catch (e) {
            console.error("Error saving settings:", e);
            throw e;
        }
    };

    const handleToggleStatus = async (id: number, currentStatus: number) => {
        try {
            const newStatus = currentStatus === 1 ? 0 : 1;
            // Optimistic update
            setCameras(prev => prev.map(c =>
                c.id === id ? { ...c, is_active: newStatus } : c
            ));

            await api.patch(`/cameras/${id}/status`, { is_active: newStatus });
        } catch (e) {
            console.error(e);
            // Revert on error
            fetchCameras();
            alert("Failed to update status");
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 700 }}>{t('camera_management') || 'Quản lý Camera'}</h2>
                    <p style={{ color: '#94a3b8' }}>{t('camera_management_desc') || 'Thiết lập và quản lý hệ thống nhiều camera'}</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    style={{
                        padding: '10px 20px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    <Plus size={20} /> {t('add_camera') || 'Thêm Camera'}
                </button>
            </div>

            {/* Bulk Action Bar - Sticky Bottom */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '999px',
                    padding: '12px 24px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    animation: 'fadeInUp 0.3s ease-out'
                }}>
                    <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>{selectedIds.length} {t('selected') || 'Đã chọn'}</span>
                    <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <button
                        onClick={handleOpenBulkSettings}
                        style={{
                            background: 'none', border: 'none', color: '#3b82f6',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                        }}
                    >
                        <Settings size={18} /> {t('settings') || 'Cài đặt'}
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        style={{
                            background: 'none', border: 'none', color: '#ef4444',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                        }}
                    >
                        <Trash2 size={18} /> {t('delete') || 'Xóa'}
                    </button>
                    <button
                        onClick={() => setSelectedIds([])}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8',
                            width: '24px', height: '24px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', marginLeft: '4px'
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {cameras.map(cam => (
                    <div key={cam.id} className={`premium-card relative group ${selectedIds.includes(cam.id) ? 'ring-2 ring-blue-500 bg-blue-900/10' : ''}`} style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        position: 'relative',
                        background: '#1e293b50'
                    }}>
                        {/* Checkbox Overlay */}
                        <div className="absolute top-3 left-3 z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleSelect(cam.id); }}
                                className={`p-1 rounded-md transition-colors ${selectedIds.includes(cam.id) ? 'bg-blue-600 text-white' : 'bg-black/50 text-gray-400 hover:bg-black/70'}`}
                            >
                                {selectedIds.includes(cam.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: cam.is_active ? '#3b82f620' : '#47556920',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Camera size={24} color={cam.is_active ? '#3b82f6' : '#94a3b8'} />
                                </div>
                                <div>
                                    <h4 style={{ fontWeight: 700, margin: 0 }}>{cam.name}</h4>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {cam.type === 'usb' ? <Monitor size={12} /> : <Globe size={12} />}
                                        {cam.type.toUpperCase()} | {cam.source.length > 20 ? cam.source.substring(0, 20) + '...' : cam.source}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => handleOpenSettings(cam)} style={{ padding: '10px', borderRadius: '10px', background: '#3b82f615', border: '1px solid #3b82f630', cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('settings') || 'Settings'}>
                                    <Settings size={18} />
                                </button>
                                <button onClick={() => handleOpenModal(cam)} style={{ padding: '10px', borderRadius: '10px', background: '#1e293b', border: '1px solid #334155', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(cam.id)} style={{ padding: '10px', borderRadius: '10px', background: '#ef444415', border: '1px solid #ef444430', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                            {cam.description || t('no_description') || 'No description'}
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 'auto',
                            paddingTop: '10px',
                            borderTop: '1px solid #33415520'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: cam.is_active ? '#10b981' : '#64748b'
                            }}>
                                {cam.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {cam.is_active ? (t('status_active') || 'ACTIVE') : (t('status_inactive') || 'INACTIVE')}
                            </div>

                            <div
                                onClick={() => handleToggleStatus(cam.id, cam.is_active)}
                                style={{
                                    width: '44px',
                                    height: '24px',
                                    backgroundColor: cam.is_active ? '#3b82f6' : '#334155',
                                    borderRadius: '999px',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.3s'
                                }}
                            >
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '3px',
                                    left: cam.is_active ? '23px' : '3px',
                                    transition: 'left 0.3s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                        </div>
                    </div>
                ))}

                {
                    cameras.length === 0 && !loading && (
                        <div style={{
                            gridColumn: '1 / -1',
                            textAlign: 'center',
                            padding: '60px',
                            background: '#1e293b20',
                            borderRadius: '16px',
                            border: '2px dashed #334155'
                        }}>
                            <Camera size={48} color="#475569" style={{ marginBottom: '16px' }} />
                            <p style={{ color: '#94a3b8' }}>{t('no_cameras_setup') || 'No cameras configured yet. Add a new camera to start monitoring.'}</p>
                        </div>
                    )
                }
            </div>

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
                        <div className="premium-card" style={{
                            width: '100%',
                            maxWidth: '500px',
                            padding: '30px',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '20px'
                        }}>
                            <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>{editingCam ? (t('edit_camera') || 'Cập nhật Camera') : (t('add_camera') || 'Thêm Camera')}</h3>
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{t('camera_name') || 'Tên Camera'}</label>
                                    <input
                                        className="premium-input"
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ví dụ: Cổng số 1"
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <div
                                        onClick={() => setFormData({ ...formData, type: 'usb' })}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '2px solid',
                                            borderColor: formData.type === 'usb' ? '#3b82f6' : '#334155',
                                            background: formData.type === 'usb' ? '#3b82f610' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}
                                    >
                                        <Monitor size={18} color={formData.type === 'usb' ? '#3b82f6' : '#94a3b8'} />
                                        <span style={{ fontWeight: 600 }}>USB Cam</span>
                                    </div>
                                    <div
                                        onClick={() => setFormData({ ...formData, type: 'rtsp' })}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '2px solid',
                                            borderColor: formData.type === 'rtsp' ? '#3b82f6' : '#334155',
                                            background: formData.type === 'rtsp' ? '#3b82f610' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}
                                    >
                                        <Globe size={18} color={formData.type === 'rtsp' ? '#3b82f6' : '#94a3b8'} />
                                        <span style={{ fontWeight: 600 }}>RTSP / Network</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                            {formData.type === 'usb' ? 'Index Camera (0, 1...)' : 'URL Stream (rtsp://...)'}
                                        </label>
                                        {formData.type === 'usb' && (
                                            <button
                                                type="button"
                                                onClick={fetchPhysCameras}
                                                disabled={scanning}
                                                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <RefreshCw size={12} className={scanning ? 'spin' : ''} /> {t('scan_again') || 'Quét lại'}
                                            </button>
                                        )}
                                    </div>

                                    {formData.type === 'usb' && availablePhysCameras.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                                            {availablePhysCameras.map(cam => (
                                                <button
                                                    key={cam.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, source: cam.id })}
                                                    style={{
                                                        padding: '4px 10px',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid',
                                                        borderColor: String(formData.source) === String(cam.id) ? '#3b82f6' : '#334155',
                                                        background: String(formData.source) === String(cam.id) ? '#3b82f620' : '#1e293b',
                                                        color: String(formData.source) === String(cam.id) ? 'white' : '#94a3b8',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {t('index') || 'Index'} {cam.id}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <input
                                        className="premium-input"
                                        type="text"
                                        value={formData.source}
                                        onChange={e => setFormData({ ...formData, source: e.target.value })}
                                        placeholder={formData.type === 'usb' ? '0' : 'rtsp://admin:password@192.168.1.10:554/stream1'}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{t('description') || 'Mô tả'} ({t('optional') || 'tùy chọn'})</label>
                                    <textarea
                                        className="premium-input"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        style={{ height: '80px', resize: 'none' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <label className="switch" style={{ width: '40px', height: '20px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active === 1}
                                            onChange={e => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                    <span style={{ fontSize: '0.875rem' }}>{t('activate_camera') || 'Kích hoạt camera này'}</span>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="premium-button secondary"
                                        style={{ flex: 1 }}
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="premium-button primary"
                                        style={{ flex: 1 }}
                                    >
                                        {editingCam ? t('save') : t('add_new')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <CameraSettingsModal
                isOpen={showSettingsModal}
                cameras={settingsCameras}
                onClose={() => setShowSettingsModal(false)}
                onSave={handleSaveSettings}
                t={t}
            />
        </div >
    );
};

export default CameraManagement;
