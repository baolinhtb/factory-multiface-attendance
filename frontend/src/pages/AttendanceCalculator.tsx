import { useState } from 'react';
import { Calculator, Users, Calendar, CheckCircle, X, Clock } from 'lucide-react';
import api from '../services/api';

// Helper functions
const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

const formatOvertime = (minutes: number) => {
    if (minutes < 60) {
        return `${minutes} phút`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}p` : `${hours} giờ`;
};

const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
        'on_time': { label: 'Đúng giờ', color: '#10b981', bg: '#10b98120' },
        'late': { label: 'Muộn', color: '#ef4444', bg: '#ef444420' },
        'early': { label: 'Về sớm', color: '#f59e0b', bg: '#f59e0b20' },
        'late_and_early': { label: 'Muộn & Về sớm', color: '#dc2626', bg: '#dc262620' }
    };

    const badge = statusMap[status] || { label: status, color: '#64748b', bg: '#64748b20' };

    return (
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
    );
};

const AttendanceCalculator = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
    const [filterType, setFilterType] = useState<string>('today');
    const [startDate, setStartDate] = useState<string>(getLocalDateString());
    const [endDate, setEndDate] = useState<string>(getLocalDateString());

    const [employeeId, setEmployeeId] = useState<string>('');
    const [mode, setMode] = useState<'single' | 'all'>('single');
    const [showOvertimeModal, setShowOvertimeModal] = useState(false);
    const [selectedOvertimeSessions, setSelectedOvertimeSessions] = useState<any[]>([]);

    // Handle Filter Change
    const handleFilterChange = (type: string) => {
        setFilterType(type);
        const today = new Date();
        let start = new Date(today);
        let end = new Date(today);

        switch (type) {
            case 'today':
                break; // Start/End = Today
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'this_week':
                const day = today.getDay() || 7; // Get current day number, converting Sun(0) to 7
                if (day !== 1) start.setHours(-24 * (day - 1)); // Go back to Monday
                // End is today
                break;
            case 'this_month':
                start.setDate(1); // 1st of month
                break;
            case 'last_7_days':
                start.setDate(today.getDate() - 6);
                break;
            case 'custom':
                // Do not auto-set dates
                return;
        }

        if (type !== 'custom') {
            setStartDate(getLocalDateString(start));
            setEndDate(getLocalDateString(end));
        }
    };

    const handleCalculate = async () => {
        setLoading(true);
        setResult(null);
        try {
            let res;
            const params = `start_date=${startDate}&end_date=${endDate}`;
            if (mode === 'single') {
                res = await api.post(`/calculate-attendance?employee_id=${employeeId}&${params}`);
            } else {
                res = await api.post(`/calculate-attendance-all?${params}`);
            }
            setResult(res.data);
            alert('Tính toán thành công!');
        } catch (e: any) {
            console.error('Error calculating attendance', e);
            alert(e.response?.data?.detail || 'Lỗi khi tính toán');
        } finally {
            setLoading(false);
        }
    };

    const showOvertimeDetails = (sessions: any[]) => {
        setSelectedOvertimeSessions(sessions || []);
        setShowOvertimeModal(true);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calculator size={28} color="#3b82f6" />
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Tính toán chấm công</h2>
                </div>
            </div>

            {/* Description */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #334155',
                color: '#94a3b8'
            }}>
                <p style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#fff' }}>Chức năng:</strong> Tính toán chấm công từ lịch sử ra vào (presence logs)
                </p>
                <p style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#fff' }}>Logic:</strong>
                </p>
                <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                    <li><strong>Check-in:</strong> Lần ENTER đầu tiên trong khung giờ checkin</li>
                    <li><strong>Check-out:</strong> Lần LEAVE cuối cùng trong khung giờ checkout</li>
                    <li><strong>Trạng thái:</strong> Tự động phân loại (Đúng giờ, Muộn, Về sớm) dựa trên cấu hình ca</li>
                    <li><strong>Tăng ca:</strong> Thời gian làm việc NGOÀI tất cả các ca đã định nghĩa</li>
                </ul>
            </div>

            {/* Calculator Form */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155'
            }}>
                <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '20px' }}>Tính toán</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Mode Selection */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            Chế độ
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setMode('single')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: mode === 'single' ? '#3b82f6' : '#0f172a',
                                    color: 'white',
                                    border: `1px solid ${mode === 'single' ? '#3b82f6' : '#334155'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                <Users size={18} style={{ display: 'inline', marginRight: '8px' }} />
                                Một nhân viên
                            </button>
                            <button
                                onClick={() => setMode('all')}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: mode === 'all' ? '#3b82f6' : '#0f172a',
                                    color: 'white',
                                    border: `1px solid ${mode === 'all' ? '#3b82f6' : '#334155'}`,
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                <Users size={18} style={{ display: 'inline', marginRight: '8px' }} />
                                Tất cả nhân viên
                            </button>
                        </div>
                    </div>

                    {/* Employee ID (only for single mode) */}
                    {mode === 'single' && (
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                Mã nhân viên
                            </label>
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="Ví dụ: NV001"
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

                    {/* Date Filters */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            Khoảng thời gian
                        </label>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <select
                                value={filterType}
                                onChange={(e) => handleFilterChange(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                            >
                                <option value="today">Hôm nay</option>
                                <option value="yesterday">Hôm qua</option>
                                <option value="this_week">Tuần này</option>
                                <option value="last_7_days">7 ngày qua</option>
                                <option value="this_month">Tháng này</option>
                                <option value="custom">Tùy chọn...</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', marginBottom: '4px' }}>Từ ngày</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setFilterType('custom');
                                    }}
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
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', marginBottom: '4px' }}>Đến ngày</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setFilterType('custom');
                                    }}
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
                        </div>
                    </div>

                    {/* Calculate Button */}
                    <button
                        onClick={handleCalculate}
                        disabled={loading || (mode === 'single' && !employeeId)}
                        style={{
                            padding: '14px 24px',
                            background: loading ? '#64748b' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <Calculator size={20} />
                        {loading ? 'Đang tính toán...' : 'Tính toán chấm công'}
                    </button>
                </div>
            </div>

            {/* Results */}
            {result && (
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <CheckCircle size={20} color="#10b981" />
                        <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                            Kết quả tính toán - {startDate} đến {endDate}
                        </h3>
                    </div>

                    {mode === 'single' && result.shifts && (
                        <div>
                            <div style={{
                                marginBottom: '16px',
                                padding: '12px',
                                background: '#0f172a',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <Users size={20} color="#3b82f6" />
                                <div>
                                    <div style={{ fontWeight: 600, color: '#fff' }}>Nhân viên: {result.employee_id}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                        Tổng số ca: {result.shifts.length}
                                    </div>
                                </div>
                            </div>

                            {result.shifts.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '40px',
                                    color: '#64748b',
                                    background: '#0f172a',
                                    borderRadius: '8px'
                                }}>
                                    Không có dữ liệu chấm công trong ngày này
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {result.shifts.map((shift: any, idx: number) => (
                                        <div key={idx} style={{
                                            background: '#0f172a',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            border: '1px solid #334155'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '12px'
                                            }}>
                                                <h4 style={{
                                                    fontWeight: 600,
                                                    color: '#3b82f6',
                                                    fontSize: '1rem'
                                                }}>
                                                    {shift.shift_name}
                                                </h4>
                                                {getStatusBadge(shift.status)}
                                            </div>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: '12px'
                                            }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                        Check-in
                                                    </div>
                                                    <div style={{ fontWeight: 600, color: shift.check_in ? '#10b981' : '#64748b' }}>
                                                        {shift.check_in ? formatDateTime(shift.check_in) : 'Chưa check-in'}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                        Check-out
                                                    </div>
                                                    <div style={{ fontWeight: 600, color: shift.check_out ? '#10b981' : '#64748b' }}>
                                                        {shift.check_out ? formatDateTime(shift.check_out) : 'Chưa check-out'}
                                                    </div>
                                                </div>

                                                {shift.overtime > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                            Tăng ca
                                                        </div>
                                                        <div
                                                            onClick={() => showOvertimeDetails(shift.overtime_sessions || [])}
                                                            style={{
                                                                fontWeight: 600,
                                                                color: '#f59e0b',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline'
                                                            }}
                                                        >
                                                            {formatOvertime(shift.overtime)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'all' && result.results && (
                        <div>
                            <div style={{
                                marginBottom: '16px',
                                padding: '12px',
                                background: '#0f172a',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                color: '#94a3b8'
                            }}>
                                Đã xử lý: <strong style={{ color: '#fff' }}>{result.processed}</strong> nhân viên
                            </div>

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
                                            <th style={{ padding: '12px 10px' }}>Mã NV</th>
                                            <th style={{ padding: '12px 10px' }}>Ca làm việc</th>
                                            <th style={{ padding: '12px 10px' }}>Check-in</th>
                                            <th style={{ padding: '12px 10px' }}>Check-out</th>
                                            <th style={{ padding: '12px 10px' }}>Trạng thái</th>
                                            <th style={{ padding: '12px 10px' }}>Tăng ca</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.results.map((emp: any, empIdx: number) => (
                                            emp.shifts && emp.shifts.map((shift: any, shiftIdx: number) => (
                                                <tr
                                                    key={`${empIdx}-${shiftIdx}`}
                                                    style={{
                                                        borderBottom: '1px solid #334155',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ padding: '14px 10px', fontWeight: 600, color: '#cbd5e1' }}>
                                                        {emp.employee_id}
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        {shift.shift_name}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', color: shift.check_in ? '#10b981' : '#64748b' }}>
                                                        {shift.check_in ? formatDateTime(shift.check_in) : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', color: shift.check_out ? '#10b981' : '#64748b' }}>
                                                        {shift.check_out ? formatDateTime(shift.check_out) : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        {getStatusBadge(shift.status)}
                                                    </td>
                                                    <td
                                                        onClick={() => shift.overtime > 0 && showOvertimeDetails(shift.overtime_sessions || [])}
                                                        style={{
                                                            padding: '14px 10px',
                                                            color: '#f59e0b',
                                                            fontWeight: 600,
                                                            cursor: shift.overtime > 0 ? 'pointer' : 'default',
                                                            textDecoration: shift.overtime > 0 ? 'underline' : 'none'
                                                        }}
                                                    >
                                                        {shift.overtime > 0 ? formatOvertime(shift.overtime) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Overtime Detail Modal */}
            {showOvertimeModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowOvertimeModal(false)}>
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '16px',
                        padding: '24px',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        border: '1px solid #334155'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={24} color="#f59e0b" />
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Chi tiết tăng ca</h3>
                            </div>
                            <button
                                onClick={() => setShowOvertimeModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {selectedOvertimeSessions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                Không có dữ liệu tăng ca
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {selectedOvertimeSessions.map((session: any, idx: number) => (
                                    <div key={idx} style={{
                                        background: '#0f172a',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        border: '1px solid #334155'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                    Khoảng thời gian #{idx + 1}
                                                </div>
                                                <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                                    {formatDateTime(session.start)} → {formatDateTime(session.end)}
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '8px 16px',
                                                background: '#f59e0b20',
                                                border: '1px solid #f59e0b40',
                                                borderRadius: '6px',
                                                color: '#f59e0b',
                                                fontWeight: 700,
                                                fontSize: '0.875rem'
                                            }}>
                                                {formatOvertime(session.minutes)}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div style={{
                                    marginTop: '12px',
                                    padding: '16px',
                                    background: '#f59e0b10',
                                    borderRadius: '8px',
                                    border: '1px solid #f59e0b30',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        Tổng thời gian tăng ca
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
                                        {formatOvertime(selectedOvertimeSessions.reduce((sum, s) => sum + s.minutes, 0))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceCalculator;
