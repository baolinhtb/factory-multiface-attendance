import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { UserPlus, Search, Building2, Briefcase, Eye, Trash2, Calendar, Camera } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import CameraCapture from '../components/CameraCapture';

const EmployeeManagement = () => {
    const { t } = useLanguage();
    const [employees, setEmployees] = useState<any[]>([]);
    const [employeeId, setEmployeeId] = useState('');
    const [fullName, setFullName] = useState('');
    const [position, setPosition] = useState('');
    const [department, setDepartment] = useState('');
    const [assignedConfigId, setAssignedConfigId] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            setEmployees(res.data);
        } catch (e) {
            console.error("Error fetching employees", e);
            // Optional: alert(t('error_fetching_employees'));
        }
    };

    const fetchConfigs = async () => {
        try {
            const res = await api.get('/shifts/configs');
            setConfigs(res.data);
        } catch (e) { }
    };

    useEffect(() => {
        fetchEmployees();
        fetchConfigs();
    }, []);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) return alert(t('photo_required'));

        setLoading(true);
        const formData = new FormData();
        formData.append('employee_id', employeeId);
        formData.append('full_name', fullName);
        formData.append('position', position);
        formData.append('department', department);
        formData.append('assigned_config_id', assignedConfigId);
        formData.append('file', photo);

        try {
            await api.post('/employees', formData);
            alert(t('employee_registered_success'));
            setEmployeeId('');
            setFullName('');
            setPosition('');
            setDepartment('');
            setAssignedConfigId('');
            setPhoto(null);
            setPhotoPreview(null);
            fetchEmployees();
        } catch (err: any) {
            alert(err.response?.data?.detail || t('error_add_employee'));
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleCapture = (file: File) => {
        setPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(file);
        setShowCamera(false);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {showCamera && (
                <CameraCapture
                    onCapture={handleCapture}
                    onClose={() => setShowCamera(false)}
                />
            )}

            <div className="grid-dashboard">
                {/* Employee List Section */}
                <div style={{
                    padding: '0 0 24px 0',
                    borderBottom: '1px solid #334155'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('employee_list')}</h3>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder={t('employee_search_placeholder')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '35px', borderRadius: '20px', width: '250px' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    <th style={{ padding: '12px' }}>{t('employee_id')}</th>
                                    <th style={{ padding: '12px' }}>{t('full_name')}</th>
                                    <th style={{ padding: '12px' }}>{t('position_department')}</th>
                                    <th style={{ padding: '12px' }}>{t('created_at')}</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid #334155' }}>
                                        <td style={{ padding: '15px 12px', fontWeight: 600 }}>{emp.employee_id}</td>
                                        <td style={{ padding: '15px 12px' }}>{emp.full_name}</td>
                                        <td style={{ padding: '15px 12px' }}>
                                            <div style={{ fontSize: '0.85rem' }}>{emp.position || 'N/A'}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.department || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '15px 12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            {new Date(emp.created_at.replace(' ', 'T')).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td style={{ padding: '15px 12px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => navigate(`/employees/${emp.employee_id}`)}
                                                style={{ padding: '6px', color: '#3b82f6', background: 'transparent', marginRight: '10px' }}
                                                title={t('view_detail')}
                                            >
                                                <Eye size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>{t('no_employees_found')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Registration Section */}
                <div style={{
                    padding: '24px 0',
                    height: 'fit-content'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <UserPlus size={24} color="#10b981" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('register_new_employee')}</h3>
                    </div>

                    <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('employee_id')} (Unique)</label>
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                style={{ width: '100%' }}
                                placeholder={t('id_placeholder')}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('full_name')}</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                style={{ width: '100%' }}
                                required
                            />
                        </div>
                        <div className="grid-form-2col">
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('position')}</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('department')}</label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('work_config')}</label>
                            <select
                                value={assignedConfigId}
                                onChange={(e) => setAssignedConfigId(e.target.value)}
                                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '4px' }}
                            >
                                <option value="">{t('system_default')}</option>
                                {configs.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>{t('portrait_photo')}</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                                <input
                                    type="file"
                                    onChange={handlePhotoChange}
                                    accept="image/*"
                                    style={{ flex: 1, fontSize: '0.8rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: '#1e293b',
                                        border: '1px solid #3b82f6',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        color: '#3b82f6',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <Camera size={16} />
                                    {t('take_photo')}
                                </button>
                            </div>

                            {photoPreview && (
                                <div style={{
                                    width: '100%',
                                    height: '150px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid #334155',
                                    background: '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <img src={photoPreview} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="Preview" />
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '10px',
                                padding: '12px',
                                background: '#3b82f6',
                                color: 'white',
                                opacity: loading ? 0.7 : 1,
                                fontWeight: 600
                            }}
                        >
                            {loading ? t('processing_ai') : t('register_employee')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EmployeeManagement;
