
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

export type Language = 'en' | 'ru' | 'crh'; // Added 'crh'

type TranslationSet = Record<string, string>;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const loadTranslations = async (lang: Language): Promise<TranslationSet> => {
  try {
    const response = await fetch(`./locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} for ${lang}.json`);
    }
    const translations = await response.json();
    return translations || {};
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    return {}; // Return empty object on error to prevent crashes
  }
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [translations, setTranslations] = useState<TranslationSet | null>(null); // For current language
  const [fallbackTranslations, setFallbackTranslations] = useState<TranslationSet | null>(null); // For English
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    const initTranslations = async () => {
      // Load English translations first as they are the ultimate fallback
      const enTranslations = await loadTranslations('en');
      if (!active) return;
      setFallbackTranslations(enTranslations);

      if (language === 'en') {
        setTranslations(enTranslations);
      } else {
        // Load current language translations
        const currentLangTranslations = await loadTranslations(language);
        if (!active) return;
        setTranslations(currentLangTranslations);
      }
      setIsLoading(false);
    };

    initTranslations();
    return () => { active = false; };
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    // Translations will be updated by the useEffect listening to `language`
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let translationString: string | undefined;

    if (translations) {
      translationString = translations[key];
    }

    if (translationString === undefined && fallbackTranslations) {
      translationString = fallbackTranslations[key];
    }
    
    if (translationString === undefined) {
      // console.warn(`Translation key "${key}" not found for language "${language}".`);
      translationString = key; // Fallback to key itself
    }
    
    if (replacements && translationString) {
      Object.entries(replacements).forEach(([k, v]) => {
        translationString = translationString!.replace(new RegExp(`{${k}}`, 'g'), String(v)); // Added ! for type safety due to check
      });
    }
    return translationString || key; // Ensure always string
  };
  
  if (isLoading) {
      return React.createElement('div', { key: 'lang-loading-screen', style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white', fontSize: '1.2rem'} }, 'Loading application data...');
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
