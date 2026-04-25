import { useRef, useState, useCallback } from 'react';

const CHUNK_INTERVAL_MS = 30000; // 30 seconds

/**
 * useAudioRecorder
 * Manages mic recording and emits audio blobs every ~30s.
 * @param {Function} onChunk - called with (audioBlob) each time a chunk is ready
 */
export function useAudioRecorder(onChunk) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunkTimerRef = useRef(null);
  const chunksRef = useRef([]);

  const flushChunk = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Stop current recorder; ondataavailable will fire with the collected chunks
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startNewSegment = useCallback(
    (stream) => {
      chunksRef.current = [];

      const options = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, options ? { mimeType: options } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const mimeType = options || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onChunk(blob);
        }
        // If still recording (not stopped by user), start a new segment
        if (streamRef.current && streamRef.current.active) {
          startNewSegment(stream);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      // Schedule a flush after CHUNK_INTERVAL_MS
      chunkTimerRef.current = setTimeout(flushChunk, CHUNK_INTERVAL_MS);
    },
    [onChunk, flushChunk]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsRecording(true);
      startNewSegment(stream);
    } catch (err) {
      setError(err.message || 'Microphone access denied');
    }
  }, [startNewSegment]);

  const stopRecording = useCallback(() => {
    clearTimeout(chunkTimerRef.current);

    // Stop the current recorder (ondataavailable + onstop will fire)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        if (chunksRef.current.length > 0) {
          const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onChunk(blob);
        }
      };
      mediaRecorderRef.current.stop();
    }

    // Stop all mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, [onChunk]);

  return { isRecording, error, startRecording, stopRecording };
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}
