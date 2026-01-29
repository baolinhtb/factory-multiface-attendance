import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { UserPlus, Search, Building2, Briefcase, Eye, Trash2, Calendar } from 'lucide-react';

const EmployeeManagement = () => {
    const [employees, setEmployees] = useState<any[]>([]);
    const [employeeId, setEmployeeId] = useState('');
    const [fullName, setFullName] = useState('');
    const [position, setPosition] = useState('');
    const [department, setDepartment] = useState('');
    const [assignedConfigId, setAssignedConfigId] = useState<string>('');
    const [configs, setConfigs] = useState<any[]>([]);
    const [photo, setPhoto] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            setEmployees(res.data);
        } catch (e) {
            console.error("Error fetching employees", e);
        }
    };

    const fetchConfigs = async () => {
        try {
            const res = await api.get('/shift-configs');
            setConfigs(res.data);
        } catch (e) { }
    };

    useEffect(() => {
        fetchEmployees();
        fetchConfigs();
    }, []);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo) return alert("Vui lòng chọn ảnh nhân viên");

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
            alert("Thành công: Nhân viên đã được đăng ký và metadata khuôn mặt đã được lưu.");
            setEmployeeId('');
            setFullName('');
            setPosition('');
            setDepartment('');
            setAssignedConfigId('');
            setPhoto(null);
            fetchEmployees();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Lỗi khi thêm nhân viên');
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="grid-dashboard">
                {/* Employee List Section */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Của danh sách nhân viên</h3>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm nhân viên..."
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
                                    <th style={{ padding: '12px' }}>ID Nhân viên</th>
                                    <th style={{ padding: '12px' }}>Họ và Tên</th>
                                    <th style={{ padding: '12px' }}>Chức vụ / Phòng ban</th>
                                    <th style={{ padding: '12px' }}>Ngày tạo</th>
                                    <th style={{ padding: '12px', textAlign: 'right' }}>Thao tác</th>
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
                                            {new Date(emp.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td style={{ padding: '15px 12px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => navigate(`/employees/${emp.employee_id}`)}
                                                style={{ padding: '6px', color: '#3b82f6', background: 'transparent', marginRight: '10px' }}
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Không tìm thấy nhân viên nào</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Registration Section */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #334155',
                    height: 'fit-content'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <UserPlus size={24} color="#10b981" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Đăng ký nhân viên mới</h3>
                    </div>

                    <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>ID Nhân viên (Duy nhất)</label>
                            <input
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                style={{ width: '100%' }}
                                placeholder="Ví dụ: NV001"
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Họ và Tên</label>
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
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Chức vụ</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Phòng ban</label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Chế độ làm việc</label>
                            <select
                                value={assignedConfigId}
                                onChange={(e) => setAssignedConfigId(e.target.value)}
                                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: 'white', borderRadius: '4px' }}
                            >
                                <option value="">Mặc định hệ thống</option>
                                {configs.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '6px', color: '#94a3b8' }}>Ảnh chân dung (Để AI nhận diện)</label>
                            <input
                                type="file"
                                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                                accept="image/*"
                                style={{ width: '100%', fontSize: '0.8rem' }}
                                required
                            />
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
                            {loading ? 'Đang xử lý AI...' : 'Đăng Ký Nhân Viên'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EmployeeManagement;
