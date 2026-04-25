# TwinMind – Live Suggestions

An always-on AI meeting copilot that listens to your mic and continuously surfaces live suggestions — questions to ask, talking points, answers, and fact-checks — while you speak.

## Live Demo

> Deploy on Vercel/Netlify by connecting this repo. Static build, no backend required.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Fast HMR, minimal config, easy static deploy |
| Styling | Vanilla CSS (CSS variables) | No framework overhead, full design control |
| Transcription | Groq — Whisper Large V3 | Best OSS speech-to-text, fast on Groq |
| LLM | Groq — Llama 4 Maverick 17B | Fast inference, long context, JSON mode |
| State | React useState/useRef | Simple enough; no Redux needed |
| Persistence | localStorage (settings only) | No backend, no login required |

---

## Setup

1. **Clone & install**
   ```bash
   git clone <repo-url>
   cd live-suggest-ai
   npm install
   ```

2. **Run dev server**
   ```bash
   npm run dev
   ```

3. **Open** `http://localhost:5173` in your browser.

4. **Paste your Groq API key** in Settings (⚙️ top-right). Get one free at [console.groq.com](https://console.groq.com).

5. Click **Start**, speak for ~30 seconds, and watch suggestions appear.

---

## Prompt Strategy

### Live Suggestions
The suggestion prompt instructs the model to produce **exactly 3 JSON-structured suggestions** differentiated by type:

- `question` — a smart follow-up question to drive the conversation
- `talking_point` — a relevant point or counterpoint the user could raise
- `answer` — a direct answer to a question just asked in the transcript
- `fact_check` — a factual verification or correction of a claim made

**Context design:** The model receives two windows:
- **Recent transcript** (last ~4,000 chars ≈ 2–3 min): the primary focus for suggestions
- **Full transcript** (last ~8,000 chars): for background awareness without confusion

**Why JSON mode?** Forces structured output, eliminates parsing errors, and ensures we always get exactly 3 typed suggestions.

### Detailed Answers (click to expand)
When a suggestion card is clicked, a separate prompt is fired with the **full transcript context** and the specific `detail_prompt` field generated alongside the suggestion. This prompt asks for thorough, structured, actionable output — not a short answer.

### Chat
The chat system prompt is given the full transcript as context. Each message in the session is sent as part of the message history, maintaining coherent multi-turn conversation.

---

## Architecture

```
src/
├── services/
│   └── groqService.js     # All Groq API calls (Whisper, suggestions, chat). Streaming via SSE.
├── hooks/
│   └── useAudioRecorder.js # MediaRecorder with 30s chunking + blob emission
├── components/
│   ├── TranscriptColumn.jsx   # Left: mic control + scrolling transcript
│   ├── SuggestionsColumn.jsx  # Middle: batched suggestion cards with type tags
│   ├── ChatColumn.jsx         # Right: chat history + streaming answer display
│   └── SettingsModal.jsx      # API key, prompt editing, context windows
├── styles/
│   └── global.css         # All styles via CSS variables — no utility framework
└── App.jsx                # Global state, orchestration, export
```

---

## Key Design Decisions & Tradeoffs

1. **Browser-only, no backend**: The Groq key is stored in `localStorage` and API calls go directly from the browser. This makes hosting trivially easy but exposes the key to devtools. Acceptable for this assignment (no user data stored server-side either).

2. **30s audio chunks**: Audio is segmented every 30 seconds via `MediaRecorder`. Each chunk is sent to Whisper, then suggestions are auto-refreshed. A manual Refresh button lets users trigger early.

3. **Streaming chat**: All chat and detailed answers use Server-Sent Events (streaming) so the first token appears in ~200ms, making it feel fast even for long responses.

4. **Suggestion batches persist**: New batches prepend to the top; older ones stay visible so users can scroll back. This mirrors TwinMind's own UX.

5. **`response_format: json_object`**: Used for the suggestions endpoint to guarantee valid, parseable JSON from the LLM.

---

## Export Format

Clicking **Export** downloads a `.json` file with:
```json
{
  "exportedAt": "ISO timestamp",
  "transcript": [{ "time": "HH:MM:SS", "text": "..." }],
  "suggestionBatches": [{ "time": "...", "suggestions": [...] }],
  "chat": [{ "time": "...", "role": "user|assistant", "content": "...", "fromSuggestion": false }]
}
```
