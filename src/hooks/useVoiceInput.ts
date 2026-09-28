import { useState, useRef, useEffect, useCallback } from 'react';
import { createSpeechRecognizer, isSpeechRecognitionSupported, VoiceCaptureController } from '../utils/speechRecognition';

export interface UseVoiceInputProps {
  onTranscript?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
  lang?: string;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export function useVoiceInput({
  onTranscript,
  onError,
  lang = 'en-NG',
}: UseVoiceInputProps = {}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controllerRef = useRef<VoiceCaptureController | null>(null);

  const isSupported = isSpeechRecognitionSupported();

  const handleStart = useCallback(() => {
    setErrorMessage(null);
    setInterimTranscript('');

    if (!isSupported) {
      const err = 'Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.';
      setErrorMessage(err);
      onError?.(err);
      setVoiceState('error');
      return;
    }

    controllerRef.current = createSpeechRecognizer({
      lang,
      onStart: () => {
        setVoiceState('listening');
      },
      onResult: (text, isFinal) => {
        setInterimTranscript(text);
        if (isFinal) {
          setVoiceState('processing');
          onTranscript?.(text);
          setVoiceState('idle');
          setInterimTranscript('');
        }
      },
      onError: (err) => {
        setVoiceState('error');
        setErrorMessage(err);
        onError?.(err);
        setTimeout(() => {
          setVoiceState((current) => (current === 'error' ? 'idle' : current));
        }, 4000);
      },
      onEnd: () => {
        setVoiceState((current) => {
          if (current === 'listening') return 'idle';
          return current;
        });
      },
    });

    controllerRef.current.start();
  }, [isSupported, lang, onTranscript, onError]);

  const handleStop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
    }
    setVoiceState('idle');
  }, []);

  const handleToggle = useCallback(() => {
    if (voiceState === 'listening') {
      handleStop();
    } else {
      handleStart();
    }
  }, [voiceState, handleStart, handleStop]);

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return {
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    voiceState,
    interimTranscript,
    errorMessage,
    isSupported,
    startListening: handleStart,
    stopListening: handleStop,
    toggleListening: handleToggle,
  };
}
