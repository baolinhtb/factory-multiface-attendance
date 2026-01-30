import { useState } from 'react';
import { Calculator, Users, Calendar, CheckCircle, X, Clock, FileSpreadsheet, Download } from 'lucide-react';
import api from '../services/api';
import DateFilter from '../components/DateFilter';
import { useLanguage } from '../contexts/LanguageContext';

// Helper functions
const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateTime = (dateTimeStr: string, locale: string = 'vi-VN') => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};



const AttendanceCalculator = () => {
    const { t, language } = useLanguage();

    const formatOvertime = (minutes: number) => {
        if (minutes < 60) {
            return `${minutes} ${t('minutes_label')}`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}${t('minutes_label')}` : `${hours} ${t('hour_label')}`;
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; color: string; bg: string }> = {
            'on_time': { label: t('status_on_time'), color: '#10b981', bg: '#10b98120' },
            'late': { label: t('status_late'), color: '#ef4444', bg: '#ef444420' },
            'early': { label: t('status_early'), color: '#f59e0b', bg: '#f59e0b20' },
            'late_and_early': { label: t('status_late_early'), color: '#dc2626', bg: '#dc262620' }
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

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [startDate, setStartDate] = useState<string>(getLocalDateString());
    const [endDate, setEndDate] = useState<string>(getLocalDateString());

    const [employeeId, setEmployeeId] = useState<string>('');
    const [mode, setMode] = useState<'single' | 'all'>('single');
    const [showOvertimeModal, setShowOvertimeModal] = useState(false);
    const [selectedOvertimeSessions, setSelectedOvertimeSessions] = useState<any[]>([]);

    // Date change callback from DateFilter component
    const handleDateChange = (newStartDate: string, newEndDate: string) => {
        setStartDate(newStartDate);
        setEndDate(newEndDate);
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
        } catch (e: any) {
            console.error('Error calculating attendance', e);
            alert(e.response?.data?.detail || t('error_calculating'));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const params = `start_date=${startDate}&end_date=${endDate}${mode === 'single' ? `&employee_id=${employeeId}` : ''}`;
            const response = await api.get(`/export-attendance?${params}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `cham_cong_${startDate}_den_${endDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (e) {
            console.error('Error exporting excel', e);
            alert(t('error_exporting'));
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
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{t('attendance_calculator_title')}</h2>
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
                    <strong style={{ color: '#fff' }}>{t('function')}</strong> {t('function_desc')}
                </p>
                <p style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#fff' }}>{t('logic')}</strong>
                </p>
                <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                    <li><strong>Check-in:</strong> {t('logic_checkin')}</li>
                    <li><strong>Check-out:</strong> {t('logic_checkout')}</li>
                    <li><strong>{t('status')}:</strong> {t('logic_status')}</li>
                    <li><strong>{t('overtime_label')}:</strong> {t('logic_overtime')}</li>
                </ul>
            </div>

            {/* Calculator Form */}
            <div style={{
                background: '#1e293b',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #334155'
            }}>
                <h3 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '20px' }}>{t('calculation')}</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Mode Selection */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            {t('mode')}
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
                                {t('single_employee')}
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
                                {t('all_employees_mode')}
                            </button>
                        </div>
                    </div>

                    {/* Employee ID (only for single mode) */}
                    {mode === 'single' && (
                        <div>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                                {t('employee_code')}
                            </label>
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder={t('id_placeholder')}
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

                    {/* Date Filter Component */}
                    <DateFilter onDateChange={handleDateChange} initialFilterValue="today" />

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <button
                            onClick={handleCalculate}
                            disabled={loading || (mode === 'single' && !employeeId)}
                            style={{
                                flex: 2,
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
                            {loading ? t('calculating') : t('calculate_attendance')}
                        </button>

                        <button
                            onClick={handleExport}
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: '14px 24px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                            title={t('export_excel_btn')}
                        >
                            <FileSpreadsheet size={20} />
                            <span className="desktop-only">{t('export_excel_btn')}</span>
                        </button>
                    </div>
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
                            {t('results_title')} - {startDate} → {endDate}
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
                                    <div style={{ fontWeight: 600, color: '#fff' }}>{t('employee')} {result.employee_id}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                        {t('total_shifts_label')} {result.shifts.length}
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
                                    {t('no_attendance_data')}
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
                                                        {t('check_in_label')}
                                                    </div>
                                                    <div style={{ fontWeight: 600, color: shift.check_in ? '#10b981' : '#64748b' }}>
                                                        {shift.check_in ? formatDateTime(shift.check_in, language === 'vi' ? 'vi-VN' : 'en-US') : t('not_checked_in_label')}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                        {t('check_out_label')}
                                                    </div>
                                                    <div style={{ fontWeight: 600, color: shift.check_out ? '#10b981' : '#64748b' }}>
                                                        {shift.check_out ? formatDateTime(shift.check_out, language === 'vi' ? 'vi-VN' : 'en-US') : t('not_checked_out')}
                                                    </div>
                                                </div>

                                                {shift.overtime > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                                                            {t('overtime_label')}
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
                                {t('processed_label')} <strong style={{ color: '#fff' }}>{result.processed}</strong>
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
                                            <th style={{ padding: '12px 10px' }}>{t('col_emp_id')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_shift')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_checkin')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_checkout')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_status')}</th>
                                            <th style={{ padding: '12px 10px' }}>{t('col_overtime')}</th>
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
                                                        {shift.check_in ? formatDateTime(shift.check_in, language === 'vi' ? 'vi-VN' : 'en-US') : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '14px 10px', color: shift.check_out ? '#10b981' : '#64748b' }}>
                                                        {shift.check_out ? formatDateTime(shift.check_out, language === 'vi' ? 'vi-VN' : 'en-US') : 'N/A'}
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
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{t('overtime_detail')}</h3>
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
                                {t('no_overtime_data')}
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
                                                    {t('overtime_session')} #{idx + 1}
                                                </div>
                                                <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                                    {formatDateTime(session.start, language === 'vi' ? 'vi-VN' : 'en-US')} → {formatDateTime(session.end, language === 'vi' ? 'vi-VN' : 'en-US')}
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
                                        {t('total_overtime')}
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
