import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, User, Phone, Clock, Calendar, CheckCircle, AlertCircle, Camera, Edit2, X, Save } from 'lucide-react';
import DateFilter from '../components/DateFilter';
import { useLanguage } from '../contexts/LanguageContext';
import CameraCapture from '../components/CameraCapture';

const EmployeeDetail = () => {
    const { t, language } = useLanguage();
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
    const [showCamera, setShowCamera] = useState(false);

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
            alert(t('update_success'));
            await fetchData();
            setIsEditing(false);
        } catch (e) {
            alert(t('update_error'));
        } finally {
            setUpdating(false);
        }
    };

    const handleImageFile = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        setUpdating(true);
        try {
            // Upload to new endpoint
            await api.post(`/employees/${employee.employee_id}/upload-image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(t('image_update_success'));
            fetchData(); // Reload data to show new image
            setShowCamera(false);
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.detail || t('image_update_error'));
        } finally {
            setUpdating(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        handleImageFile(e.target.files[0]);
    };

    const formatOvertime = (minutes: number) => {
        if (!minutes || minutes <= 0) return `0 ${t('minutes_label')}`;
        if (minutes < 60) return `${minutes} ${t('minutes_label')}`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h} ${t('hour_label')} ${m} ${t('minutes_label')}` : `${h} ${t('hour_label')}`;
    };


    const getStatusInfo = (status: string, shiftName?: string, isAllDayAbsent?: boolean) => {
        if (status === 'absent') {
            if (isAllDayAbsent) return { label: t('absent_all_day'), color: '#ef4444', bg: '#ef444420' };
            const name = shiftName?.toLowerCase() || '';
            let label = t('absent_general');
            if (name.includes('sáng')) label = t('absent_morning');
            else if (name.includes('chiều')) label = t('absent_afternoon');
            else if (name.includes('tối')) label = t('absent_evening');
            return { label, color: '#f87171', bg: '#ef444410' };
        }
        switch (status) {
            case 'on_time': return { label: t('status_sufficient'), color: '#10b981', bg: '#10b98120' };
            case 'late': return { label: t('status_go_late'), color: '#ef4444', bg: '#ef444420' };
            case 'early_leave': return { label: t('status_early'), color: '#f59e0b', bg: '#f59e0b20' };
            case 'late_and_early': return { label: t('status_late_early'), color: '#f59e0b', bg: '#f59e0b20' };
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

    if (loading) return <div style={{ textAlign: 'center', padding: '50px', background: '#0f172a', color: 'white', minHeight: '100vh' }}>{t('loading_data')}</div>;
    if (!employee) return <div style={{ textAlign: 'center', padding: '50px', background: '#0f172a', color: 'white', minHeight: '100vh' }}>{t('employee_not_found')}</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {showCamera && (
                <CameraCapture
                    onCapture={handleImageFile}
                    onClose={() => setShowCamera(false)}
                />
            )}

            {/* Header */}
            <div className="employee-detail-header" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => navigate('/employees')} style={{ padding: '10px', background: '#1e293b', border: '1px solid #334155', color: 'white', borderRadius: '8px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t('employee_detail_title')} {employee.full_name}</h2>
            </div>

            <div className="grid-employee-detail">
                {/* Profile Card */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155',
                    textAlign: 'center',
                    position: 'sticky',
                    top: '20px',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                }} className="employee-profile-card">
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
                                    src={`http://${window.location.hostname}:8000${employee.image_path}?t=${new Date().getTime()}`}
                                    alt={employee.full_name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <User size={60} color="#3b82f6" />
                            )}
                        </div>

                        {/* Camera Icon Overlay */}
                        <div style={{
                            position: 'absolute',
                            bottom: '0',
                            right: '0',
                            display: 'flex',
                            gap: '5px'
                        }}>
                            <button
                                onClick={() => setShowCamera(true)}
                                style={{
                                    background: '#10b981',
                                    borderRadius: '50%',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    border: 'none'
                                }}
                                title={t('take_photo')}
                                disabled={updating}
                            >
                                <Camera size={14} color="white" />
                            </button>
                            <label
                                htmlFor="image-upload"
                                style={{
                                    background: '#3b82f6',
                                    borderRadius: '50%',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                                title={t('update_image_label')}
                            >
                                <Edit2 size={14} color="white" />
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
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={employee.full_name}
                            onChange={(e) => setEmployee({ ...employee, full_name: e.target.value })}
                            style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '5px', textAlign: 'center', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white', width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0, wordBreak: 'break-word' }}>
                                {employee.full_name}
                            </h3>
                            <button
                                onClick={handleEdit}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '4px',
                                    color: '#3b82f6',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title={t('edit_info')}
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                    <p style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem', marginBottom: '20px', wordBreak: 'break-all' }}>{t('employee_id')}: {employee.employee_id}</p>

                    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid #334155', paddingTop: '20px', paddingLeft: '16px', paddingRight: '16px', width: '100%', boxSizing: 'border-box' }}>
                        <div>
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('position')}:</label>
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
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('department')}:</label>
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
                            <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('work_config')}:</label>
                            {isEditing ? (
                                <select
                                    value={employee.assigned_config_id || ''}
                                    onChange={(e) => setEmployee({ ...employee, assigned_config_id: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #3b82f6', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                                >
                                    <option value="">{t('system_default')}</option>
                                    {configs.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <p style={{ padding: '10px', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                    {employee.assigned_config_id
                                        ? configs.find(c => c.id === parseInt(employee.assigned_config_id))?.name
                                        : t('system_default')}
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '5px', fontSize: '0.8rem', marginTop: '12px', padding: '10px 16px 0 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ color: '#94a3b8' }}>{t('joined_date')}</span>
                            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{new Date(employee.created_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
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
                                    {updating ? t('saving') : t('save')}
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
                                    {t('cancel')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>



                {/* Right Column Content */}
                <div className="mobile-padding-zero" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Summary Statistics */}
                    <div className="grid-stats">
                        {[
                            {
                                label: t('total_shifts'),
                                value: processedAttendance.filter(l => l.status !== 'absent').length,
                                sub: `/${processedAttendance.length} ${t('scheduled_shifts')}`,
                                color: '#3b82f6',
                                icon: Calendar
                            },
                            {
                                label: t('violations'),
                                value: processedAttendance.filter(l => ['late', 'early', 'early_leave', 'late_and_early'].includes(l.status)).length,
                                sub: `${processedAttendance.filter(l => ['late', 'late_and_early'].includes(l.status)).length} ${t('late').toLowerCase()}, ${processedAttendance.filter(l => ['early', 'early_leave', 'late_and_early'].includes(l.status)).length} ${t('early_leave').toLowerCase()}`,
                                color: '#f59e0b',
                                icon: AlertCircle
                            },
                            {
                                label: t('absences'),
                                value: processedAttendance.filter(l => l.status === 'absent').length,
                                sub: t('not_checked_in'),
                                color: '#ef4444',
                                icon: User
                            },
                            {
                                label: t('overtime_hours'),
                                value: formatOvertime(processedAttendance.reduce((acc, curr) => acc + (curr.overtime || curr.overtime_minutes || 0), 0)),
                                sub: t('total_time'),

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
                            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Clock size={22} color="#3b82f6" />
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('attendance_history_title')}</h3>
                                </div>

                                {/* Date Filter */}
                                <DateFilter onDateChange={handleDateChange} />
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '12px 10px' }}>{t('date')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('shift')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('check_in')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('check_out')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('total_time')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('evaluation')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('overtime_hours')}</th>
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
                                                        {new Date(log.date).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', color: '#3b82f6', fontWeight: 600 }}>{log.shift_name || '---'}</td>
                                                    <td style={{ padding: '14px 10px', fontWeight: log.check_in ? 600 : 400 }}>
                                                        {log.check_in ? new Date(log.check_in).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '---'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', fontWeight: log.check_out ? 600 : 400 }}>
                                                        {log.check_out ? new Date(log.check_out).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '---'}
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
                                                {t('no_attendance')}
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
                                <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('phone_violations_title')}</h3>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #334155', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            <th style={{ padding: '12px 10px' }}>{t('date')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_violation_duration')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_action')}</th>
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
                                                            <AlertCircle size={14} /> {t('severe_violation')}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#10b981', background: '#10b98110', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            <CheckCircle size={14} /> {t('mild_warning')}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {phoneLogs.length === 0 && (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                                {t('no_violations')}
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
