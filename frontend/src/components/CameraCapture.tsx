import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError(t('camera_error') || 'Không thể truy cập camera. Vui lòng kiểm tra quyền trình duyệt.');
        }
    };

    useEffect(() => {
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                // Flip if using front camera (standard mirror effect)
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setCapturedImage(dataUrl);
            }
        }
    };

    const handleUsePhoto = () => {
        if (capturedImage) {
            // Convert dataUrl to File
            fetch(capturedImage)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "captured_face.jpg", { type: "image/jpeg" });
                    onCapture(file);
                });
        }
    };

    const retake = () => {
        setCapturedImage(null);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '640px',
                background: '#1e293b',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderBottom: '1px solid #334155'
                }}>
                    <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Camera size={20} />
                        {capturedImage ? 'Xem lại ảnh' : 'Chụp ảnh nhân viên'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8', padding: '4px' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content */}
                <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {error ? (
                        <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>{error}</div>
                    ) : (
                        <>
                            {capturedImage ? (
                                <img src={capturedImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Captured" />
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                />
                            )}
                        </>
                    )}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Footer Controls */}
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    {!capturedImage ? (
                        <button
                            onClick={capturePhoto}
                            style={{
                                background: '#3b82f6',
                                color: 'white',
                                padding: '12px 24px',
                                borderRadius: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <Camera size={20} />
                            {t('capture') || 'Chụp'}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={retake}
                                style={{
                                    background: '#475569',
                                    color: 'white',
                                    padding: '12px 24px',
                                    borderRadius: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <RefreshCw size={20} />
                                {t('retake_photo') || 'Chụp lại'}
                            </button>
                            <button
                                onClick={handleUsePhoto}
                                style={{
                                    background: '#10b981',
                                    color: 'white',
                                    padding: '12px 24px',
                                    borderRadius: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <Check size={20} />
                                {t('use_photo') || 'Sử dụng ảnh này'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
                Đảm bảo khuôn mặt nằm trong khung hình và đủ ánh sáng
            </p>
        </div>
    );
};

export default CameraCapture;
