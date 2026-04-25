const GROQ_BASE = 'https://api.groq.com/openai/v1';

// Default model identifiers
export const MODELS = {
  transcription: 'whisper-large-v3',
  chat: 'llama-3.3-70b-versatile',
};

// Default prompts (editable in settings)
export const DEFAULT_PROMPTS = {
  suggestions: `You are an AI meeting copilot. Analyze the RECENT TRANSCRIPT from a live conversation and generate exactly 3 highly useful, actionable suggestions.

Each suggestion must:
1. Be immediately relevant to what was JUST said (last 30-60 seconds)
2. Deliver clear standalone value in its preview text alone
3. Be one of these types (choose the most fitting mix):
   - "question": An insightful question the user could ask to drive the conversation forward
   - "talking_point": A relevant talking point, counterpoint, or supporting argument
   - "answer": A direct answer to a question that was just asked
   - "fact_check": A factual correction or verification of a claim made

Return ONLY valid JSON in this exact format, no markdown:
{
  "suggestions": [
    {
      "type": "question|talking_point|answer|fact_check",
      "preview": "Short, punchy, self-contained value (1-2 sentences max)",
      "detail_prompt": "A question to send to the AI for a detailed expansion on this suggestion"
    }
  ]
}`,

  detailedAnswer: `You are a knowledgeable meeting copilot providing a detailed, helpful answer.
You have the full transcript of the conversation for context.
Keep your response concise, visually attractive, and highly scannable.
Format your response using Markdown:
- Use **bolding** for key terms and emphasis
- Use bullet points for lists and multiple points
- Keep paragraphs very short (1-2 sentences maximum)
- Use brief headers (e.g. ### Header) if breaking down complex topics
Be direct and actionable, avoiding large walls of text.`,

  chat: `You are TwinMind, an intelligent meeting copilot with access to the live transcript.
You help the user by answering questions, surfacing insights, and providing context based on what's being discussed.
Keep your response visually attractive, scannable, and extremely concise.
Format your response using Markdown:
- Use **bolding** for key terms
- Use bullet points wherever possible
- Keep explanations strictly brief (1-2 short sentences per point)
Focus purely on what's most useful to the user right now without any fluff.`,
};

export const DEFAULT_SETTINGS = {
  suggestionContextWindow: 8000,  // chars of recent transcript for suggestions
  answerContextWindow: 16000,     // chars of full transcript for detailed answers
  chunkIntervalSeconds: 30,
};

/**
 * Transcribe an audio blob using Whisper Large V3 via Groq
 */
export async function transcribeAudio(audioBlob, apiKey) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', MODELS.transcription);
  formData.append('response_format', 'json');

  const response = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  return data.text?.trim() || '';
}

/**
 * Generate exactly 3 live suggestions from the recent transcript context
 */
export async function generateSuggestions(recentTranscript, fullTranscript, settings, apiKey) {
  const context = recentTranscript.slice(-settings.suggestionContextWindow);
  const fullContext = fullTranscript.slice(-settings.suggestionContextWindow * 2);

  const userMessage = `FULL CONVERSATION CONTEXT (for background):
${fullContext || '(No prior context)'}

---
RECENT TRANSCRIPT (last ~30 seconds — focus suggestions on this):
${context || '(No recent transcript yet)'}

Generate exactly 3 suggestions based on the recent transcript.`;

  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.chatModel || MODELS.chat,
      messages: [
        { role: 'system', content: settings.suggestionsPrompt || DEFAULT_PROMPTS.suggestions },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Suggestions failed: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  return parsed.suggestions || [];
}

/**
 * Get a detailed answer when a suggestion is clicked
 */
export async function getDetailedAnswer(suggestionPreview, detailPrompt, fullTranscript, settings, apiKey) {
  const context = fullTranscript.slice(-settings.answerContextWindow);

  const messages = [
    { role: 'system', content: settings.detailedAnswerPrompt || DEFAULT_PROMPTS.detailedAnswer },
    {
      role: 'user',
      content: `FULL TRANSCRIPT:\n${context || '(none)'}\n\n---\nSuggestion clicked: "${suggestionPreview}"\n\nPlease provide a detailed, helpful answer to: ${detailPrompt}`,
    },
  ];

  return streamChatCompletion(messages, settings, apiKey);
}

/**
 * Send a chat message and stream the response
 */
export async function sendChatMessage(chatHistory, userMessage, fullTranscript, settings, apiKey) {
  const context = fullTranscript.slice(-settings.answerContextWindow);
  const systemPrompt = `${settings.chatPrompt || DEFAULT_PROMPTS.chat}\n\nLIVE TRANSCRIPT:\n${context || '(No transcript yet)'}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  return streamChatCompletion(messages, settings, apiKey);
}

/**
 * Shared streaming chat completion — returns an async generator
 */
async function* streamChatCompletion(messages, settings, apiKey) {
  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.chatModel || MODELS.chat,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Chat failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const token = json.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // ignore parse errors on partial lines
        }
      }
    }
  }
}
