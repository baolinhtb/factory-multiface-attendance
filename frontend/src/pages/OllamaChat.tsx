import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Video, AlertCircle, CheckCircle, Loader, Database, MessageSquare, Trash2, Plus, Menu, X } from 'lucide-react';
import api from '../services/api';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    images?: string[];
    timestamp: Date;
}

interface ChatSession {
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
}

function OllamaChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; message: string; model: string } | null>(null);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
    const [videoQuestion, setVideoQuestion] = useState('');
    const [isProcessingVideo, setIsProcessingVideo] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [useSystemContext, setUseSystemContext] = useState(false);

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        checkOllamaStatus();
        fetchSessions();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchSessions = async () => {
        try {
            const response = await api.get('/api/ollama/sessions');
            setSessions(response.data);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        }
    };

    const loadSession = async (sessionId: number) => {
        try {
            setActiveSessionId(sessionId);
            const response = await api.get(`/api/ollama/sessions/${sessionId}/messages`);
            const loadedMessages = response.data.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(loadedMessages);
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false); // Close sidebar on mobile after selection
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        }
    };

    const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this chat?')) return;

        try {
            await api.delete(`/api/ollama/sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                createNewChat();
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    };

    const createNewChat = () => {
        setActiveSessionId(null);
        setMessages([]);
        setInputMessage('');
        setSelectedImages([]);
        setImagePreviews([]);
        setVideoQuestion('');
        setSelectedVideo(null);
    };

    const checkOllamaStatus = async () => {
        try {
            const response = await api.get('/api/ollama/status');
            setOllamaStatus(response.data);
        } catch (error) {
            setOllamaStatus({
                available: false,
                message: 'Failed to connect to Ollama service',
                model: 'qwen2.5-vl:7b-instruct-q4_K_M'
            });
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        setSelectedImages(files);

        // Create previews
        const previews = files.map(file => URL.createObjectURL(file));
        setImagePreviews(previews);

        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedVideo(file);
        }
        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSendMessage = async () => {
        if ((!inputMessage.trim() && selectedImages.length === 0) || !ollamaStatus?.available) return;

        const userMessage: Message = {
            role: 'user',
            content: inputMessage,
            images: imagePreviews.length > 0 ? imagePreviews : undefined,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');

        // Clear attachments immediately after adding to messages
        const imagesToSend = [...selectedImages];
        setSelectedImages([]);
        setImagePreviews([]);

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('message', inputMessage);
            formData.append('conversation_history', JSON.stringify(messages));
            formData.append('use_system_context', String(useSystemContext));
            if (activeSessionId) {
                formData.append('session_id', String(activeSessionId));
            }

            imagesToSend.forEach(img => {
                formData.append('images', img);
            });

            const response = await api.post('/api/ollama/chat', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000 // 5 minutes timeout for vision models
            });

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.data.response,
                timestamp: new Date()
            };

            // Update active session if just created
            if (response.data.session_id && !activeSessionId) {
                setActiveSessionId(response.data.session_id);
            }

            // Refresh sessions list to show new/updated session
            fetchSessions();

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            const errorMessage: Message = {
                role: 'assistant',
                content: `Error: ${error.response?.data?.detail || error.message}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVideoAnalysis = async () => {
        if (!selectedVideo || !videoQuestion.trim() || !ollamaStatus?.available) return;

        setIsProcessingVideo(true);

        try {
            const formData = new FormData();
            formData.append('video', selectedVideo);
            formData.append('question', videoQuestion);

            const response = await api.post('/api/ollama/analyze-video', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000 // 5 minutes timeout for video processing
            });

            const userMessage: Message = {
                role: 'user',
                content: `[Video Analysis] ${videoQuestion}`,
                timestamp: new Date()
            };

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.data.response,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, userMessage, assistantMessage]);
            setSelectedVideo(null);
            setVideoQuestion('');
        } catch (error: any) {
            const errorMessage: Message = {
                role: 'assistant',
                content: `Video analysis error: ${error.response?.data?.detail || error.message}`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsProcessingVideo(false);
        }
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            background: '#0f172a', // Slate 900 (System Body)
            color: '#e2e8f0', // Slate 200
            width: '100%'
        }}>
            {/* MAIN CHAT AREA */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                minWidth: 0
            }}>

                {/* 1. HEADER - Transparent as we have Main Header */}
                <div style={{
                    padding: '12px 24px',
                    borderBottom: '1px solid #334155', // Slate 700
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#1e293b' // Slate 800 (Match System Header)
                }}>
                    <div style={{ fontWeight: 500, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MessageSquare size={18} color="#3b82f6" />
                        <span>AI Assistant</span>
                        {ollamaStatus?.available ? (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', color: '#60a5fa', border: '1px solid #3b82f6' }}>
                                {ollamaStatus.model}
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', color: '#f87171', border: '1px solid #ef4444' }}>
                                Disconnected
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                        <Menu size={20} />
                    </button>
                </div>

                {/* 2. MESSAGES LIST */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {messages.length === 0 && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <div style={{ marginBottom: '1rem', padding: 20, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%' }}>
                                <MessageSquare size={40} color="#3b82f6" />
                            </div>
                            <h3>How can I help you today?</h3>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: msg.role === 'user' ? '#3b82f6' : '#1e293b',
                                color: msg.role === 'user' ? '#ffffff' : '#3b82f6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontWeight: 'bold', border: msg.role === 'assistant' ? '1px solid #334155' : 'none'
                            }}>
                                {msg.role === 'user' ? 'U' : <MessageSquare size={16} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem', color: msg.role === 'user' ? '#60a5fa' : '#e2e8f0' }}>{msg.role === 'user' ? 'You' : 'Assistant'}</div>
                                {msg.images && (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        {msg.images.map((img, i) => (
                                            <img key={i} src={img} alt="attachment" style={{ height: 150, borderRadius: 8, cursor: 'pointer', border: '1px solid #334155' }} onClick={() => setZoomedImage(img)} />
                                        ))}
                                    </div>
                                )}
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#cbd5e1' }}>{msg.content}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                                    {msg.timestamp.toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && <div style={{ marginLeft: 48, color: '#64748b', fontSize: '0.9rem' }}>Thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* 3. INPUT AREA (PILL) */}
                <div style={{ padding: '0 20px 20px 20px' }}>

                    {/* Previews attached above input */}
                    {(imagePreviews.length > 0 || selectedVideo) && (
                        <div style={{ display: 'flex', gap: '10px', padding: '0 0 10px 10px' }}>
                            {imagePreviews.map((p, i) => (
                                <div key={i} style={{ position: 'relative' }}>
                                    <img src={p} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', border: '1px solid #334155' }} />
                                    <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', border: 'none', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                </div>
                            ))}
                            {selectedVideo && (
                                <div style={{ padding: '5px 10px', background: '#334155', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: '#e2e8f0' }}>
                                    <Video size={14} /> {selectedVideo.name}
                                    <button onClick={() => setSelectedVideo(null)} style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>×</button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{
                        maxWidth: '800px', margin: '0 auto',
                        background: '#1e293b', borderRadius: '24px',
                        padding: '10px 16px', display: 'flex', alignItems: 'center',
                        border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                        {/* Hidden Inputs */}
                        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
                        <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoSelect} />

                        {/* Tools */}
                        <div style={{ display: 'flex', gap: '8px', marginRight: '12px' }}>
                            <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', transition: 'color 0.2s' }} title="Add Image"><ImageIcon size={20} /></button>
                            <button onClick={() => videoInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', transition: 'color 0.2s' }} title="Add Video"><Video size={20} /></button>
                            <button onClick={() => setUseSystemContext(!useSystemContext)} style={{ background: 'transparent', border: 'none', color: useSystemContext ? '#3b82f6' : '#94a3b8', cursor: 'pointer', transition: 'color 0.2s' }} title="System Context"><Database size={20} /></button>
                        </div>

                        {/* Text Input */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {selectedVideo && (
                                <input
                                    placeholder="Ask about this video..."
                                    value={videoQuestion} onChange={e => setVideoQuestion(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#e2e8f0', borderBottom: '1px solid #334155', marginBottom: 4, padding: 4, outline: 'none', fontSize: '0.9rem' }}
                                />
                            )}
                            <input
                                type="text"
                                placeholder={selectedVideo ? "..." : "Hỏi AI..."}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (selectedVideo ? handleVideoAnalysis() : handleSendMessage())}
                                disabled={!ollamaStatus?.available}
                                style={{
                                    width: '100%', background: 'transparent', border: 'none', color: '#e2e8f0',
                                    outline: 'none', fontSize: '1rem'
                                }}
                            />
                        </div>

                        {/* Send Button */}
                        <button
                            onClick={selectedVideo ? handleVideoAnalysis : handleSendMessage}
                            disabled={!ollamaStatus?.available || isLoading || isProcessingVideo}
                            style={{
                                background: (inputMessage.trim() || selectedImages.length > 0) ? '#3b82f6' : '#334155',
                                color: '#ffffff', border: 'none', borderRadius: '50%', width: 40, height: 40,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '12px', opacity: (isLoading || !ollamaStatus?.available) ? 0.5 : 1, transition: 'background 0.2s'
                            }}
                        >
                            {isLoading || isProcessingVideo ? <Loader size={20} className="spin" /> : <Send size={20} />}
                        </button>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '12px' }}>
                        AI có thể mắc sai sót, hãy kiểm tra lại thông tin.
                    </div>
                </div>

            </div>

            {/* SIDEBAR (Right) */}
            {isSidebarOpen && (
                <div style={{ width: 300, background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
                        <button onClick={createNewChat} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#3b82f6', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 500 }}>
                            <Plus size={16} /> New Chat
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</div>
                        {sessions.length === 0 ? <div style={{ color: '#64748b', textAlign: 'center', marginTop: 20 }}>No history</div> : (
                            sessions.map(s => (
                                <div key={s.id} onClick={() => loadSession(s.id)}
                                    style={{
                                        padding: '10px', borderRadius: '8px', marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                                        background: activeSessionId === s.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                        border: activeSessionId === s.id ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent'
                                    }}>
                                    <MessageSquare size={16} color={activeSessionId === s.id ? '#3b82f6' : '#64748b'} />
                                    <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: activeSessionId === s.id ? '#3b82f6' : '#cbd5e1' }}>
                                        {s.title || 'Conversation'}
                                    </div>
                                    {activeSessionId === s.id && <button onClick={(e) => deleteSession(s.id, e)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* IMAGE ZOOM */}
            {zoomedImage && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setZoomedImage(null)}>
                    <img src={zoomedImage} style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
                    <button onClick={() => setZoomedImage(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: 40, height: 40, border: 'none', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
            )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #334155; borderRadius: 3px; }`}</style>
        </div>
    );
}

export default OllamaChat;
