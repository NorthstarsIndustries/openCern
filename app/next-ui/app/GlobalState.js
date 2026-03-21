"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const GlobalStateContext = createContext(null);

export function GlobalStateProvider({ children }) {
  const [downloaded, setDownloaded] = useState([]);
  const [downloading, setDownloading] = useState({});
  const [processing, setProcessing] = useState({});
  const [aiConfig, setAiConfig] = useState({ apiKey: '', model: 'claude-3-7-sonnet-20250219' });
  const [aiMessages, setAiMessages] = useState([]);
  const [visualizeFile, setVisualizeFile] = useState(null);
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('opencern-ai-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiConfig(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
    
    axios.get('http://localhost:8080/files')
      .then(r => setDownloaded(r.data))
      .catch(() => {});
  }, []);

  const saveAiConfig = useCallback((newConfig) => {
    setAiConfig(newConfig);
    try { localStorage.setItem('opencern-ai-config', JSON.stringify(newConfig)); } catch {}
  }, []);

  const value = {
    downloaded, setDownloaded,
    downloading, setDownloading,
    processing, setProcessing,
    visualizeFile, setVisualizeFile,
    aiConfig, setAiConfig: saveAiConfig,
    aiMessages, setAiMessages
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState() {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) throw new Error('useGlobalState must be used within GlobalStateProvider');
  return ctx;
}
