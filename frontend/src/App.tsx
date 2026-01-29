import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeDetail from './pages/EmployeeDetail';
import Settings from './pages/Settings';
import ShiftManagement from './pages/ShiftManagement';
import PresenceLogs from './pages/PresenceLogs';
import AttendanceCalculator from './pages/AttendanceCalculator';
import Layout from './components/Layout';
import api from './services/api';

interface User {
    username: string;
    role: string;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await api.get('/me');
                setCurrentUser(res.data);
                setIsAuthenticated(true);
            } catch (e) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const handleLoginSuccess = () => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
            setIsAuthenticated(true);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
                <p>Đang tải...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <BrowserRouter>
            <Layout currentUser={currentUser}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/presence-logs" element={<PresenceLogs />} />
                    <Route path="/employees/:id" element={<EmployeeDetail />} />
                    {currentUser?.role === 'admin' && (
                        <>
                            <Route path="/employees" element={<EmployeeManagement />} />
                            <Route path="/shift-configs" element={<ShiftManagement />} />
                            <Route path="/attendance-calculator" element={<AttendanceCalculator />} />
                            <Route path="/users" element={<UserManagement />} />
                            <Route path="/settings" element={<Settings />} />
                        </>
                    )}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}

export default App;
