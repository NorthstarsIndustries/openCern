'use client';

import React, { useCallback, useMemo } from 'react';
import { IconSettings, IconSend, IconStop, IconLayers } from '../shared/Icons';
import s from './AIPage.module.css';

const SUGGESTIONS = [
  'Analyze my processed data',
  'Explain the Higgs decay to two photons',
  'What cuts for Z→μμ?',
];

function InputBox({ aiInputValue, onAiInputChange, onSendMessage, aiStreaming, aiConfig, aiModels, onSetConfig, aiTextareaRef }) {
  const canSend = aiInputValue.trim().length > 0 && !aiStreaming;

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSendMessage();
    }
  }, [canSend, onSendMessage]);

  const handleTextareaChange = useCallback((e) => {
    onAiInputChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [onAiInputChange]);

  return (
    <div className={s.inputBox}>
      <textarea
        ref={aiTextareaRef}
        className={s.textarea}
        rows={1}
        placeholder="Ask about particle physics, analysis, or your data..."
        value={aiInputValue}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
      />
      <div className={s.toolbar}>
        <select
          className={s.modelSelect}
          value={aiConfig?.model || ''}
          onChange={(e) => onSetConfig({ ...aiConfig, model: e.target.value })}
        >
          {(aiModels || []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          className={`${s.sendBtn} ${canSend ? s.sendBtnActive : s.sendBtnDisabled}`}
          onClick={canSend ? onSendMessage : undefined}
          disabled={!canSend}
          aria-label="Send message"
        >
          <IconSend size={14} />
        </button>
      </div>
    </div>
  );
}

function ToolCard({ tool, onToolAction }) {
  const status = tool.status || 'pending';
  const badgeClass = {
    pending: s.badgePending,
    running: s.badgeRunning,
    success: s.badgeSuccess,
    failed: s.badgeFailed,
    denied: s.badgeDenied,
  }[status] || s.badgePending;

  return (
    <div className={s.toolCard}>
      <div className={s.toolHeader}>
        <span className={s.toolName}>{tool.name || 'tool_call'}</span>
        <span className={`${s.toolBadge} ${badgeClass}`}>{status}</span>
      </div>
      {tool.input && (
        <div className={s.toolCode}>{typeof tool.input === 'string' ? tool.input : JSON.stringify(tool.input, null, 2)}</div>
      )}
      {status === 'pending' && (
        <div className={s.toolActions}>
          <button className={s.approveBtn} onClick={() => onToolAction?.(tool.id, 'approve')}>
            Approve &amp; Run
          </button>
          <button className={s.denyBtn} onClick={() => onToolAction?.(tool.id, 'deny')}>
            Deny
          </button>
        </div>
      )}
      {(status === 'success' || status === 'failed') && tool.output && (
        <div className={s.toolOutput}>{tool.output}</div>
      )}
      {tool.images && tool.images.length > 0 && (
        <div className={s.toolImage}>
          {tool.images.map((img, i) => (
            <div key={i} className={s.toolImageInner}>
              <img src={img.url || img} alt={img.alt || 'Tool output'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, renderAIMarkdown }) {
  if (msg.role === 'user') {
    if (msg.type === 'tool_result') return null;
    return (
      <div className={`${s.msgRow} ${s.msgRowUser}`}>
        <div className={`${s.bubble} ${s.bubbleUser}`}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`${s.msgRow} ${s.msgRowAssistant}`}>
      <div className={`${s.bubble} ${s.bubbleAssistant}`}>
        {renderAIMarkdown ? renderAIMarkdown(msg.content || '') : (msg.content || '')}
      </div>
    </div>
  );
}

function SettingsOverlay({ aiConfig, onHideSettings, onSaveConfig, onSetConfig, maskApiKey }) {
  return (
    <div className={s.settingsOverlay}>
      <div className={s.settingsBackdrop} onClick={onHideSettings} />
      <div className={s.settingsPanel}>
        <h3 className={s.settingsTitle}>AI Settings</h3>
        <button className={s.settingsClose} onClick={onHideSettings} aria-label="Close settings">
          ✕
        </button>
        <div className={s.settingsField}>
          <label className={s.settingsLabel}>API Key</label>
          <input
            type="password"
            className={s.settingsInput}
            value={aiConfig?.apiKey || ''}
            onChange={(e) => onSetConfig({ ...aiConfig, apiKey: e.target.value })}
            placeholder="sk-ant-..."
          />
          <span className={s.settingsHint}>
            Get your key from the{' '}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
              Anthropic Console
            </a>
          </span>
        </div>
        <button className={s.settingsSave} onClick={onSaveConfig}>
          Save
        </button>
      </div>
    </div>
  );
}

export default function AIPage({
  aiMessages,
  aiStreaming,
  aiTokens,
  aiTotalTokens,
  aiInputValue,
  aiConfig,
  aiModels,
  aiError,
  aiShowSettings,
  aiTextareaRef,
  aiMessagesEndRef,
  isAiAuthed,
  activeToolExecution,
  onAiInputChange,
  onSendMessage,
  onStopStream,
  onClearChat,
  onShowSettings,
  onHideSettings,
  onSaveConfig,
  onSetConfig,
  onToolAction,
  maskApiKey,
  renderAIMarkdown,
}) {
  const hasMessages = aiMessages && aiMessages.length > 0;
  const showWelcome = !hasMessages && !aiStreaming;

  const inputBoxProps = {
    aiInputValue, onAiInputChange, onSendMessage, aiStreaming,
    aiConfig, aiModels, onSetConfig, aiTextareaRef,
  };

  return (
    <div className={s.container}>
      {/* Settings gear */}
      <button className={s.settingsBtn} onClick={onShowSettings} aria-label="Open settings">
        <IconSettings size={18} />
      </button>

      {showWelcome ? (
        /* ── Welcome state ── */
        <div className={s.welcome}>
          <IconLayers size={40} className={s.welcomeIcon} />
          <InputBox {...inputBoxProps} />
          {aiError && <div className={s.errorMsg}>{aiError}</div>}
          <div className={s.suggestions}>
            {SUGGESTIONS.map((text) => (
              <button
                key={text}
                className={s.suggestionBtn}
                onClick={() => { onAiInputChange(text); }}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Conversation state ── */
        <div className={s.conversation}>
          {/* Messages */}
          <div className={s.messages}>
            {(aiMessages || []).map((msg, i) => {
              if (msg.role === 'user' && msg.type === 'tool_result') return null;
              if (msg.role === 'tool' || msg.type === 'tool_use') {
                return <ToolCard key={i} tool={msg} onToolAction={onToolAction} />;
              }
              return <MessageBubble key={i} msg={msg} renderAIMarkdown={renderAIMarkdown} />;
            })}

            {/* Active tool execution */}
            {activeToolExecution && (
              <ToolCard tool={activeToolExecution} onToolAction={onToolAction} />
            )}

            {/* Streaming current tokens */}
            {aiStreaming && aiTokens && (
              <div className={`${s.msgRow} ${s.msgRowAssistant}`}>
                <div className={`${s.bubble} ${s.bubbleAssistant}`}>
                  {renderAIMarkdown ? renderAIMarkdown(aiTokens) : aiTokens}
                  <span className={s.streamCursor} />
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {aiStreaming && !aiTokens && !activeToolExecution && (
              <div className={s.thinking}>
                <span className={s.dot} />
                <span className={s.dot} />
                <span className={s.dot} />
              </div>
            )}

            <div ref={aiMessagesEndRef} />
          </div>

          {/* Stop button */}
          {aiStreaming && (
            <div className={s.stopWrap}>
              <button className={s.stopBtn} onClick={onStopStream}>
                <IconStop size={12} /> Stop
              </button>
            </div>
          )}

          {/* Input area */}
          <div className={s.inputArea}>
            <InputBox {...inputBoxProps} />
            {aiError && <div className={s.errorMsg}>{aiError}</div>}
            <div className={s.inputFooter}>
              <span className={s.inputHint}>Shift+Enter for new line</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {aiTotalTokens != null && (
                  <span className={s.tokenCount}>{aiTotalTokens.toLocaleString()} tokens</span>
                )}
                <button className={s.clearBtn} onClick={onClearChat}>Clear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings overlay */}
      {aiShowSettings && (
        <SettingsOverlay
          aiConfig={aiConfig}
          onHideSettings={onHideSettings}
          onSaveConfig={onSaveConfig}
          onSetConfig={onSetConfig}
          maskApiKey={maskApiKey}
        />
      )}
    </div>
  );
}
