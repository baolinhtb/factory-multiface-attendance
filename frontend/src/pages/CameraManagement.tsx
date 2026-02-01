import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Camera, Plus, Trash2, Edit2, CheckCircle, XCircle, RefreshCw, Monitor, Globe, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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
            const data = new FormData();
            data.append('name', formData.name);
            data.append('type', formData.type);
            data.append('source', formData.source);
            data.append('is_active', String(formData.is_active));
            data.append('description', formData.description);

            if (editingCam) {
                await api.put(`/cameras/${editingCam.id}`, data);
            } else {
                await api.post('/cameras', data);
            }
            setShowModal(false);
            fetchCameras();
        } catch (e) {
            alert("Error saving camera");
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this camera?")) return;
        try {
            await api.delete(`/cameras/${id}`);
            fetchCameras();
        } catch (e) {
            alert("Error deleting camera");
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {cameras.map(cam => (
                    <div key={cam.id} className="premium-card" style={{
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        position: 'relative',
                        background: '#1e293b50'
                    }}>
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
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleOpenModal(cam)} style={{ padding: '8px', borderRadius: '8px', background: '#1e293b', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(cam.id)} style={{ padding: '8px', borderRadius: '8px', background: '#ef444420', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
                            {cam.description || t('no_description') || 'No description'}
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: cam.is_active ? '#10b981' : '#ef4444'
                        }}>
                            {cam.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {cam.is_active ? (t('status_active') || 'ACTIVE') : (t('status_inactive') || 'INACTIVE')}
                        </div>
                    </div>
                ))}

                {cameras.length === 0 && !loading && (
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
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
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
            )}
        </div>
    );
};

export default CameraManagement;
