import { useState, useCallback, useRef, useEffect } from 'react';
import { Settings, Download, AlertCircle } from 'lucide-react';
import './styles/global.css';

import { useAudioRecorder } from './hooks/useAudioRecorder';
import {
  transcribeAudio,
  generateSuggestions,
  getDetailedAnswer,
  sendChatMessage,
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS,
} from './services/groqService';

import TranscriptColumn from './components/TranscriptColumn';
import SuggestionsColumn from './components/SuggestionsColumn';
import ChatColumn from './components/ChatColumn';
import SettingsModal from './components/SettingsModal';

// ---------- helpers ----------
const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const uid = () => Math.random().toString(36).slice(2);

function loadSettings() {
  try {
    const saved = localStorage.getItem('twinmind_settings');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    apiKey: '',
    suggestionsPrompt: DEFAULT_PROMPTS.suggestions,
    detailedAnswerPrompt: DEFAULT_PROMPTS.detailedAnswer,
    chatPrompt: DEFAULT_PROMPTS.chat,
    suggestionContextWindow: DEFAULT_SETTINGS.suggestionContextWindow,
    answerContextWindow: DEFAULT_SETTINGS.answerContextWindow,
  };
}

function saveSettings(s) {
  localStorage.setItem('twinmind_settings', JSON.stringify(s));
}

// ---------- App ----------
export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(() => !loadSettings().apiKey);

  // Transcript
  const [transcriptChunks, setTranscriptChunks] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState(null);
  const fullTranscriptRef = useRef('');

  // Suggestions
  const [suggestionBatches, setSuggestionBatches] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Global error banner
  const [globalError, setGlobalError] = useState(null);

  // ---------- Suggestions ----------
  // Defined first so handleAudioChunk can reference it via ref
  const fetchSuggestions = useCallback(async () => {
    const full = fullTranscriptRef.current;
    if (!full.trim()) {
      setSuggestionError('No transcript yet — start speaking first.');
      return;
    }
    if (!settings.apiKey) {
      setSuggestionError('No API key set.');
      return;
    }

    setIsFetchingSuggestions(true);
    setSuggestionError(null);
    try {
      const recent = full.slice(-Math.floor(settings.suggestionContextWindow / 2));
      const suggestions = await generateSuggestions(recent, full, settings, settings.apiKey);
      if (suggestions.length > 0) {
        setSuggestionBatches((prev) => [
          { id: uid(), timestamp: now(), suggestions },
          ...prev,
        ]);
      }
    } catch (err) {
      setSuggestionError(err.message);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [settings]);

  // Keep a stable ref to fetchSuggestions so the audio handler always calls the latest version
  const fetchSuggestionsRef = useRef(fetchSuggestions);
  useEffect(() => { fetchSuggestionsRef.current = fetchSuggestions; }, [fetchSuggestions]);

  // ---------- Audio chunk handler ----------
  const handleAudioChunk = useCallback(
    async (blob) => {
      if (!settings.apiKey) {
        setGlobalError('Please enter your Groq API key in Settings.');
        return;
      }
      setIsTranscribing(true);
      setTranscriptError(null);
      try {
        const text = await transcribeAudio(blob, settings.apiKey);
        if (!text) return;

        const timestamp = now();
        const chunkId = uid();
        setTranscriptChunks((prev) => [...prev, { id: chunkId, timestamp, text }]);
        fullTranscriptRef.current += (fullTranscriptRef.current ? '\n' : '') + text;

        // Auto-generate suggestions after each chunk (via ref to avoid stale closure)
        await fetchSuggestionsRef.current();
      } catch (err) {
        setTranscriptError(err.message);
      } finally {
        setIsTranscribing(false);
      }
    },
    [settings]
  );

  const { isRecording, error: micError, startRecording, stopRecording } = useAudioRecorder(handleAudioChunk);

  // ---------- Suggestion click → Chat ----------
  const handleSuggestionClick = useCallback(
    async (suggestion) => {
      const userMsg = {
        id: uid(),
        role: 'user',
        content: suggestion.preview,
        timestamp: now(),
        fromSuggestion: true,
      };
      setChatMessages((prev) => [...prev, userMsg]);

      setIsStreaming(true);
      const assistantId = uid();
      setChatMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: now(), fromSuggestion: true },
      ]);

      try {
        const stream = await getDetailedAnswer(
          suggestion.preview,
          suggestion.detail_prompt || suggestion.preview,
          fullTranscriptRef.current,
          settings,
          settings.apiKey
        );

        for await (const token of stream) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
          );
          await new Promise((r) => setTimeout(r, 25));
        }
      } catch (err) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${err.message}` } : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [settings]
  );

  // ---------- Chat send ----------
  const handleChatSend = useCallback(
    async (text) => {
      // Snapshot history BEFORE adding the new user message
      const historySnapshot = chatMessages.filter((m) => m.content.trim());

      const userMsg = { id: uid(), role: 'user', content: text, timestamp: now() };
      const assistantId = uid();

      setChatMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', timestamp: now() },
      ]);

      setIsStreaming(true);

      try {
        const stream = await sendChatMessage(
          historySnapshot,
          text,
          fullTranscriptRef.current,
          settings,
          settings.apiKey
        );

        for await (const token of stream) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
          );
          await new Promise((r) => setTimeout(r, 25));
        }
      } catch (err) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${err.message}` } : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [chatMessages, settings]
  );

  // ---------- Settings save ----------
  const handleSaveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setGlobalError(null);
  }, []);

  // ---------- Export ----------
  const handleExport = useCallback(() => {
    const session = {
      exportedAt: new Date().toISOString(),
      transcript: transcriptChunks.map((c) => ({ time: c.timestamp, text: c.text })),
      suggestionBatches: suggestionBatches.map((b) => ({
        time: b.timestamp,
        suggestions: b.suggestions,
      })),
      chat: chatMessages.map((m) => ({
        time: m.timestamp,
        role: m.role,
        content: m.content,
        fromSuggestion: m.fromSuggestion || false,
      })),
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twinmind-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcriptChunks, suggestionBatches, chatMessages]);

  // Clear global error after 5s
  useEffect(() => {
    if (!globalError) return;
    const t = setTimeout(() => setGlobalError(null), 5000);
    return () => clearTimeout(t);
  }, [globalError]);

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-brand">
          <span className="brand-logo">⚡</span>
          <span className="brand-name">TwinMind</span>
          <span className="brand-sub">Live Suggestions</span>
        </div>
        <div className="top-bar-actions">
          <button
            id="export-btn"
            className="btn"
            onClick={handleExport}
            title="Export session"
            disabled={transcriptChunks.length === 0 && chatMessages.length === 0}
          >
            <Download size={16} />
            Export
          </button>
          <button
            id="settings-btn"
            className="btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="global-error">
          <AlertCircle size={16} />
          {globalError}
        </div>
      )}

      {/* Main columns */}
      <div className="app-container">
        <TranscriptColumn
          chunks={transcriptChunks}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          error={micError || transcriptError}
          onStart={startRecording}
          onStop={stopRecording}
        />

        <SuggestionsColumn
          batches={suggestionBatches}
          isLoading={isFetchingSuggestions}
          error={suggestionError}
          onRefresh={fetchSuggestions}
          onSuggestionClick={handleSuggestionClick}
        />

        <ChatColumn
          messages={chatMessages}
          isStreaming={isStreaming}
          onSend={handleChatSend}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
