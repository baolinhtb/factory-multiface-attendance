import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface LanguageContextType {
    language: string;
    translations: Record<string, string>;
    availableLanguages: { code: string; name: string }[];
    setLanguage: (lang: string) => void;
    t: (key: string) => string;
    refreshLanguages: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<string>(() => localStorage.getItem('language') || 'vi');
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [availableLanguages, setAvailableLanguages] = useState<{ code: string; name: string }[]>([]);

    const fetchLanguages = async () => {
        try {
            const res = await api.get('/languages');
            setAvailableLanguages(res.data);
        } catch (error) {
            console.error('Error fetching languages:', error);
        }
    };

    const fetchTranslations = async (lang: string) => {
        try {
            const res = await api.get(`/languages/${lang}`);
            setTranslations(res.data);
        } catch (error) {
            console.error(`Error fetching translations for ${lang}:`, error);
        }
    };

    useEffect(() => {
        fetchLanguages();
    }, []);

    useEffect(() => {
        fetchTranslations(language);
        localStorage.setItem('language', language);
    }, [language]);

    const setLanguage = (lang: string) => {
        setLanguageState(lang);
    };

    const t = (key: string) => {
        return translations[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, translations, availableLanguages, setLanguage, t, refreshLanguages: fetchLanguages }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
