import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Filter, Download } from 'lucide-react';
import api from '../services/api';

const PresenceLogs = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [filterType, setFilterType] = useState<'day' | 'month' | 'range'>('day');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        fetchEmployees();
        fetchLogs();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            setEmployees(res.data);
        } catch (e) {
            console.error('Error fetching employees', e);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let params: any = {};

            if (selectedEmployee) {
                params.employee_id = selectedEmployee;
            }

            if (filterType === 'day') {
                params.start_date = selectedDate;
                params.end_date = selectedDate;
            } else if (filterType === 'month') {
                const year = parseInt(selectedMonth.split('-')[0]);
                const month = parseInt(selectedMonth.split('-')[1]);
                const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
                params.start_date = firstDay;
                params.end_date = lastDay;
            } else if (filterType === 'range' && startDate && endDate) {
                params.start_date = startDate;
                params.end_date = endDate;
            }

            const res = await api.get('/presence-logs', { params });
            setLogs(res.data);
        } catch (e) {
            console.error('Error fetching presence logs', e);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFilter = () => {
        fetchLogs();
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getEventBadge = (eventType: string) => {
        if (eventType === 'enter') {
            return {
                label: 'Vào',
                color: '#10b981',
                bg: '#10b98120'
            };
        } else {
            return {
                label: 'Ra',
                color: '#ef4444',
                bg: '#ef444420'
            };
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Clock size={28} color="#3b82f6" />
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Lịch sử ra vào</h2>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Filter size={20} color="#3b82f6" />
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>Bộ lọc</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    {/* Employee Filter */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            Nhân viên
                        </label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        >
                            <option value="">Tất cả nhân viên</option>
                            {employees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.full_name} ({emp.employee_id})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Type */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            Loại lọc
                        </label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        >
                            <option value="day">Theo ngày</option>
                            <option value="month">Theo tháng</option>
                            <option value="range">Khoảng thời gian</option>
                        </select>
                    </div>

                    {/* Date Inputs based on filter type */}
                    {filterType === 'day' && (
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                Ngày
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                            />
                        </div>
                    )}

                    {filterType === 'month' && (
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                Tháng
                            </label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                            />
                        </div>
                    )}

                    {filterType === 'range' && (
                        <>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                    Từ ngày
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                    Đến ngày
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        color: 'white'
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={handleApplyFilter}
                    style={{
                        marginTop: '20px',
                        padding: '10px 24px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Filter size={18} />
                    Áp dụng bộ lọc
                </button>
            </div>

            {/* Logs Table */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users size={20} color="#10b981" />
                        <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                            Danh sách ({logs.length} bản ghi)
                        </h3>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        Đang tải dữ liệu...
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{
                                    textAlign: 'left',
                                    borderBottom: '2px solid #334155',
                                    color: '#94a3b8',
                                    fontSize: '0.875rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    <th style={{ padding: '12px 10px' }}>Thời gian</th>
                                    <th style={{ padding: '12px 10px' }}>Nhân viên</th>
                                    <th style={{ padding: '12px 10px' }}>Mã NV</th>
                                    <th style={{ padding: '12px 10px' }}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, idx) => {
                                    const badge = getEventBadge(log.event_type);
                                    return (
                                        <tr
                                            key={idx}
                                            style={{
                                                borderBottom: '1px solid #334155',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '14px 10px', fontWeight: 600, color: '#cbd5e1' }}>
                                                {formatTimestamp(log.timestamp)}
                                            </td>
                                            <td style={{ padding: '14px 10px' }}>
                                                {log.full_name}
                                            </td>
                                            <td style={{ padding: '14px 10px', color: '#94a3b8' }}>
                                                {log.employee_id}
                                            </td>
                                            <td style={{ padding: '14px 10px' }}>
                                                <span style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    background: badge.bg,
                                                    color: badge.color,
                                                    display: 'inline-block',
                                                    border: `1px solid ${badge.color}20`
                                                }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                            <Clock size={40} style={{ opacity: 0.2, marginBottom: '10px' }} /><br />
                                            Không có dữ liệu phù hợp với bộ lọc
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PresenceLogs;
