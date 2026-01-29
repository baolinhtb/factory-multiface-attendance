import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import api from '../services/api';

interface DateFilterPreset {
    id: number;
    value: string;
    label: string;
    days_offset: number;
    is_range: number;
    is_custom: number;
    display_order: number;
    is_active: number;
}

interface DateFilterProps {
    onDateChange: (startDate: string, endDate: string) => void;
    initialFilterValue?: string;
}

// Helper function to get local date string in YYYY-MM-DD format
const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DateFilter = ({ onDateChange, initialFilterValue = 'today' }: DateFilterProps) => {
    const [presets, setPresets] = useState<DateFilterPreset[]>([]);
    const [selectedFilter, setSelectedFilter] = useState<string>(initialFilterValue);
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');

    // Fetch filter presets from API
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const res = await api.get('/date-filter-presets');
                setPresets(res.data);
            } catch (e) {
                console.error('Error fetching date filter presets', e);
            }
        };
        fetchPresets();
    }, []);

    // Calculate date range based on selected filter
    useEffect(() => {
        const currentPreset = presets.find(p => p.value === selectedFilter);
        if (!currentPreset) return;

        if (currentPreset.is_custom === 1) {
            // For custom, wait for user to set dates manually
            if (customStartDate && customEndDate) {
                onDateChange(customStartDate, customEndDate);
            }
        } else {
            const today = new Date();
            let startDate: string;
            let endDate: string;

            if (currentPreset.is_range === 1) {
                // Range filter (week, month)
                const start = new Date();
                start.setDate(today.getDate() + currentPreset.days_offset);
                startDate = getLocalDateString(start);
                endDate = getLocalDateString(today);
            } else {
                // Single day filter (today, yesterday)
                const target = new Date();
                target.setDate(today.getDate() + currentPreset.days_offset);
                startDate = getLocalDateString(target);
                endDate = getLocalDateString(target);
            }

            onDateChange(startDate, endDate);
        }
    }, [selectedFilter, presets, customStartDate, customEndDate, onDateChange]);

    const handleFilterChange = (value: string) => {
        setSelectedFilter(value);

        // Initialize custom dates to today if switching to custom
        const preset = presets.find(p => p.value === value);
        if (preset?.is_custom === 1 && !customStartDate) {
            const today = getLocalDateString(new Date());
            setCustomStartDate(today);
            setCustomEndDate(today);
        }
    };

    const isCustom = presets.find(p => p.value === selectedFilter)?.is_custom === 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Dropdown */}
            <div>
                <label style={{
                    display: 'block',
                    color: '#94a3b8',
                    fontSize: '0.875rem',
                    marginBottom: '8px'
                }}>
                    Khoảng thời gian
                </label>
                <select
                    value={selectedFilter}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer'
                    }}
                >
                    {presets.map(preset => (
                        <option key={preset.id} value={preset.value}>
                            {preset.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Custom Date Range Inputs (only shown when "Custom" is selected) */}
            {isCustom && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            color: '#94a3b8',
                            fontSize: '0.875rem',
                            marginBottom: '8px'
                        }}>
                            Từ ngày
                        </label>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{
                            display: 'block',
                            color: '#94a3b8',
                            fontSize: '0.875rem',
                            marginBottom: '8px'
                        }}>
                            Đến ngày
                        </label>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateFilter;
