import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, User, Phone, Clock, Calendar, CheckCircle, AlertCircle, Camera, Edit2, X, Save } from 'lucide-react';
import DateFilter from '../components/DateFilter';

const EmployeeDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [employee, setEmployee] = useState<any>(null);
    const [originalEmployee, setOriginalEmployee] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [phoneLogs, setPhoneLogs] = useState<any[]>([]);
    const [configs, setConfigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Date filter states (managed by DateFilter component)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleDateChange = useCallback((start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    }, []);


    const fetchData = async () => {
        try {
            let attendanceQuery = `/employees/${id}/attendance`;
            let phoneQuery = `/employees/${id}/phone`;

            if (startDate && endDate) {
                const dateParams = `?start_date=${startDate}&end_date=${endDate}`;
                attendanceQuery += dateParams;
                phoneQuery += dateParams;
            }

            const [empRes, attRes, phoneRes, configRes] = await Promise.all([
                api.get(`/employees/${id}`),
                api.get(attendanceQuery),
                api.get(phoneQuery),
                api.get('/shift-configs')
            ]);
            setEmployee(empRes.data);
            setOriginalEmployee(empRes.data);
            setAttendance(attRes.data);
            setPhoneLogs(phoneRes.data);
            setConfigs(configRes.data);
        } catch (e) {
            console.error("Error fetching employee details", e);
        } finally {
            setLoading(false);
        }
    };

    // Initial data fetch on mount
    useEffect(() => {
        fetchData();
    }, [id]);

    // Refetch when dates change (from DateFilter component)
    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        setEmployee({ ...originalEmployee });
        setIsEditing(false);
    };

    const handleUpdate = async () => {
        setUpdating(true);
        try {
            await api.put(`/employees/${id}`, {
                full_name: employee.full_name,
                position: employee.position,
                department: employee.department,
                assigned_config_id: employee.assigned_config_id ? parseInt(employee.assigned_config_id) : null
            });
            alert("Cập nhật thành công!");
            await fetchData();
            setIsEditing(false);
        } catch (e) {
            alert("Lỗi khi cập nhật nhân viên");
        } finally {
            setUpdating(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        setUpdating(true);
        try {
            // Upload to new endpoint
            await api.post(`/employees/${employee.employee_id}/upload-image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Cập nhật ảnh và dữ liệu khuôn mặt thành công!");
            fetchData(); // Reload data to show new image
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.detail || "Lỗi khi cập nhật ảnh");
        } finally {
            setUpdating(false);
        }
    };

    const formatOvertime = (minutes: number) => {
        if (!minutes || minutes <= 0) return "0 p";
        if (minutes < 60) return `${minutes} phút`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
    };


    const getStatusInfo = (status: string, shiftName?: string, isAllDayAbsent?: boolean) => {
        if (status === 'absent') {
            if (isAllDayAbsent) return { label: 'Nghỉ cả ngày', color: '#ef4444', bg: '#ef444420' };
            const name = shiftName?.toLowerCase() || '';
            let label = 'Vắng mặt';
            if (name.includes('sáng')) label = 'Nghỉ buổi sáng';
            else if (name.includes('chiều')) label = 'Nghỉ chiều';
            else if (name.includes('tối')) label = 'Nghỉ tối';
            return { label, color: '#f87171', bg: '#ef444410' };
        }
        switch (status) {
            case 'on_time': return { label: 'Đủ giờ', color: '#10b981', bg: '#10b98120' };
            case 'late': return { label: 'Đi muộn', color: '#ef4444', bg: '#ef444420' };
            case 'early_leave': return { label: 'Về sớm', color: '#f59e0b', bg: '#f59e0b20' };
            case 'late_and_early': return { label: 'Muộn & Về sớm', color: '#f59e0b', bg: '#f59e0b20' };
            default: return { label: status, color: '#94a3b8', bg: '#33415520' };
        }
    };

    const processedAttendance = React.useMemo(() => {
        if (!employee?.config?.shifts || !startDate || !endDate) return attendance;

        const logsByDate: any = {};
        attendance.forEach(log => {
            if (!logsByDate[log.date]) logsByDate[log.date] = [];
            logsByDate[log.date].push(log);
        });

        const result: any[] = [];
        const today = new Date();
        const nowTimeShort = today.getHours() * 60 + today.getMinutes();

        // Iterate date range
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayOfWeek = (d.getDay() + 6) % 7;

            const isWorkDay = employee.config.work_days && employee.config.work_days.split(',')[dayOfWeek] === '1';
            const dayLogs = logsByDate[dateStr] || [];

            if (isWorkDay) {
                const missingShifts = employee.config.shifts.filter((s: any) =>
                    !dayLogs.find((l: any) => l.shift_name === s.name)
                );

                const isToday = dateStr === today.toISOString().split('T')[0];

                // Add existing logs
                dayLogs.forEach((l: any) => result.push(l));

                // Add absences for missing shifts
                missingShifts.forEach((s: any) => {
                    const [h, m] = s.start.split(':');
                    const startTimeMins = parseInt(h) * 60 + parseInt(m);

                    // Only add as absent if it's a past day OR today but shift already started
                    if (!isToday || nowTimeShort > startTimeMins + 60) {
                        result.push({
                            date: dateStr,
                            shift_name: s.name,
                            shift_start_time: s.start,
                            check_in: null,
                            check_out: null,
                            status: 'absent',
                            overtime: 0,
                            isAllDayAbsent: dayLogs.length === 0 && missingShifts.length === employee.config.shifts.length
                        });
                    }
                });
            } else if (dayLogs.length > 0) {
                // Not a work day but has logs (Overtime/Special work)
                dayLogs.forEach((l: any) => result.push(l));
            }
        }
        return result.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            const timeA = a.shift_start_time || (a.check_in ? new Date(a.check_in).toLocaleTimeString('en-US', { hour12: false }).slice(0, 5) : '00:00');
            const timeB = b.shift_start_time || (b.check_in ? new Date(b.check_in).toLocaleTimeString('en-US', { hour12: false }).slice(0, 5) : '00:00');
            return timeA.localeCompare(timeB);
        });
    }, [attendance, employee, startDate, endDate]);

    if (loading) return <div style={{ textAlign: 'center', padding: '50px', background: '#0f172a', color: 'white', minHeight: '100vh' }}>Đang tải dữ liệu...</div>;
    if (!employee) return <div style={{ textAlign: 'center', padding: '50px', background: '#0f172a', color: 'white', minHeight: '100vh' }}>Không tìm thấy nhân viên</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => navigate('/employees')} style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Chi tiết nhân viên: {employee.full_name}</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', alignItems: 'start' }}>
                {/* Profile Card */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155',
                    textAlign: 'center',
                    position: 'sticky',
                    top: '20px'
                }}>
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        background: '#334155',
                        margin: '0 auto 15px',
                        padding: '10px',
                        border: '2px solid #3b82f6',
                        position: 'relative'
                    }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {employee.image_path ? (
                                <img
                                    src={`http://localhost:8000${employee.image_path}?t=${new Date().getTime()}`}
                                    alt={employee.full_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <User size={60} color="#3b82f6" />
                            )}
                        </div>

                        {/* Camera Icon Overlay */}
                        <label
                            htmlFor="image-upload"
                            style={{
                                position: 'absolute',
                                bottom: '0',
                                right: '0',
                                background: '#3b82f6',
                                borderRadius: '50%',
                                padding: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                            title="Cập nhật ảnh đại diện"
                        >
                            <Camera size={16} color="white" />
                        </label>
                        <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                            disabled={updating}
                        />
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={employee.full_name}
                            onChange={(e) => setEmployee({ ...employee, full_name: e.target.value })}
                            style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '5px', textAlign: 'center', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white', width: '100%', padding: '8px' }}
                        />
                    ) : (
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '5px', textAlign: 'center', color: 'white' }}>
                            {employee.full_name}
                        </h3>
                    )}
                    <p style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem', marginBottom: '20px' }}>ID Nhân viên: {employee.employee_id}</p>

                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chức vụ:</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={employee.position || ''}
                                    onChange={(e) => setEmployee({ ...employee, position: e.target.value })}
                                    placeholder="N/A"
                                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white' }}
                                />
                            ) : (
                                <p style={{ padding: '10px', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                    {employee.position || 'N/A'}
                                </p>
                            )}
                        </div>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phòng ban:</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={employee.department || ''}
                                    onChange={(e) => setEmployee({ ...employee, department: e.target.value })}
                                    placeholder="N/A"
                                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white' }}
                                />
                            ) : (
                                <p style={{ padding: '10px', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                    {employee.department || 'N/A'}
                                </p>
                            )}
                        </div>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chế độ làm việc:</label>
                            {isEditing ? (
                                <select
                                    value={employee.assigned_config_id || ''}
                                    onChange={(e) => setEmployee({ ...employee, assigned_config_id: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                                >
                                    <option value="">Hệ thống tự động</option>
                                    {configs.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <p style={{ padding: '10px', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                    {employee.assigned_config_id
                                        ? configs.find(c => c.id === parseInt(employee.assigned_config_id))?.name
                                        : 'Hệ thống tự động'}
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '8px', padding: '0 4px' }}>
                            <span style={{ color: '#94a3b8' }}>Ngày gia nhập:</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{new Date(employee.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>

                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button
                                    onClick={handleUpdate}
                                    disabled={updating}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: updating ? 0.7 : 1,
                                        borderBottom: '3px solid #059669',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Save size={16} />
                                    {updating ? 'Đang lưu...' : 'Lưu'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={updating}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#64748b',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: updating ? 0.7 : 1,
                                        borderBottom: '3px solid #475569',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <X size={16} />
                                    Hủy
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleEdit}
                                style={{
                                    marginTop: '10px',
                                    padding: '12px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    borderBottom: '3px solid #1d4ed8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    width: '100%'
                                }}
                            >
                                <Edit2 size={16} />
                                Chỉnh sửa hồ sơ
                            </button>
                        )}
                    </div>
                </div>



                {/* Right Column Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Summary Statistics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                        {[
                            {
                                label: 'Tổng ca làm',
                                value: processedAttendance.filter(l => l.status !== 'absent').length,
                                sub: `/${processedAttendance.length} ca theo lịch`,
                                color: '#3b82f6',
                                icon: Calendar
                            },
                            {
                                label: 'Vi phạm',
                                value: processedAttendance.filter(l => ['late', 'early', 'early_leave', 'late_and_early'].includes(l.status)).length,
                                sub: `${processedAttendance.filter(l => ['late', 'late_and_early'].includes(l.status)).length} muộn, ${processedAttendance.filter(l => ['early', 'early_leave', 'late_and_early'].includes(l.status)).length} sớm`,
                                color: '#f59e0b',
                                icon: AlertCircle
                            },
                            {
                                label: 'Vắng mặt',
                                value: processedAttendance.filter(l => l.status === 'absent').length,
                                sub: 'Không điểm danh',
                                color: '#ef4444',
                                icon: User
                            },
                            {
                                label: 'Tăng ca',
                                value: formatOvertime(processedAttendance.reduce((acc, curr) => acc + (curr.overtime || curr.overtime_minutes || 0), 0)),
                                sub: 'Tổng thời gian',
                                color: '#10b981',
                                icon: Clock
                            },
                        ].map((stat, idx) => (
                            <div key={idx} style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{stat.label}</div>
                                    <stat.icon size={20} color={stat.color} />
                                </div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white', marginBottom: '5px' }}>{stat.value}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{stat.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Logs Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Attendance History */}
                        <div style={{
                            background: '#1e293b',
                            borderRadius: '12px',
                            padding: '24px',
                            border: '1px solid #334155'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={22} color="#3b82f6" />
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Lịch sử điểm danh</h3>
                                </div>

                                {/* Date Filter */}
                                <DateFilter onDateChange={handleDateChange} />
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '12px 10px' }}>Ngày</th>
                                            <th style={{ padding: '12px 10px' }}>Ca làm việc</th>
                                            <th style={{ padding: '12px 10px' }}>Giờ vào</th>
                                            <th style={{ padding: '12px 10px' }}>Giờ ra</th>
                                            <th style={{ padding: '12px 10px' }}>Tổng thời gian</th>
                                            <th style={{ padding: '12px 10px' }}>Đánh giá</th>
                                            <th style={{ padding: '12px 10px' }}>Tăng ca</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedAttendance.map((log, idx) => {
                                            const statusInfo = getStatusInfo(log.status, log.shift_name, log.isAllDayAbsent);
                                            return (
                                                <tr key={idx} style={{
                                                    borderBottom: '1px solid #334155',
                                                    background: log.status === 'absent' ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                                                    transition: 'background 0.2s'
                                                }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.background = log.status === 'absent' ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}>
                                                    <td style={{ padding: '14px 10px', fontSize: '0.9rem' }}>
                                                        {new Date(log.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', color: '#3b82f6', fontWeight: 600 }}>{log.shift_name || '---'}</td>
                                                    <td style={{ padding: '14px 10px', fontWeight: log.check_in ? 600 : 400 }}>
                                                        {log.check_in ? new Date(log.check_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', fontWeight: log.check_out ? 600 : 400 }}>
                                                        {log.check_out ? new Date(log.check_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', fontWeight: 600, color: 'white' }}>
                                                        {(() => {
                                                            if (log.check_in && log.check_out) {
                                                                const diff = new Date(log.check_out).getTime() - new Date(log.check_in).getTime();
                                                                const minutes = Math.floor(diff / 60000);
                                                                const h = Math.floor(minutes / 60);
                                                                const m = minutes % 60;
                                                                return `${h}h ${m}m`;
                                                            }
                                                            return '---';
                                                        })()}
                                                    </td>
                                                    <td style={{ padding: '14px 10px' }}>
                                                        <span style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: statusInfo.bg,
                                                            color: statusInfo.color,
                                                            display: 'inline-block',
                                                            border: `1px solid ${statusInfo.color}20`
                                                        }}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 10px', fontWeight: 600, color: log.overtime > 0 ? '#10b981' : '#94a3b8' }}>
                                                        {formatOvertime(log.overtime)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {processedAttendance.length === 0 && (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                                <Calendar size={40} style={{ opacity: 0.1, marginBottom: '10px' }} /><br />
                                                Chưa có dữ liệu điểm danh trong 14 ngày qua
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Phone Usage History */}
                        <div style={{
                            background: '#1e293b',
                            borderRadius: '12px',
                            padding: '24px',
                            border: '1px solid #334155'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                <Phone size={22} color="#f59e0b" />
                                <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Vi phạm sử dụng điện thoại</h3>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '12px 10px' }}>Ngày</th>
                                            <th style={{ padding: '12px 10px' }}>Thời gian vi phạm</th>
                                            <th style={{ padding: '12px 10px' }}>Xử lý</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {phoneLogs.map((log, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ padding: '14px 10px' }}>{log.date}</td>
                                                <td style={{ padding: '14px 10px', fontWeight: 700, color: '#f59e0b' }}>
                                                    {Math.floor(log.phone_seconds / 60)}m {Math.round(log.phone_seconds % 60)}s
                                                </td>
                                                <td style={{ padding: '14px 10px' }}>
                                                    {log.phone_seconds > 60 ? (
                                                        <span style={{ color: '#ef4444', background: '#ef444410', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            <AlertCircle size={14} /> Vi phạm nặng
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#10b981', background: '#10b98110', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            <CheckCircle size={14} /> Cảnh báo nhẹ
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {phoneLogs.length === 0 && (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                                Không có ghi nhận vi phạm nào
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeDetail;
