"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { buildSystemPrompt } from './aiSystemPrompt';
import './AIChat.css';
import AppShell from './components/layout/AppShell';
import DiscoverPage from './components/pages/DiscoverPage';
import StoragePage from './components/pages/StoragePage';
import WorkspacePage from './components/pages/WorkspacePage';
import VisualizePage from './components/pages/VisualizePage';
import AIPage from './components/pages/AIPage';
import SettingsPage from './components/pages/SettingsPage';
import AboutPage from './components/pages/AboutPage';
import CommandPalette from './components/features/CommandPalette';
import UpdateBanner from './components/features/UpdateBanner';
import { NotificationProvider, ToastContainer, useNotifications } from './components/features/NotificationCenter';

// Monaco wrapper that loads the editor entirely at runtime to avoid Turbopack
// trying to resolve the CDN URL inside @monaco-editor/loader as a filesystem path.
const Editor = dynamic(() => import('./MonacoEditor'), { ssr: false });

const ParticleVisualization = dynamic(() => import('./ParticleVisualization'), {
  ssr: false,
});

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return 'Unknown';
  const tb = bytes / (1024 ** 4);
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
};

const AI_SUGGESTIONS = [
  'Analyze my processed data and find interesting physics',
  'Explain the Higgs boson decay to two photons',
  'What cuts should I use for Z→μμ?',
];

// OAuth PKCE helpers
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const CLAUDE_AUTH_URL = 'https://claude.ai/oauth/authorize';

function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


// Simple markdown renderer for AI responses
function renderAIMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={key++} style={{ background: '#0d0d12', border: '1px solid #1e1e28', borderRadius: '8px', padding: '14px 16px', margin: '10px 0', overflowX: 'auto', fontSize: '13px', lineHeight: 1.5 }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={key++} style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6', margin: '14px 0 6px' }}>{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={key++} style={{ fontSize: '15px', fontWeight: 600, color: '#f3f4f6', margin: '16px 0 8px' }}>{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={key++} style={{ fontSize: '16px', fontWeight: 700, color: '#f3f4f6', margin: '18px 0 10px' }}>{line.slice(2)}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<div key={key++} style={{ paddingLeft: '16px', margin: '2px 0' }}>• {renderInlineMarkdown(line.slice(2))}</div>);
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/);
      elements.push(<div key={key++} style={{ paddingLeft: '16px', margin: '2px 0' }}>{match[1]}. {renderInlineMarkdown(match[2])}</div>);
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: '8px' }} />);
    } else {
      elements.push(<p key={key++} style={{ margin: '4px 0', lineHeight: 1.65 }}>{renderInlineMarkdown(line)}</p>);
    }
  }

  if (inCodeBlock && codeLines.length) {
    elements.push(
      <pre key={key++} style={{ background: '#0d0d12', border: '1px solid #1e1e28', borderRadius: '8px', padding: '14px 16px', margin: '10px 0', overflowX: 'auto', fontSize: '13px' }}>
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return elements;
}

function renderInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: '#f9fafb', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: '#0d0d12', color: '#a5f3fc', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: "var(--font-geist-mono), 'SF Mono', monospace" }}>{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
export default function App() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [downloaded, setDownloaded] = useState([]);
  const [downloading, setDownloading] = useState({});
  const [processing, setProcessing] = useState({});
  const [filePicker, setFilePicker] = useState(null); // { dataset, selectedFiles: Set }
  const [activeTab, setActiveTabState] = useState('browse');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['browse', 'downloaded', 'workspace', 'visualize', 'ai', 'settings', 'about'].includes(hash)) {
        setActiveTabState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    if (window.location.hash) {
      handleHashChange();
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setActiveTab = useCallback((tab) => {
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
    setActiveTabState(tab);
  }, []);
  const [experiment, setExperiment] = useState('All');
  const [showDownloads, setShowDownloads] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDatasets, setTotalDatasets] = useState(0);
  const [visualizeFile, setVisualizeFile] = useState(null);
  
  // Inspector states
  const [expandedFiles, setExpandedFiles] = useState({});
  const [inspectingFile, setInspectingFile] = useState(null);
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorPage, setInspectorPage] = useState(1);
  const [loadingInspector, setLoadingInspector] = useState(false);
  const editorRef = useRef(null);

  // AI Chat state
  const [aiMessages, setAiMessages] = useState([]);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiTokens, setAiTokens] = useState('');
  const [aiTotalTokens, setAiTotalTokens] = useState(0);
  const [aiInputValue, setAiInputValue] = useState('');
  const [aiShowSettings, setAiShowSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState({ apiKey: '', model: 'claude-3-7-sonnet-20250219' });
  const [aiModels, setAiModels] = useState([]);
  const [aiError, setAiError] = useState('');
  const [activeToolExecution, setActiveToolExecution] = useState(null); // Tracks currently running real-world tool execution
  const aiMessagesEndRef = useRef(null);
  const aiAbortRef = useRef(null);
  const aiTextareaRef = useRef(null);

  // Load AI config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('opencern-ai-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiConfig(prev => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  // Fetch models from Anthropic when API key changes
  const DEFAULT_MODELS = [
    { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4-20250514', display_name: 'Claude Opus 4' },
    { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 3.5' },
  ];

  useEffect(() => {
    if (!aiConfig.apiKey) { setAiModels(DEFAULT_MODELS); return; }
    setAiModels(DEFAULT_MODELS); // show defaults immediately
    let cancelled = false;
    fetch(`/api/ai/models?apiKey=${encodeURIComponent(aiConfig.apiKey)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.data) return;
        const models = data.data
          .filter(m => m.id && m.id.startsWith('claude'))
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        if (models.length > 0) setAiModels(models);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [aiConfig.apiKey]);

  // Auto-scroll AI messages
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiTokens]);

  const saveAiConfig = useCallback((newConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('opencern-ai-config', JSON.stringify(newConfig));
    } catch {}
  }, []);

  const buildContext = useCallback(() => {
    return {
      downloadedDatasets: downloaded.map(d => d.title || d.name || d),
      totalEvents: inspectorData?.totalEvents,
      experiment: selected?.experiment,
    };
  }, [downloaded, inspectorData, selected]);

  const isAiAuthed = !!aiConfig.apiKey;



  const sendAiMessage = useCallback(async (content) => {
    if (!content.trim() || aiStreaming) return;
    if (!isAiAuthed) {
      setAiError('Connect your account or add an API key in settings.');
      return;
    }
    setAiError('');

    const userMsg = { role: 'user', content: content.trim(), timestamp: new Date().toISOString() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInputValue('');
    setAiStreaming(true);
    setAiTokens('');

    // Pre-process messages to flatten tool invocations into the correct Anthropic format
    const allMessages = [...aiMessages, userMsg].map(m => {
      // If it's a standard text message
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      // If it's a complex array (tool_use / tool_result)
      return { role: m.role, content: m.content };
    });

    const systemPrompt = buildSystemPrompt(buildContext()) + "\n\nYou have access to tools. ALWAYS use them if the user asks you to analyze data, run bash commands, or interact with opencern. DO NOT refuse to run code.";

    try {
      aiAbortRef.current = new AbortController();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          systemPrompt,
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
        }),
        signal: aiAbortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to get response');
      }

      const processStream = async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        let toolInvocations = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'token') {
                fullText += evt.text;
                setAiTokens(fullText);
              } else if (evt.type === 'tool_use') {
                toolInvocations.push(evt);
              } else if (evt.type === 'done') {
                setAiTotalTokens(prev => prev + (evt.usage?.totalTokens || 0));
              } else if (evt.type === 'error') {
                throw new Error(evt.error);
              }
            } catch {}
          }
        }

        let finalContent = fullText;
        if (toolInvocations.length > 0) {
          // If tools were used, the content array must contain both the text (if any) and the tool_use blocks
          finalContent = [];
          if (fullText.trim()) {
            finalContent.push({ type: 'text', text: fullText.trim() });
          }
          finalContent.push(...toolInvocations.map(t => ({
            type: 'tool_use',
            id: t.id,
            name: t.name,
            input: t.input,
            status: 'pending' // UI state: pending human approval
          })));
        }

        return finalContent;
      };

      const finalContent = await processStream(res);
      setAiMessages(prev => [...prev, { role: 'assistant', content: finalContent, timestamp: new Date().toISOString() }]);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${err.message}`, timestamp: new Date().toISOString(), isError: true }]);
      }
    } finally {
      setAiStreaming(false);
      setAiTokens('');
    }
  }, [aiConfig, aiMessages, aiStreaming, buildContext, isAiAuthed]);

  // Handle execution of a pending tool
  const handleToolAction = useCallback(async (msgIndex, toolIndex, toolObj, action) => {
    // 1. Mark in UI
    const updatedMessages = [...aiMessages];
    const msg = updatedMessages[msgIndex];
    if (Array.isArray(msg.content)) {
      msg.content[toolIndex].status = action === 'approve' ? 'running' : 'denied';
    }
    setAiMessages(updatedMessages);

    if (action === 'deny') {
      // Immediately tell anthropic we denied it
      const toolResultMsg = {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolObj.id,
          content: 'The user denied the execution of this tool for security reasons.',
          is_error: true
        }],
        timestamp: new Date().toISOString()
      };
      // Send background followup without putting the deny message in the UI explicitly (just the card update)
      sendAiMessageFollowUp([...updatedMessages, toolResultMsg]);
      return;
    }

    // Run execution
    setActiveToolExecution(toolObj.id);
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: toolObj.name,
          toolInput: toolObj.input
        })
      });
      const data = await res.json();
      
      const updatedMessagesPost = [...aiMessages];
      const msgPost = updatedMessagesPost[msgIndex];
      if (Array.isArray(msgPost.content)) {
        msgPost.content[toolIndex].status = data.success ? 'success' : 'failed';
        msgPost.content[toolIndex].output = data.output;
        if (data.images?.length > 0) msgPost.content[toolIndex].images = data.images;
      }
      setAiMessages(updatedMessagesPost);

      // Tell Anthropic the result so it can summarize
      let resultText = data.output;
      if (data.images?.length > 0) {
        resultText += '\n\n[System: The tool generated images. They have been displayed to the user natively.]';
      }

      const toolResultMsg = {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolObj.id,
          content: resultText,
          is_error: !data.success
        }],
        timestamp: new Date().toISOString()
      };
      
      sendAiMessageFollowUp([...updatedMessagesPost, toolResultMsg]);

    } catch (err) {
      // Network failure
      const updatedMessagesPost = [...aiMessages];
      const msgPost = updatedMessagesPost[msgIndex];
      if (Array.isArray(msgPost.content)) {
         msgPost.content[toolIndex].status = 'failed';
         msgPost.content[toolIndex].output = err.message;
      }
      setAiMessages(updatedMessagesPost);

      sendAiMessageFollowUp([...updatedMessagesPost, {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolObj.id, content: err.message, is_error: true }],
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setActiveToolExecution(null);
    }
  }, [aiMessages]);

  const sendAiMessageFollowUp = async (messagesHistory) => {
    setAiStreaming(true);
    setAiTokens('Analyzing execution results...');
    
    try {
      aiAbortRef.current = new AbortController();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesHistory,
          systemPrompt: buildSystemPrompt(buildContext()),
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
        }),
        signal: aiAbortRef.current.signal,
      });

      if (!res.ok) throw new Error('Follow-up failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'token') {
              // Clear 'Analyzing...' on first real token
              if (fullText === '') setAiTokens(''); 
              fullText += evt.text;
              setAiTokens(fullText);
            } else if (evt.type === 'done') {
              setAiTotalTokens(prev => prev + (evt.usage?.totalTokens || 0));
            }
          } catch {}
        }
      }

      setAiMessages(prev => {
        // Find existing history, append the new assistant response
        return [...messagesHistory, { role: 'assistant', content: fullText, timestamp: new Date().toISOString() }];
      });
    } catch(err) {
      if (err.name !== 'AbortError') console.error('Follow-up error:', err);
    } finally {
      setAiStreaming(false);
      setAiTokens('');
    }
  };

  const stopAiStream = useCallback(() => {
    aiAbortRef.current?.abort();
    setAiStreaming(false);
    if (aiTokens) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: aiTokens + '\n\n*[Response stopped]*', timestamp: new Date().toISOString() }]);
      setAiTokens('');
    }
  }, [aiTokens]);

  const clearAiChat = useCallback(() => {
    setAiMessages([]);
    setAiTotalTokens(0);
  }, []);

  const maskApiKey = (key) => {
    if (!key || key.length < 12) return key || '';
    return key.slice(0, 7) + '••••••••' + key.slice(-4);
  };

  const saveProcessedFile = async (filename) => {
     if (!editorRef.current) return;
     const val = editorRef.current.getValue();
     try {
        const parsed = JSON.parse(val);
        await axios.put(`http://localhost:8080/process/data/${filename}?page=${parsed.page}&limit=${parsed.limit}`, parsed);
        alert('Saved cleanly to disk!');
     } catch(e) {
        alert('Invalid JSON structure! Unable to save.');
     }
  };

  const deleteProcessedFile = async (filename) => {
     try {
        await axios.delete(`http://localhost:8080/process/data/${filename}`);
        setInspectingFile(null);
        setInspectorData(null);
        
        // Re-fetch local cache
        const files = await axios.get('http://localhost:8080/files');
        setDownloaded(files.data);
     } catch(e) {
        console.error(e);
     }
  };

  const triggerDownloadAnimation = (e) => {
    if (!e) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const el = document.createElement('div');
    el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
    el.style.position = 'fixed';
    el.style.left = `${rect.left + rect.width / 2 - 10}px`;
    el.style.top = `${rect.top + rect.height / 2 - 10}px`;
    el.style.zIndex = '9999';
    el.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    const targetEl = document.getElementById('download-manager-btn');
    if (targetEl) {
      const targetRect = targetEl.getBoundingClientRect();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.left = `${targetRect.left + targetRect.width / 2 - 10}px`;
          el.style.top = `${targetRect.top + targetRect.height / 2 - 10}px`;
          el.style.transform = 'scale(0.2)';
          el.style.opacity = '0.5';
        });
      });
    }
    
    setTimeout(() => {
      document.body.removeChild(el);
      if (targetEl) {
        targetEl.style.transform = 'scale(1.05)';
        targetEl.style.background = '#1e1e24';
        setTimeout(() => {
          targetEl.style.transform = 'scale(1)';
          targetEl.style.background = 'transparent';
        }, 150);
      }
    }, 600);
  };

  const pauseDownload = async (filename) => {
    try {
      await axios.post(`http://localhost:8080/download/pause?filename=${filename}`);
      setDownloading(prev => prev[filename] ? { ...prev, [filename]: { ...prev[filename], status: 'paused' } } : prev);
    } catch (e) { console.error(e); }
  };

  const resumeDownload = async (filename) => {
    try {
      await axios.post(`http://localhost:8080/download/resume?filename=${filename}`);
      setDownloading(prev => prev[filename] ? { ...prev, [filename]: { ...prev[filename], status: 'downloading' } } : prev);
    } catch (e) { console.error(e); }
  };

  const cancelDownload = async (filename) => {
    try {
      await axios.post(`http://localhost:8080/download/cancel?filename=${filename}`);
      setDownloading(prev => { const n = { ...prev }; delete n[filename]; return n; });
    } catch (e) { console.error(e); }
  };

  const deleteFile = async (filename) => {
    try {
      await axios.delete(`http://localhost:8080/files/${filename}`);
      const files = await axios.get('http://localhost:8080/files');
      setDownloaded(files.data);
    } catch (e) { console.error(e); }
  };

  const revealFile = async (filename) => {
    try {
      await axios.get(`http://localhost:8080/files/${filename}/reveal`);
    } catch (e) { console.error(e); }
  };

  const processFile = async (filename) => {
    setProcessing(prev => ({ ...prev, [filename]: 'processing' }));
    try {
      // Detect if this is a folder (dataset with multiple ROOT files)
      const fileEntry = downloaded.find(f => f.filename === filename);
      const isFolder = fileEntry && fileEntry.type === 'folder';

      if (isFolder) {
        await axios.post(`http://localhost:8080/process/folder?folder=${encodeURIComponent(filename)}`);
      } else {
        await axios.post(`http://localhost:8080/process?filename=${encodeURIComponent(filename)}`);
      }
      
      const interval = setInterval(async () => {
        try {
          const res = await axios.get(`http://localhost:8080/process/status?filename=${encodeURIComponent(filename)}`);
          const status = res.data.status;
          setProcessing(prev => ({ ...prev, [filename]: status }));
          if (status === 'processed' || status === 'error') {
            clearInterval(interval);
          }
        } catch (e) {
          clearInterval(interval);
          setProcessing(prev => ({ ...prev, [filename]: 'error' }));
        }
      }, 1000);
    } catch (e) { 
      setProcessing(prev => ({ ...prev, [filename]: 'error' }));
      console.error(e); 
    }
  };

  const toggleExpand = (filename) => {
    setExpandedFiles(prev => ({ ...prev, [filename]: !prev[filename] }));
  };

  const openInspector = async (filename, page = 1) => {
    setInspectingFile(filename);
    setInspectorPage(page);
    setLoadingInspector(true);
    try {
      const res = await axios.get(`http://127.0.0.1:9002/process/data?filename=${filename}&page=${page}&limit=5`);
      setInspectorData(res.data);
    } catch (e) {
      console.error(e);
      setInspectorData({ error: 'Failed to load data.' });
    } finally {
      setLoadingInspector(false);
    }
  };

  const closeInspector = () => {
    setInspectingFile(null);
    setInspectorData(null);
  };

  useEffect(() => {
    if (activeTab === 'downloaded' && downloaded.length > 0) {
      downloaded.forEach(async (f) => {
        try {
          const res = await axios.get(`http://localhost:8080/process/status?filename=${f.filename}`);
          setProcessing(prev => ({ ...prev, [f.filename]: res.data.status }));
        } catch (e) {}
      });
    }
  }, [activeTab, downloaded]);

  useEffect(() => {
    // Add custom LM Studio-like scrollbar styles globally (only once)
    let style = document.getElementById('lm-studio-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'lm-studio-styles';
      style.innerHTML = `
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        body { user-select: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes slideIn { 
          from { transform: translateX(20px); opacity: 0; } 
          to { transform: translateX(0); opacity: 1; } 
        }
      `;
      document.head.appendChild(style);
    }

    setLoading(true);
    // Fetch depending on the selected experiment with pagination
    if (experiment === 'All') {
      Promise.all([
        axios.get(`http://localhost:8080/datasets?experiment=ALICE&page=${page}&size=20`),
        axios.get('http://localhost:8080/datasets?experiment=CMS')
      ])
        .then(([resAlice, resCms]) => {
          const aliceData = resAlice.data.datasets || resAlice.data;
          const cmsData = resCms.data.datasets || resCms.data;
          setDatasets([...aliceData, ...cmsData]);
          setTotalPages(resAlice.data.pages || 1);
          setTotalDatasets((resAlice.data.total || 0) + (cmsData.length || 0));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      const expParam = experiment === 'Alice' ? 'ALICE' : experiment;
      axios.get(`http://localhost:8080/datasets?experiment=${expParam}&page=${page}&size=20`)
        .then(r => {
          const data = r.data;
          setDatasets(data.datasets || data);
          setTotalPages(data.pages || 1);
          setTotalDatasets(data.total || (data.datasets || data).length);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }

    axios.get('http://localhost:8080/files')
      .then(r => setDownloaded(r.data))
      .catch(() => {});
      
  }, [experiment, page]);

  const handleDownload = async (dataset, e) => {
    if (e) triggerDownloadAnimation(e);
    
    // Multi-file dataset: open file picker
    if (dataset.files.length > 1) {
      setFilePicker({ dataset, selectedFiles: new Set(dataset.files) });
      return;
    }
    
    // Single file: download directly
    const file = dataset.files[0];
    const filename = file.split('/').pop();
    setDownloading(prev => ({ ...prev, [filename]: { progress: 0, status: 'downloading', dataset } }));

    try {
      await axios.post(`http://localhost:8080/download?file_url=${encodeURIComponent(file)}&filename=${filename}`);
    } catch (e) {
      console.error(e);
    }

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8080/download/status?filename=${filename}`);
        const { status, progress } = res.data;
        if (status === 'canceled') {
          clearInterval(interval);
          setDownloading(prev => { const n = { ...prev }; delete n[filename]; return n; });
          return;
        }
        setDownloading(prev => {
          if (!prev[filename]) return prev;
          return { ...prev, [filename]: { ...prev[filename], progress, status } };
        });
        if (status === 'done' || status === 'error') {
          clearInterval(interval);
          if (status === 'done') {
            const files = await axios.get('http://localhost:8080/files');
            setDownloaded(files.data);
          }
          setDownloading(prev => { const n = { ...prev }; delete n[filename]; return n; });
        }
      } catch (e) {
        // tracking error
      }
    }, 500);
  };

  const handleMultiDownload = async () => {
    if (!filePicker) return;
    const { dataset, selectedFiles } = filePicker;
    const files = Array.from(selectedFiles);
    setFilePicker(null);

    try {
      const res = await axios.post('http://localhost:8080/download/multi', {
        dataset_title: dataset.title,
        files: files,
      });
      const folder = res.data.folder;
      for (const f of res.data.files) {
        setDownloading(prev => ({
          ...prev,
          [f.track_key]: { progress: 0, status: 'downloading', dataset }
        }));
        // Track individual file progress
        const trackKey = f.track_key;
        const interval = setInterval(async () => {
          try {
            const r = await axios.get(`http://localhost:8080/download/status?filename=${trackKey}`);
            setDownloading(prev => {
              if (!prev[trackKey]) return prev;
              return { ...prev, [trackKey]: { ...prev[trackKey], progress: r.data.progress, status: r.data.status } };
            });
            if (r.data.status === 'done' || r.data.status === 'error') {
              clearInterval(interval);
              setDownloading(prev => { const n = { ...prev }; delete n[trackKey]; return n; });
              const files = await axios.get('http://localhost:8080/files');
              setDownloaded(files.data);
            }
          } catch (e) {}
        }, 500);
      }
    } catch (e) {
      console.error('Multi-download failed:', e);
    }
  };

  const toggleFileInPicker = (url) => {
    if (!filePicker) return;
    const newSet = new Set(filePicker.selectedFiles);
    if (newSet.has(url)) newSet.delete(url);
    else newSet.add(url);
    setFilePicker({ ...filePicker, selectedFiles: newSet });
  };

  const isDownloaded = (dataset) => {
    const filename = dataset.files[0]?.split('/').pop();
    return downloaded.some(f => f.filename === filename);
  };

  // Command palette state
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const PAGE_MAP = { discover: 'browse', storage: 'downloaded', workspace: 'workspace', visualize: 'visualize', ai: 'ai', settings: 'settings' };
  const handleCommandPaletteAction = useCallback((action) => {
    if (action.type === 'new-chat') { clearAiChat(); setActiveTab('ai'); }
    else if (action.type === 'search-datasets') { setActiveTab('browse'); }
    else if (action.type === 'process-all') { setActiveTab('downloaded'); }
    else if (action.type === 'toggle-sidebar') { /* handled by AppShell */ }
    else if (action.type === 'check-updates') { setActiveTab('settings'); }
    else if (action.type === 'external') { window.open(action.url, '_blank'); }
  }, [clearAiChat]);


  return (
    <NotificationProvider>
      <UpdateBanner />
      <AppShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        downloaded={downloaded}
        downloading={downloading}
        onPauseDownload={pauseDownload}
        onResumeDownload={resumeDownload}
        onCancelDownload={cancelDownload}
        onCommandPalette={() => setCmdPaletteOpen(true)}
        dockerConnected={true}
      >
        {activeTab === 'browse' && (
          <DiscoverPage
            datasets={datasets}
            loading={loading}
            experiment={experiment}
            page={page}
            totalPages={totalPages}
            totalDatasets={totalDatasets}
            downloading={downloading}
            downloaded={downloaded}
            selected={selected}
            onExperimentChange={(exp) => { setExperiment(exp); setPage(1); }}
            onPageChange={setPage}
            onSelect={setSelected}
            onDownload={handleDownload}
            filePicker={filePicker}
            onFilePickerChange={setFilePicker}
            onMultiDownload={handleMultiDownload}
            onToggleFileInPicker={toggleFileInPicker}
          />
        )}

        {activeTab === 'downloaded' && (
          <StoragePage
            downloaded={downloaded}
            processing={processing}
            expandedFiles={expandedFiles}
            inspectingFile={inspectingFile}
            inspectorData={inspectorData}
            loadingInspector={loadingInspector}
            inspectorPage={inspectorPage}
            onProcess={processFile}
            onToggleExpand={toggleExpand}
            onOpenInspector={openInspector}
            onCloseInspector={closeInspector}
            onRevealFile={revealFile}
            onDeleteFile={deleteFile}
            onVisualizeFile={(filename) => { setVisualizeFile(filename); setActiveTab('visualize'); }}
            onDeleteProcessedFile={deleteProcessedFile}
            onSaveProcessedFile={saveProcessedFile}
            editorRef={editorRef}
          />
        )}

        {activeTab === 'workspace' && (
          <WorkspacePage
            downloaded={downloaded}
            processing={processing}
            inspectingFile={inspectingFile}
            inspectorData={inspectorData}
            loadingInspector={loadingInspector}
            onOpenInspector={openInspector}
            onSaveProcessedFile={saveProcessedFile}
            onDeleteProcessedFile={deleteProcessedFile}
            editorRef={editorRef}
          />
        )}

        {activeTab === 'visualize' && (
          <VisualizePage visualizeFile={visualizeFile} />
        )}

        {activeTab === 'ai' && (
          <AIPage
            aiMessages={aiMessages}
            aiStreaming={aiStreaming}
            aiTokens={aiTokens}
            aiTotalTokens={aiTotalTokens}
            aiInputValue={aiInputValue}
            aiConfig={aiConfig}
            aiModels={aiModels}
            aiError={aiError}
            aiShowSettings={aiShowSettings}
            aiTextareaRef={aiTextareaRef}
            aiMessagesEndRef={aiMessagesEndRef}
            isAiAuthed={isAiAuthed}
            activeToolExecution={activeToolExecution}
            onAiInputChange={setAiInputValue}
            onSendMessage={sendAiMessage}
            onStopStream={stopAiStream}
            onClearChat={clearAiChat}
            onShowSettings={() => setAiShowSettings(true)}
            onHideSettings={() => setAiShowSettings(false)}
            onSaveConfig={saveAiConfig}
            onSetConfig={setAiConfig}
            onToolAction={handleToolAction}
            maskApiKey={maskApiKey}
            renderAIMarkdown={renderAIMarkdown}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            aiConfig={aiConfig}
            onSaveConfig={saveAiConfig}
            dockerConnected={true}
          />
        )}

        {activeTab === 'about' && <AboutPage />}
      </AppShell>

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={(page) => { setActiveTab(PAGE_MAP[page] || page); setCmdPaletteOpen(false); }}
        onAction={(action) => { handleCommandPaletteAction(action); setCmdPaletteOpen(false); }}
      />
      <ToastContainer />
    </NotificationProvider>
  );
}
