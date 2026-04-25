import { useEffect, useRef } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';

export default function TranscriptColumn({ chunks, isRecording, isTranscribing, error, onStart, onStop }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks]);

  return (
    <div className="column">
      <div className="column-header">
        <h2>
          <span className="col-icon">📝</span> Transcript
        </h2>
        <div className="header-actions">
          {isTranscribing && (
            <span className="status-badge processing">
              <Loader size={12} className="spinner" /> Processing…
            </span>
          )}
          {isRecording && !isTranscribing && (
            <span className="status-badge live">
              <span className="pulse-dot" /> Live
            </span>
          )}
          <button
            id="mic-toggle-btn"
            className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
            onClick={isRecording ? onStop : onStart}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            {isRecording ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      <div className="column-content" id="transcript-scroll">
        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {chunks.length === 0 && !isRecording && (
          <div className="empty-state">
            <Mic size={40} />
            <p>Click <strong>Start</strong> to begin recording.<br />Transcript will appear here.</p>
          </div>
        )}

        {chunks.map((chunk) => (
          <div key={chunk.id} className="transcript-chunk">
            <span className="transcript-time">{chunk.timestamp}</span>
            <span className="transcript-text">{chunk.text}</span>
          </div>
        ))}

        {isRecording && chunks.length === 0 && (
          <div className="listening-hint">
            <span className="pulse-dot large" />
            Listening… transcript will appear in ~30 seconds.
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
