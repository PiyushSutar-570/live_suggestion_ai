import { useState, useEffect } from 'react';
import { X, Key, MessageSquare, Sliders } from 'lucide-react';
import { DEFAULT_PROMPTS, DEFAULT_SETTINGS } from '../services/groqService';

export default function SettingsModal({ settings, onSave, onClose }) {
  const [local, setLocal] = useState(settings);
  const [activeTab, setActiveTab] = useState('api');

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const set = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  const handleReset = () => {
    const defaults = {
      apiKey: local.apiKey,
      suggestionsPrompt: DEFAULT_PROMPTS.suggestions,
      detailedAnswerPrompt: DEFAULT_PROMPTS.detailedAnswer,
      chatPrompt: DEFAULT_PROMPTS.chat,
      suggestionContextWindow: DEFAULT_SETTINGS.suggestionContextWindow,
      answerContextWindow: DEFAULT_SETTINGS.answerContextWindow,
    };
    setLocal(defaults);
  };

  const tabs = [
    { id: 'api', label: 'API Key', icon: Key },
    { id: 'prompts', label: 'Prompts', icon: MessageSquare },
    { id: 'context', label: 'Context', icon: Sliders },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="settings-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`settings-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'api' && (
          <div className="tab-panel">
            <div className="form-group">
              <label htmlFor="apiKey">Groq API Key</label>
              <input
                id="apiKey"
                type="password"
                placeholder="gsk_..."
                value={local.apiKey || ''}
                onChange={(e) => set('apiKey', e.target.value)}
              />
              <p className="field-hint">
                Get your key at{' '}
                <a href="https://console.groq.com" target="_blank" rel="noreferrer">
                  console.groq.com
                </a>
                . Stored locally, never sent to our servers.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="tab-panel">
            <div className="form-group">
              <label htmlFor="suggestionsPrompt">Live Suggestions System Prompt</label>
              <textarea
                id="suggestionsPrompt"
                rows={8}
                value={local.suggestionsPrompt || ''}
                onChange={(e) => set('suggestionsPrompt', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="detailedAnswerPrompt">Detailed Answer System Prompt</label>
              <textarea
                id="detailedAnswerPrompt"
                rows={5}
                value={local.detailedAnswerPrompt || ''}
                onChange={(e) => set('detailedAnswerPrompt', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="chatPrompt">Chat System Prompt</label>
              <textarea
                id="chatPrompt"
                rows={5}
                value={local.chatPrompt || ''}
                onChange={(e) => set('chatPrompt', e.target.value)}
              />
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <div className="tab-panel">
            <div className="form-group">
              <label htmlFor="suggestionContextWindow">
                Suggestion Context Window (chars)
              </label>
              <input
                id="suggestionContextWindow"
                type="number"
                min={500}
                max={32000}
                step={500}
                value={local.suggestionContextWindow || DEFAULT_SETTINGS.suggestionContextWindow}
                onChange={(e) => set('suggestionContextWindow', Number(e.target.value))}
              />
              <p className="field-hint">
                How many characters of recent transcript to send when generating suggestions (~8000 = ~5 min).
              </p>
            </div>
            <div className="form-group">
              <label htmlFor="answerContextWindow">
                Answer Context Window (chars)
              </label>
              <input
                id="answerContextWindow"
                type="number"
                min={1000}
                max={64000}
                step={1000}
                value={local.answerContextWindow || DEFAULT_SETTINGS.answerContextWindow}
                onChange={(e) => set('answerContextWindow', Number(e.target.value))}
              />
              <p className="field-hint">
                How many characters of full transcript to pass for detailed answers and chat.
              </p>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={handleReset}>
            Reset Defaults
          </button>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
