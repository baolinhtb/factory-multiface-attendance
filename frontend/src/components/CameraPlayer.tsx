import React, { useEffect, useState, useRef } from 'react';
import { Camera, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CameraPlayerProps {
    camera: {
        id: number;
        name: string;
        is_active: boolean;
    };
    onAlert?: (msg: string, type: string) => void;
    playSound?: () => void;
}

const CameraPlayer = ({ camera, onAlert, playSound }: CameraPlayerProps) => {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLImageElement>(null);
    const [isAlerting, setIsAlerting] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);

    // Track previous states to avoid duplicate logs
    const prevFireStateRef = useRef(false);
    const prevUnknownStateRef = useRef(false);
    const prevPhoneStateRef = useRef<string[]>([]);
    const prevPoseStateRef = useRef(false);

    useEffect(() => {
        if (!camera.is_active) return;

        const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/video?camera_id=${camera.id}`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.error) {
                console.warn(`Camera ${camera.id} error:`, data.error);
                return;
            }

            if (videoRef.current && data.image) {
                videoRef.current.src = `data:image/jpeg;base64,${data.image}`;
            }

            let alerting = false;

            // Detections
            if (data.has_unknown && !prevUnknownStateRef.current) {
                onAlert?.(`${camera.name}: ${t('unknown_detected')}`, "error");
                playSound?.();
            }
            prevUnknownStateRef.current = data.has_unknown;

            if (data.has_phone) {
                // Determine if we have new violators compared to previous frame
                const currentViolators = data.phone_violators || [];
                const prevViolators = prevPhoneStateRef.current || [];

                // Only alert if there are names we haven't alerted for in this "session"
                // or if it's the first detection
                const newNames = currentViolators.filter((name: string) => !prevViolators.includes(name));

                if (newNames.length > 0) {
                    const namesStr = newNames.join(", ");
                    onAlert?.(`${camera.name}: Phát hiện ${namesStr} sử dụng điện thoại!`, "error");
                    playSound?.();
                }
                prevPhoneStateRef.current = currentViolators;
            } else {
                prevPhoneStateRef.current = [];
            }

            if (data.has_fire && !prevFireStateRef.current) {
                onAlert?.(`${camera.name}: ${t('fire_detected')}`, "error");
                playSound?.();
            } else if (!data.has_fire && prevFireStateRef.current) {
                onAlert?.(`${camera.name}: ${t('fire_cleared')}`, "success");
            }
            prevFireStateRef.current = data.has_fire;

            if (data.has_unsafe_pose && !prevPoseStateRef.current) {
                onAlert?.(`${camera.name}: ${t('pose_detected_warning')}`, "error");
                playSound?.();
            } else if (!data.has_unsafe_pose && prevPoseStateRef.current) {
                onAlert?.(`${camera.name}: ${t('pose_cleared')}`, "success");
            }
            prevPoseStateRef.current = data.has_unsafe_pose;

            if (data.has_unknown || data.has_phone || data.has_fire || data.has_unsafe_pose) {
                alerting = true;
            }
            setIsAlerting(alerting);
        };

        return () => {
            ws.close();
        };
    }, [camera.id, camera.is_active, camera.name, onAlert, playSound, t]);

    if (!camera.is_active) return null;

    return (
        <div style={{
            position: isMaximized ? 'fixed' : 'relative',
            top: isMaximized ? 0 : 'auto',
            left: isMaximized ? 0 : 'auto',
            right: isMaximized ? 0 : 'auto',
            bottom: isMaximized ? 0 : 'auto',
            width: isMaximized ? '100vw' : '100%',
            height: isMaximized ? '100vh' : 'auto',
            zIndex: isMaximized ? 2000 : 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: isMaximized ? 'black' : 'transparent',
            transition: 'all 0.3s'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
                <Camera size={18} color="#3b82f6" />
                <h4 style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{camera.name}</h4>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isAlerting && (
                        <span style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            animation: 'pulse 1s infinite'
                        }}>
                            <AlertTriangle size={12} /> {t('warning')}
                        </span>
                    )}
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                    >
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </div>
            <div style={{
                aspectRatio: '16/9',
                background: 'black',
                borderRadius: isMaximized ? '0' : '12px',
                overflow: 'hidden',
                border: isAlerting ? '2px solid #ef4444' : '1px solid #334155',
                boxShadow: isAlerting ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none',
                position: 'relative',
                flex: isMaximized ? 1 : 'none'
            }}>
                <img
                    ref={videoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    alt={camera.name}
                />
            </div>
        </div>
    );
};

export default CameraPlayer;
