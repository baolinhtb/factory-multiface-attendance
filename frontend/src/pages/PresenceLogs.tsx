import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Filter, Download } from 'lucide-react';
import api from '../services/api';
import DateFilter from '../components/DateFilter';
import { useLanguage } from '../contexts/LanguageContext';

const PresenceLogs = () => {
    const { t, language } = useLanguage();
    const [logs, setLogs] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
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

            if (startDate && endDate) {
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

    const handleDateChange = (newStartDate: string, newEndDate: string) => {
        setStartDate(newStartDate);
        setEndDate(newEndDate);
    };

    const handleApplyFilter = () => {
        fetchLogs();
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
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
                label: t('enter'),
                color: '#10b981',
                bg: '#10b98120'
            };
        } else {
            return {
                label: t('exit'),
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
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{t('presence_history')}</h2>
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
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{t('filter')}</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    {/* Employee Filter */}
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '8px' }}>
                            {t('employee_label')}
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
                            <option value="">{t('all_employees')}</option>
                            {employees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.full_name} ({emp.employee_id})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Filter Component */}
                    <DateFilter onDateChange={handleDateChange} initialFilterValue="today" />
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
                    {t('apply_filter')}
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
                            {t('list_records')} ({logs.length} {t('records')})
                        </h3>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        {t('loading_data')}
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

                                    <th style={{ padding: '12px 10px' }}>{t('time')}</th>
                                    <th style={{ padding: '12px 10px' }}>{t('employee_label')}</th>
                                    <th style={{ padding: '12px 10px' }}>{t('employee_id')}</th>
                                    <th style={{ padding: '12px 10px' }}>{t('status')}</th>
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
                                            {t('no_data_filter')}
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
