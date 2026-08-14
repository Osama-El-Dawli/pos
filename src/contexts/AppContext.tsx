import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'cashier';
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null, remember?: boolean) => void;
  language: string;
  setLanguage: (lang: string) => void;
  currency: string;
  setCurrency: (curr: string) => void;
  logo: string | null;
  setLogo: (logo: string | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('saved_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setUser = (newUser: User | null, remember = true) => {
    setUserState(newUser);
    if (newUser && remember) {
      localStorage.setItem('saved_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('saved_user');
    }
  };

  const [language, setLanguage] = useState(localStorage.getItem('lang') || 'ar');
  const [currency, setCurrency] = useState(localStorage.getItem('currency') || 'EGP');
  const [logo, setLogo] = useState<string | null>(localStorage.getItem('logo'));
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    localStorage.setItem('lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  useEffect(() => {
    if (logo) localStorage.setItem('logo', logo);
  }, [logo]);

  return (
    <AppContext.Provider value={{ user, setUser, language, setLanguage, currency, setCurrency, logo, setLogo, activeTab, setActiveTab }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
