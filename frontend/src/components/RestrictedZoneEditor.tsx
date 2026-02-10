
import React, { useState, useEffect, useRef } from 'react';
import { MousePointer2, Plus, Trash2, Camera, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { getApiBaseUrl } from '../services/api';

interface Point {
    x: number; // 0-1 relative
    y: number; // 0-1 relative
}

type Polygon = Point[];

interface RestrictedZoneEditorProps {
    cameraId: number;
    initialZones: Polygon[];
    onZonesChange: (zones: Polygon[]) => void;
}

const RestrictedZoneEditor: React.FC<RestrictedZoneEditorProps> = ({ cameraId, initialZones, onZonesChange }) => {
    const [zones, setZones] = useState<Polygon[]>(initialZones || []);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'view' | 'draw' | 'edit'>('view');
    const [activePolyIdx, setActivePolyIdx] = useState<number | null>(null);
    const [draggedPoint, setDraggedPoint] = useState<{ polyIdx: number, ptIdx: number } | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ polyIdx: number, ptIdx: number } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Load Snapshot
    const fetchSnapshot = async () => {
        setIsLoadingImage(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const url = `${getApiBaseUrl()}/cameras/${cameraId}/snapshot`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const img = new Image();
            img.src = objectUrl;
            img.onload = () => {
                imageRef.current = img;
                setBackgroundImage(objectUrl);
                draw();
            };
            img.onerror = () => {
                setError("Không thể hiển thị ảnh snapshot. Vui lòng thử lại.");
            };
        } catch (e: any) {
            console.error("Failed to fetch snapshot:", e);
            setError(`Lỗi: ${e.message}. Đảm bảo camera đang hoạt động.`);
        } finally {
            setIsLoadingImage(false);
        }
    };

    useEffect(() => {
        if (cameraId) fetchSnapshot();
        return () => {
            if (backgroundImage) URL.revokeObjectURL(backgroundImage);
        };
    }, [cameraId]);

    // Handle Resize
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => draw());
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [backgroundImage]);

    // Redraw Canvas
    useEffect(() => {
        draw();
    }, [zones, backgroundImage, mode, hoveredPoint, activePolyIdx]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = imageRef.current;
        if (img && containerRef.current) {
            // Force Canvas Aspect Ratio to Match Image
            const containerWidth = containerRef.current.clientWidth;
            const scale = containerWidth / img.width;

            // Critical: Match canvas internal resolution to CSS display size to avoid coordinate drift
            canvas.width = containerWidth;
            canvas.height = img.height * scale;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawPolygons(ctx, canvas.width, canvas.height);
        } else {
            // Placeholder
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width || 640, canvas.height || 360);
            ctx.fillStyle = '#4b5563';
            ctx.textAlign = 'center';
            ctx.font = '14px Inter, system-ui, sans-serif';
            ctx.fillText(error || "Chưa có ảnh nền. Vui lòng nhấn 'Chụp ảnh mới'.", (canvas.width || 640) / 2, (canvas.height || 360) / 2);
        }
    };

    const drawPolygons = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        zones.forEach((poly, pIdx) => {
            if (poly.length === 0) return;

            const isActive = pIdx === activePolyIdx;

            // Draw Area
            ctx.beginPath();
            ctx.moveTo(poly[0].x * w, poly[0].y * h);
            poly.forEach((pt, i) => {
                if (i > 0) ctx.lineTo(pt.x * w, pt.y * h);
            });
            ctx.closePath();

            // Style
            ctx.fillStyle = isActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#ef4444' : 'rgba(239, 68, 68, 0.6)';
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.stroke();

            // Draw Points
            if (mode !== 'view') {
                poly.forEach((pt, ptIdx) => {
                    const isHovered = hoveredPoint?.polyIdx === pIdx && hoveredPoint?.ptIdx === ptIdx;
                    ctx.beginPath();
                    ctx.arc(pt.x * w, pt.y * h, isHovered ? 8 : 5, 0, Math.PI * 2);
                    ctx.fillStyle = isHovered ? '#fff' : (isActive ? '#ef4444' : '#991b1b');
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });
            }
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (mode === 'view') return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvas.width;
        const y = (e.clientY - rect.top) / canvas.height;

        // Check if clicking a point for dragging
        for (let pIdx = 0; pIdx < zones.length; pIdx++) {
            for (let ptIdx = 0; ptIdx < zones[pIdx].length; ptIdx++) {
                const pt = zones[pIdx][ptIdx];
                const dx = pt.x - x;
                const dy = pt.y - y;
                // Threshold ~10 pixels
                const dist = Math.sqrt(dx * dx + dy * dy) * canvas.width;
                if (dist < 12) {
                    setDraggedPoint({ polyIdx: pIdx, ptIdx });
                    setActivePolyIdx(pIdx);
                    setMode('edit');
                    return;
                }
            }
        }

        // If in Draw mode and not clicking point, add a new point
        if (mode === 'draw' && activePolyIdx !== null) {
            const newZones = [...zones];
            newZones[activePolyIdx].push({ x, y });
            setZones(newZones);
            onZonesChange(newZones);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / canvas.width;
        const y = (e.clientY - rect.top) / canvas.height;

        if (draggedPoint) {
            const newZones = [...zones];
            newZones[draggedPoint.polyIdx][draggedPoint.ptIdx] = { x, y };
            setZones(newZones);
            onZonesChange(newZones);
        } else {
            // Hover check
            let found = null;
            for (let pIdx = 0; pIdx < zones.length; pIdx++) {
                for (let ptIdx = 0; ptIdx < zones[pIdx].length; ptIdx++) {
                    const pt = zones[pIdx][ptIdx];
                    const dist = Math.sqrt(Math.pow(pt.x - x, 2) + Math.pow(pt.y - y, 2)) * canvas.width;
                    if (dist < 12) {
                        found = { polyIdx: pIdx, ptIdx };
                        break;
                    }
                }
                if (found) break;
            }
            setHoveredPoint(found);
            if (found) canvas.style.cursor = 'move';
            else canvas.style.cursor = mode === 'view' ? 'default' : 'crosshair';
        }
    };

    const handleMouseUp = () => {
        setDraggedPoint(null);
    };

    const addNewZone = () => {
        const newZones = [...zones, []];
        setZones(newZones);
        setActivePolyIdx(newZones.length - 1);
        setMode('draw');
    };

    const deleteActiveZone = () => {
        if (activePolyIdx === null) return;
        const newZones = zones.filter((_, i) => i !== activePolyIdx);
        setZones(newZones);
        setActivePolyIdx(null);
        setMode('view');
        onZonesChange(newZones);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} ref={containerRef}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={addNewZone}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                            borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                            backgroundColor: mode === 'draw' ? '#2563eb' : '#374151', color: 'white', transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={16} /> {mode === 'draw' ? 'Đang vẽ...' : 'Thêm vùng cấm'}
                    </button>
                    {activePolyIdx !== null && (
                        <button
                            onClick={deleteActiveZone}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                                borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                        >
                            <Trash2 size={16} /> Xóa
                        </button>
                    )}
                </div>
                <button
                    onClick={fetchSnapshot}
                    disabled={isLoadingImage}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                        borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        backgroundColor: '#1f2937', color: '#d1d5db', opacity: isLoadingImage ? 0.5 : 1
                    }}
                >
                    {isLoadingImage ? <RefreshCw size={16} className="animate-spin" /> : <Camera size={16} />}
                    Chụp ảnh mới
                </button>
            </div>

            {/* Canvas Container */}
            <div style={{
                position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #374151',
                backgroundColor: '#030712', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ display: 'block', maxWidth: '100%', cursor: mode === 'view' ? 'default' : 'crosshair' }}
                />

                {mode === 'draw' && (
                    <div style={{
                        position: 'absolute', top: '12px', left: '12px', right: '12px', padding: '8px 16px',
                        backgroundColor: 'rgba(37, 99, 235, 0.9)', color: 'white', borderRadius: '8px', fontSize: '0.75rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(4px)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                        <span>Click vào ảnh để tạo các đỉnh. Vùng sẽ tự đóng khi hoàn tất.</span>
                        <button onClick={() => setMode('view')} style={{ background: 'white', color: '#2563eb', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 700 }}>Xong</button>
                    </div>
                )}

                {error && (
                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', padding: '20px' }}>
                        <AlertCircle size={32} color="#ef4444" />
                        <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>
                        <button onClick={fetchSnapshot} style={{ padding: '6px 12px', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Thử lại</button>
                    </div>
                )}
            </div>

            {/* List of Zones */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {zones.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => { setActivePolyIdx(i); setMode('edit'); }}
                        style={{
                            padding: '4px 12px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 800, border: '1px solid',
                            cursor: 'pointer', transition: 'all 0.2s',
                            backgroundColor: activePolyIdx === i ? '#ef4444' : '#111827',
                            borderColor: activePolyIdx === i ? '#ef4444' : '#374151',
                            color: 'white'
                        }}
                    >
                        Vùng {i + 1}
                    </button>
                ))}
            </div>

            {/* Instructions */}
            <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '12px', display: 'flex', gap: '12px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(234, 179, 8, 0.2)', borderRadius: '8px', height: 'fit-content', color: '#eab308' }}>
                    <MousePointer2 size={18} />
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                    <p style={{ fontWeight: 700, color: '#eab308', margin: '0 0 4px 0' }}>Mẹo thiết lập</p>
                    <p style={{ margin: 0, color: 'rgba(254, 240, 138, 0.7)' }}>AI sẽ báo động khi <b>chân</b> của nhân viên chạm vào khu vực này. Hãy vẽ bao quanh khu vực sàn nhà cần bảo vệ.</p>
                </div>
            </div>
        </div>
    );
};

export default RestrictedZoneEditor;
