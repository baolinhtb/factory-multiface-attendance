import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, Calendar, CheckSquare, Square, AlertCircle, Check } from 'lucide-react';
import api from '../services/api';

const ShiftManagement = () => {
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
            const configRes = await api.get('/shift-configs');
            setConfigs(configRes.data);
            if (configRes.data.length > 0 && !selectedConfigId) {
                const defaultConf = configRes.data.find((c: any) => c.is_default) || configRes.data[0];
                setSelectedConfigId(defaultConf.id);
            }
        } catch (e: any) {
            setError("Không thể tải danh sách chế độ làm việc. Vui lòng kiểm tra kết nối.");
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
            await api.post('/shift-configs', { name: newConfigName.trim(), is_default: 0 });
            setNewConfigName('');
            setShowAddConfigModal(false);
            await fetchData();
        } catch (e: any) {
            alert(e.response?.data?.detail || "Lỗi khi thêm chế độ mới");
        }
    };

    const handleDeleteConfig = async (id: number) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa chế độ này? Tất cả các ca thuộc chế độ này sẽ bị xóa.")) return;
        try {
            await api.delete(`/shift-configs/${id}`);
            if (selectedConfigId === id) setSelectedConfigId(null);
            fetchData();
        } catch (e: any) {
            alert(e.response?.data?.detail || "Lỗi khi xóa");
        }
    };

    const handleUpdateConfig = async () => {
        const config = configs.find(c => c.id === selectedConfigId);
        if (!config) return;

        setIsSaving(true);
        try {
            await api.put(`/shift-configs/${selectedConfigId}`, config);
            alert("Đã lưu cấu hình chế độ thành công!");
        } catch (e: any) {
            alert(e.response?.data?.detail || "Lỗi khi cập nhật");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefault = async (id: number) => {
        const config = configs.find(c => c.id === id);
        if (!config) return;
        try {
            await api.put(`/shift-configs/${id}`, { ...config, is_default: 1 });
            fetchData();
        } catch (e) { }
    };

    const handleAddShift = async () => {
        if (!selectedConfigId) return;
        const newShift = {
            config_id: selectedConfigId,
            name: 'Ca mới',
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
            alert(e.response?.data?.detail || "Lỗi khi thêm ca mới");
        }
    };

    const handleUpdateShift = async (shift: any) => {
        try {
            await api.put(`/shifts/${shift.id}`, shift);
            alert(`Đã cập nhật ${shift.name} thành công!`);
        } catch (e: any) {
            alert(e.response?.data?.detail || "Lỗi khi cập nhật ca");
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
            alert(e.response?.data?.detail || "Lỗi khi xóa ca");
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

    const workDayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    return (
        <div className="grid-shift-management">
            {/* Sidebar: Config List */}
            <div style={{ background: '#1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', border: '1px solid #334155', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '1rem' }}>Chế độ làm việc</h3>
                    <button onClick={() => setShowAddConfigModal(true)} style={{ padding: '6px', background: '#3b82f6', borderRadius: '6px', color: 'white', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                    {loading && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
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
                            {c.is_default && <div style={{ background: '#10b981', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>Mặc định</div>}
                        </div>
                    ))}
                    {!loading && configs.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>Chưa có chế độ nào</div>
                    )}
                </div>
            </div>

            {/* Main Content: Shifts and Details */}
            <div id="shifts-container" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                {error && (
                    <div style={{ background: '#ef444420', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertCircle size={20} />
                        {error}
                        <button onClick={fetchData} style={{ marginLeft: 'auto', textDecoration: 'underline' }}>Thử lại</button>
                    </div>
                )}

                {currentConfig ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Header Section */}
                        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
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
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>ID Cấu hình: #{currentConfig.id} {currentConfig.is_default ? '(Mặc định hệ thống)' : ''}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {!currentConfig.is_default && (
                                        <>
                                            <button onClick={() => handleSetDefault(currentConfig.id)} style={{ padding: '8px 16px', background: '#334155', borderRadius: '8px', fontSize: '0.875rem', color: 'white' }}>Đặt làm mặc định</button>
                                            <button onClick={() => handleDeleteConfig(currentConfig.id)} style={{ padding: '8px 16px', background: '#ef444420', color: '#ef4444', borderRadius: '8px', border: '1px solid #ef4444', fontSize: '0.875rem' }}>Xóa chế độ</button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleUpdateConfig}
                                        disabled={isSaving}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', background: '#3b82f6', color: 'white', borderRadius: '8px', fontWeight: 600, transition: 'all 0.2s' }}
                                    >
                                        <Save size={18} /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                </div>
                            </div>

                            {/* Work Days Toggle */}
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '12px' }}>Ngày làm việc trong tuần:</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {workDayNames.map((name, idx) => {
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
                                                <span style={{ fontSize: '0.7rem', color: isWork ? '#3b82f6' : '#64748b' }}>{name.split(' ')[0]}</span>
                                                <span style={{ fontWeight: 700 }}>{name.split(' ')[1] || name}</span>
                                                {isWork ? <CheckSquare size={16} /> : <Square size={16} color="#475569" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Shifts List */}
                        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={20} color="#10b981" />
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Cấu hình các ca làm việc</h4>
                                </div>
                                <button onClick={handleAddShift} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' }}>
                                    <Plus size={18} /> Thêm ca mới
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {shifts.map((shift, idx) => (
                                    <div key={shift.id} style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
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
                                                    <Save size={16} /> Lưu
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
                                                    title="Xóa ca này"
                                                >
                                                    {confirmDeleteId === shift.id ? <><Trash2 size={16} /> Xác nhận xóa?</> : <Trash2 size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid-stats">
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Giờ bắt đầu làm</label>
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
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Giờ kết thúc làm</label>
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
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Đi muộn CP (Phút)</label>
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
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Về sớm CP (Phút)</label>
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
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Bắt đầu cửa sổ chấm công</label>
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
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>(Theo dõi vào từ giờ này)</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>Kết thúc cửa sổ chấm công</label>
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
                                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>(Theo dõi ra đến giờ này)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {shifts.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '60px', border: '2px dashed #334155', borderRadius: '12px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                        <Clock size={48} style={{ opacity: 0.2 }} />
                                        <span>Chưa có ca làm việc nào được thiết lập cho chế độ này.</span>
                                        <button onClick={handleAddShift} style={{ color: '#3b82f6', fontWeight: 600 }}>+ Thêm ca đầu tiên</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '15px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                        <Clock size={64} style={{ opacity: 0.2 }} />
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 600, color: '#94a3b8' }}>Chưa chọn chế độ làm việc</p>
                            <p style={{ fontSize: '0.875rem' }}>Vui lòng chọn một chế độ ở cột bên trái hoặc tạo mới.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sub-modal for Adding Config */}
            {showAddConfigModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#1e293b', width: '400px', padding: '30px', borderRadius: '12px', border: '1px solid #334155' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>Thêm chế độ làm việc mới</h3>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '8px' }}>Tên chế độ:</label>
                            <input
                                autoFocus
                                type="text"
                                value={newConfigName}
                                onChange={(e) => setNewConfigName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddConfig()}
                                style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white' }}
                                placeholder="Ví dụ: Ca kíp sản xuất"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowAddConfigModal(false)} style={{ padding: '8px 16px', color: '#94a3b8' }}>Hủy</button>
                            <button onClick={handleAddConfig} style={{ padding: '8px 24px', background: '#3b82f6', color: 'white', borderRadius: '8px', fontWeight: 600 }}>Tạo mới</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShiftManagement;
