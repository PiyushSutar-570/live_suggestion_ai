import { useEffect, useRef, useState } from 'react';
import { Send, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatColumn({ messages, isStreaming, onSend }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="column">
      <div className="column-header">
        <h2>
          <span className="col-icon">💬</span> Chat
        </h2>
        {isStreaming && (
          <span className="status-badge processing">
            <Loader size={12} className="spinner" /> Thinking…
          </span>
        )}
      </div>

      <div className="column-content chat-messages" id="chat-scroll">
        {messages.length === 0 && (
          <div className="empty-state">
            <span style={{ fontSize: 40 }}>🤖</span>
            <p>Click a suggestion for a detailed answer, or type a question below.</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="chat-message assistant">
            <div className="message-bubble">
              <Loader size={14} className="spinner" style={{ marginRight: 6 }} />
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          placeholder="Ask a question or type anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button
          id="chat-send-btn"
          className="btn btn-primary"
          type="submit"
          disabled={!input.trim() || isStreaming}
          title="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <span className="msg-role-label">
          {message.fromSuggestion ? '💡 From Suggestion' : '🤖 TwinMind'}
        </span>
      )}
      <div className="message-bubble markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
      </div>
      <span className="msg-time">{message.timestamp}</span>
    </div>
  );
}
