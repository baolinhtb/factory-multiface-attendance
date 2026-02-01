import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Camera, AlertTriangle, Phone, History, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Dashboard = () => {
    const { t } = useLanguage();
    const [stats, setStats] = useState<any[]>([]);
    const [logs, setLogs] = useState<{ msg: string, type: string, time: string }[]>([]);
    const [isAlerting, setIsAlerting] = useState(false);
    const videoRef = useRef<HTMLImageElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const lastSoundTimeRef = useRef(0);
    const [alarmEnabled, setAlarmEnabled] = useState(true);

    // Track previous states to avoid duplicate logs
    const prevFireStateRef = useRef(false);
    const prevUnknownStateRef = useRef(false);
    const prevPhoneStateRef = useRef(false);
    const prevPoseStateRef = useRef(false);

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

        const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/video`);
        ws.onmessage = (event) => {
            // ... existing ws logic ...
            const data = JSON.parse(event.data);
            if (videoRef.current) {
                videoRef.current.src = `data:image/jpeg;base64,${data.image}`;
            }

            setAlarmEnabled(data.enable_alarm);


            let alerting = false;

            // Unknown detection - log only on state change
            if (data.has_unknown && !prevUnknownStateRef.current) {
                addLog(t('unknown_detected'), "error");
                playSound();
            }
            prevUnknownStateRef.current = data.has_unknown;

            // Phone detection - log only on state change
            if (data.has_phone && !prevPhoneStateRef.current) {
                addLog(t('phone_detected'), "error");
                playSound();
            }
            prevPhoneStateRef.current = data.has_phone;

            // Fire detection - log only on state change
            if (data.has_fire && !prevFireStateRef.current) {
                addLog(t('fire_detected'), "error");
                playSound();
            } else if (!data.has_fire && prevFireStateRef.current) {
                // Fire disappeared
                addLog(t('fire_cleared'), "success");
            }
            prevFireStateRef.current = data.has_fire;

            // Pose detection - log only on state change
            if (data.has_unsafe_pose && !prevPoseStateRef.current) {
                addLog(t('pose_detected_warning'), "error");
                playSound();
            } else if (!data.has_unsafe_pose && prevPoseStateRef.current) {
                // Pose corrected
                addLog(t('pose_cleared'), "success");
            }
            prevPoseStateRef.current = data.has_unsafe_pose;

            // Set alerting if any current detection
            if (data.has_unknown || data.has_phone || data.has_fire || data.has_unsafe_pose) {
                alerting = true;
            }

            setIsAlerting(alerting);
        };

        return () => {
            ws.close();
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="grid-dashboard">
            {/* Left Wall: Camera & Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingLeft: '4px' }}>
                        <Camera size={20} color="#3b82f6" />
                        <h3 style={{ fontWeight: 600 }}>{t('monitoring')}</h3>
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
                                <AlertTriangle size={14} /> {t('warning')}
                            </span>
                        )}
                    </div>
                    <div style={{
                        aspectRatio: '680/480',
                        background: 'black',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: isAlerting ? '3px solid #ef4444' : '1px solid #334155',
                        boxShadow: isAlerting ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none',
                        transition: 'all 0.3s'
                    }}>
                        <img ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Stream" />
                    </div>
                </div>

                <div style={{
                    height: '250px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingLeft: '4px' }}>
                        <History size={20} color="#3b82f6" />
                        <h3 style={{ fontWeight: 600 }}>{t('system_alert')}</h3>
                    </div>
                    <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', fontSize: '0.875rem', paddingRight: '4px' }}>
                        {logs.map((log, idx) => (
                            <div key={idx} style={{
                                padding: '8px 4px',
                                borderBottom: '1px solid #1e293b',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{ color: log.type === 'error' ? '#ef4444' : '#10b981' }}>{log.msg}</span>
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{log.time}</span>
                            </div>
                        ))}
                        {logs.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', marginTop: '20px' }}>{t('no_alert')}</div>}
                    </div>
                </div>
            </div>

            {/* Right Wall: Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                    minHeight: '400px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingLeft: '4px' }}>
                        <Phone size={20} color="#f59e0b" />
                        <h3 style={{ fontWeight: 600 }}>{t('daily_stats')}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {stats.map((s, idx) => (
                            <div key={idx} style={{
                                padding: '12px 4px',
                                borderBottom: '1px solid #1e293b' // Very subtle separator
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
                                            s.status === 'on_time' ? t('on_time') :
                                                s.status === 'late' ? t('late') :
                                                    s.status === 'early_leave' ? t('early_leave') : t('late_early')
                                        ) : t('not_arrived')}
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
                        {stats.length === 0 && <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>{t('no_data')}</div>}
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
