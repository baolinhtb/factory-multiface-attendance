import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, Calendar, CheckSquare, Square, AlertCircle, Check } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const ShiftManagement = () => {
    const { t } = useLanguage();
    const [configs, setConfigs] = useState<any[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
    const [shifts, setShifts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAddConfigModal, setShowAddConfigModal] = useState(false);
    const [newConfigName, setNewConfigName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const configRes = await api.get('/shifts/configs');
            setConfigs(configRes.data);
            if (configRes.data.length > 0 && !selectedConfigId) {
                const defaultConf = configRes.data.find((c: any) => c.is_default) || configRes.data[0];
                setSelectedConfigId(defaultConf.id);
            }
        } catch (e: any) {
            setError(t('error_fetch_configs'));
            console.error("Error fetching configs", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchShifts = async (configId: number) => {
        try {
            const res = await api.get(`/shifts?config_id=${configId}`);
            setShifts(res.data);
        } catch (e) {
            console.error("Error fetching shifts", e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedConfigId) {
            fetchShifts(selectedConfigId);
        }
    }, [selectedConfigId]);

    const handleAddConfig = async () => {
        if (!newConfigName.trim()) return;

        try {
            await api.post('/shifts/configs', { name: newConfigName.trim(), is_default: 0 });
            setNewConfigName('');
            setShowAddConfigModal(false);
            await fetchData();
        } catch (e: any) {
            alert(e.response?.data?.detail || t('error_add_config'));
        }
    };


    const handleDeleteConfig = async (id: number) => {
        if (!window.confirm(t('confirm_delete_config'))) return;
        try {
            await api.delete(`/shifts/configs/${id}`);
            if (selectedConfigId === id) setSelectedConfigId(null);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.detail || t('error_delete'));
        }
    };

    const handleUpdateConfig = async () => {
        const config = configs.find(c => c.id === selectedConfigId);
        if (!config) return;

        setIsSaving(true);
        try {
            await api.put(`/shifts/configs/${selectedConfigId}`, config);
            alert(t('save_config_success'));
        } catch (e: any) {
            alert(e.response?.data?.detail || t('update_config_error'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefault = async (id: number) => {
        const config = configs.find(c => c.id === id);
        if (!config) return;
        try {
            await api.put(`/shifts/configs/${id}`, { ...config, is_default: 1 });
            fetchData();
        } catch (e) { }
    };

    const handleAddShift = async () => {
        if (!selectedConfigId) return;
        const newShift = {
            config_id: selectedConfigId,
            name: t('new_shift_default_name'),
            start_time: '08:00',
            end_time: '17:00',
            late_grace_period: 15,
            early_grace_period: 15,
            checkin_start: '06:00',
            checkout_end: '19:00'
        };
        try {
            await api.post('/shifts', newShift);
            await fetchShifts(selectedConfigId);
            // Alert user success
            const el = document.getElementById('shifts-container');
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        } catch (e: any) {
            alert(e.response?.data?.detail || t('error_add_shift'));
        }
    };

    const handleUpdateShift = async (shift: any) => {
        try {
            await api.put(`/shifts/${shift.id}`, shift);
            alert(t('update_shift_success').replace('%s', shift.name));
        } catch (e: any) {
            alert(e.response?.data?.detail || t('error_update_shift'));
        }
    };

    const handleDeleteShift = async (id: number) => {
        if (confirmDeleteId !== id) {
            setConfirmDeleteId(id);
            // Reset after 3 seconds if not clicked again
            setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000);
            return;
        }

        try {
            await api.delete(`/shifts/${id}`);
            setConfirmDeleteId(null);
            if (selectedConfigId !== null) fetchShifts(selectedConfigId);
        } catch (e: any) {
            console.error("Error deleting shift:", e);
            alert(e.response?.data?.detail || t('error_delete_shift'));
        }
    };

    const toggleWorkDay = (configIdx: number, dayIdx: number) => {
        const newConfigs = [...configs];
        const days = newConfigs[configIdx].work_days.split(',');
        days[dayIdx] = days[dayIdx] === '1' ? '0' : '1';
        newConfigs[configIdx].work_days = days.join(',');
        setConfigs(newConfigs);
    };

    const currentConfigIdx = configs.findIndex(c => c.id === selectedConfigId);
    const currentConfig = currentConfigIdx !== -1 ? configs[currentConfigIdx] : null;



    // Create localized work day names
    const localizedWorkDayNames = [
        t('monday') || 'Thứ 2',
        t('tuesday') || 'Thứ 3',
        t('wednesday') || 'Thứ 4',
        t('thursday') || 'Thứ 5',
        t('friday') || 'Thứ 6',
        t('saturday') || 'Thứ 7',
        t('sunday') || 'Chủ nhật'
    ];

    return (
        <div className="grid-shift-management">
            {/* Sidebar: Config List */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #334155', height: '100%' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>{t('work_configs_title')}</h3>
                    <button onClick={() => setShowAddConfigModal(true)} style={{ padding: '6px', background: '#3b82f6', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {loading && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>{t('loading')}</div>
                    )}
                    {configs.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => setSelectedConfigId(c.id)}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginBottom: '4px',
                                background: selectedConfigId === c.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                border: selectedConfigId === c.id ? '1px solid #3b82f6' : '1px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: selectedConfigId === c.id ? '#3b82f6' : '#94a3b8',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <Calendar size={18} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: selectedConfigId === c.id ? 600 : 400 }}>{c.name}</span>
                            </div>
                            {c.is_default && <div style={{ background: '#10b981', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>{t('default_badge')}</div>}
                        </div>
                    ))}
                    {!loading && configs.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>{t('no_configs')}</div>
                    )}
                </div>
            </div>

            {/* Main Content: Shifts and Details */}
            <div id="shifts-container" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                {error && (
                    <div style={{ background: '#ef444420', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertCircle size={20} />
                        {error}
                        <button onClick={fetchData} style={{ marginLeft: 'auto', textDecoration: 'underline' }}>{t('retry')}</button>
                    </div>
                )}

                {currentConfig ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Header Section */}
                        <div style={{ padding: '0 0 24px 0', borderBottom: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={currentConfig.name}
                                            onChange={(e) => {
                                                const nc = [...configs];
                                                nc[currentConfigIdx].name = e.target.value;
                                                setConfigs(nc);
                                            }}
                                            style={{ fontSize: '1.5rem', fontWeight: 700, background: 'transparent', border: 'none', color: 'white', borderBottom: '2px solid transparent', padding: '4px 0', width: '400px', outline: 'none' }}
                                        />
                                    </div>


                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t('config_id')}: #{currentConfig.id} {currentConfig.is_default ? t('default_badge') : ''}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {!currentConfig.is_default && (
                                        <>
                                            <button onClick={() => handleSetDefault(currentConfig.id)} style={{ padding: '8px 16px', background: '#334155', borderRadius: '8px', fontSize: '0.875rem', color: 'white' }}>{t('set_default')}</button>
                                            <button onClick={() => handleDeleteConfig(currentConfig.id)} style={{ padding: '8px 16px', background: '#ef444420', color: '#ef4444', borderRadius: '8px', border: '1px solid #ef4444', fontSize: '0.875rem' }}>{t('delete_config')}</button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleUpdateConfig}
                                        disabled={isSaving}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: '#3b82f6', color: 'white', borderRadius: '8px', fontWeight: 600, transition: 'all 0.2s' }}
                                    >
                                        <Save size={18} /> {isSaving ? t('saving') : t('save_changes')}
                                    </button>
                                </div>
                            </div>

                            {/* Work Days Toggle */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '12px' }}>{t('work_days')}</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {localizedWorkDayNames.map((name, idx) => {
                                        const isWork = currentConfig.work_days.split(',')[idx] === '1';
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => toggleWorkDay(currentConfigIdx, idx)}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px',
                                                    borderRadius: '8px',
                                                    background: isWork ? 'rgba(59, 130, 246, 0.2)' : '#1e293b',
                                                    border: isWork ? '1px solid #3b82f6' : '1px solid #334155',
                                                    color: isWork ? '#3b82f6' : '#94a3b8',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span style={{ fontWeight: 700 }}>{name}</span>
                                                {isWork ? <CheckSquare size={16} /> : <Square size={16} color="#475569" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Shifts List */}
                        <div style={{ padding: '0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={20} color="#10b981" />
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{t('shift_settings')}</h4>
                                </div>
                                <button onClick={handleAddShift} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' }}>
                                    <Plus size={18} /> {t('add_new_shift')}
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {shifts.map((shift, idx) => (
                                    <div key={shift.id} style={{ padding: '20px 0', borderBottom: '1px solid #334155' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 700 }}>
                                                    {idx + 1}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={shift.name}
                                                    onChange={(e) => {
                                                        const ns = [...shifts];
                                                        ns[idx].name = e.target.value;
                                                        setShifts(ns);
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #334155', color: 'white', fontSize: '1.1rem', fontWeight: 600, width: '250px', outline: 'none' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleUpdateShift(shift)} style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    <Save size={16} /> {t('save')}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteShift(shift.id)}
                                                    style={{
                                                        padding: confirmDeleteId === shift.id ? '8px 12px' : '8px',
                                                        background: confirmDeleteId === shift.id ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
                                                        color: confirmDeleteId === shift.id ? 'white' : '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title={t('delete_shift_confirm')}
                                                >
                                                    {confirmDeleteId === shift.id ? <><Trash2 size={16} /> {t('delete_shift_confirm')}</> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid-stats">
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('start_work_time')}</label>
                                                <input
                                                    type="time"
                                                    value={shift.start_time}
                                                    onChange={(e) => {
                                                        const ns = [...shifts];
                                                        ns[idx].start_time = e.target.value;
                                                        setShifts(ns);
                                                    }}
                                                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('end_work_time')}</label>
                                                <input
                                                    type="time"
                                                    value={shift.end_time}
                                                    onChange={(e) => {
                                                        const ns = [...shifts];
                                                        ns[idx].end_time = e.target.value;
                                                        setShifts(ns);
                                                    }}
                                                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('late_grace')}</label>
                                                <input
                                                    type="number"
                                                    value={shift.late_grace_period}
                                                    onChange={(e) => {
                                                        const ns = [...shifts];
                                                        ns[idx].late_grace_period = parseInt(e.target.value) || 0;
                                                        setShifts(ns);
                                                    }}
                                                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('early_grace')}</label>
                                                <input
                                                    type="number"
                                                    value={shift.early_grace_period}
                                                    onChange={(e) => {
                                                        const ns = [...shifts];
                                                        ns[idx].early_grace_period = parseInt(e.target.value) || 0;
                                                        setShifts(ns);
                                                    }}
                                                    style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid-form-2col" style={{ marginTop: '15px', borderTop: '1px solid #1e293b', paddingTop: '15px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('checkin_window_start')}</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="time"
                                                        value={shift.checkin_start}
                                                        onChange={(e) => {
                                                            const ns = [...shifts];
                                                            ns[idx].checkin_start = e.target.value;
                                                            setShifts(ns);
                                                        }}
                                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                    />
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{t('checkin_window_hint')}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>{t('checkout_window_end')}</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="time"
                                                        value={shift.checkout_end}
                                                        onChange={(e) => {
                                                            const ns = [...shifts];
                                                            ns[idx].checkout_end = e.target.value;
                                                            setShifts(ns);
                                                        }}
                                                        style={{ width: '100%', padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '6px' }}
                                                    />
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{t('checkout_window_hint')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {shifts.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '60px', border: '2px dashed #334155', borderRadius: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                        <Clock size={48} style={{ opacity: 0.2 }} />
                                        <span>{t('no_shifts_in_config')}</span>
                                        <button onClick={handleAddShift} style={{ color: '#3b82f6', fontWeight: 600 }}>{t('add_first_shift')}</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '15px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                        <Clock size={64} style={{ opacity: 0.2 }} />
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: '#94a3b8' }}>{t('no_config_selected')}</p>
                            <p style={{ fontSize: '0.875rem' }}>{t('select_config_instruction')}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sub-modal for Adding Config */}
            {
                showAddConfigModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: '#1e293b', width: '400px', padding: '30px', borderRadius: '12px', border: '1px solid #334155' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>{t('add_config_modal_title')}</h3>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '8px' }}>{t('config_name_label')}</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newConfigName}
                                    onChange={(e) => setNewConfigName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddConfig()}
                                    style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                    placeholder={t('config_name_placeholder')}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowAddConfigModal(false)} style={{ padding: '8px 16px', color: '#94a3b8' }}>{t('cancel')}</button>
                                <button onClick={handleAddConfig} style={{ padding: '8px 24px', background: '#3b82f6', color: 'white', borderRadius: '8px', fontWeight: 600 }}>{t('create_btn')}</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ShiftManagement;
