import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Camera, AlertTriangle, Phone, History, Clock } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState<any[]>([]);
    const [logs, setLogs] = useState<{ msg: string, type: string, time: string }[]>([]);
    const [isAlerting, setIsAlerting] = useState(false);
    const videoRef = useRef<HTMLImageElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const lastSoundTimeRef = useRef(0);
    const [alarmEnabled, setAlarmEnabled] = useState(true);

    const addLog = (msg: string, type: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [{ msg, type, time }, ...prev].slice(0, 50));
    };

    const playSound = () => {
        if (!alarmEnabled) return;
        if (Date.now() - lastSoundTimeRef.current < 1500) return;
        lastSoundTimeRef.current = Date.now();

        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/daily-stats');
                setStats(res.data);
            } catch (e) { }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);

        const ws = new WebSocket('ws://127.0.0.1:8000/ws/video');
        ws.onmessage = (event) => {
            // ... existing ws logic ...
            const data = JSON.parse(event.data);
            if (videoRef.current) {
                videoRef.current.src = `data:image/jpeg;base64,${data.image}`;
            }

            setAlarmEnabled(data.enable_alarm);

            let alerting = false;
            if (data.has_unknown) {
                alerting = true;
                addLog("Phát hiện người lạ!", "error");
                playSound();
            }
            if (data.has_phone) {
                alerting = true;
                addLog("Phát hiện sử dụng điện thoại!", "error");
                playSound();
            }
            setIsAlerting(alerting);
        };

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, []);

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
            {/* Left Wall: Camera & Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #334155',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <Camera size={20} color="#3b82f6" />
                        <h3 style={{ fontWeight: 600 }}>Giám sát trực tiếp</h3>
                        {isAlerting && (
                            <span style={{
                                marginLeft: 'auto',
                                background: '#ef4444',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                animation: 'pulse 1s infinite'
                            }}>
                                <AlertTriangle size={14} /> CẢNH BÁO
                            </span>
                        )}
                    </div>
                    <div style={{
                        aspectRatio: '680/480',
                        background: '#0f172a',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: isAlerting ? '3px solid #ef4444' : '1px solid #334155',
                        boxShadow: isAlerting ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none',
                        transition: 'all 0.3s'
                    }}>
                        <img ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Stream" />
                    </div>
                </div>

                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #334155',
                    height: '250px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <History size={20} color="#3b82f6" />
                        <h3 style={{ fontWeight: 600 }}>Cảnh báo hệ thống</h3>
                    </div>
                    <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', fontSize: '0.875rem' }}>
                        {logs.map((log, idx) => (
                            <div key={idx} style={{
                                padding: '10px 0',
                                borderBottom: '1px solid #334155',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{ color: log.type === 'error' ? '#ef4444' : '#10b981' }}>{log.msg}</span>
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{log.time}</span>
                            </div>
                        ))}
                        {logs.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', marginTop: '20px' }}>Chưa có cảnh báo nào</div>}
                    </div>
                </div>
            </div>

            {/* Right Wall: Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{
                    background: '#1e293b',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #334155',
                    minHeight: '400px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <Phone size={20} color="#f59e0b" />
                        <h3 style={{ fontWeight: 600 }}>Thống kê trong ngày</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.map((s, idx) => (
                            <div key={idx} style={{
                                background: '#0f172a',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid #334155'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: s.status === 'on_time' ? '#10b98120' : (s.status === 'early_leave' ? '#f59e0b20' : (s.check_in ? '#ef444420' : '#47556920')),
                                        color: s.status === 'on_time' ? '#10b981' : (s.status === 'early_leave' ? '#f59e0b' : (s.check_in ? '#ef4444' : '#94a3b8'))
                                    }}>
                                        {s.check_in ? (
                                            s.status === 'on_time' ? 'Đúng giờ' :
                                                s.status === 'late' ? 'Muộn' :
                                                    s.status === 'early_leave' ? 'Về sớm' : 'Muộn/Sớm'
                                        ) : 'Chưa đến'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} /> {s.check_in ? new Date(s.check_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: s.phone_seconds > 0 ? '#f59e0b' : '#94a3b8' }}>
                                        <Phone size={12} /> {s.phone_seconds < 60 ? `${Math.round(s.phone_seconds)}s` : `${Math.floor(s.phone_seconds / 60)}m`}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {stats.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>Chưa có dữ liệu hôm nay</div>}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
        </div>
    );
};

export default Dashboard;
