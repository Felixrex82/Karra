/**
 * Real Web Speech API voice capture utility for Karra.
 * Provides live speech-to-text with zero fallback to sample text.
 */

export interface SpeechRecognitionOptions {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  lang?: string;
}

export interface VoiceCaptureController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isSupported: boolean;
}

// Browser compatibility detection
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

export function createSpeechRecognizer(
  options: SpeechRecognitionOptions
): VoiceCaptureController {
  if (!isSpeechRecognitionSupported()) {
    return {
      start: () => {
        options.onError?.(
          'Voice input is not supported in this browser. Please use Chrome, Edge, or Safari, or type your update.'
        );
      },
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  const SpeechRecognitionConstructor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  let recognition: any = null;
  let finalTranscript = '';

  try {
    recognition = new SpeechRecognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // Prefer Nigerian English with broad fallback to English
    recognition.lang = options.lang || 'en-NG';
  } catch (err: any) {
    console.warn('SpeechRecognition initialization error:', err);
    return {
      start: () => options.onError?.('Could not initialize microphone recognition.'),
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  recognition.onstart = () => {
    finalTranscript = '';
    options.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const trans = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += trans;
      } else {
        interim += trans;
      }
    }
    const currentText = finalTranscript || interim;
    options.onResult?.(currentText, Boolean(finalTranscript));
  };

  recognition.onerror = (event: any) => {
    let errorMsg = 'Voice recognition error.';
    switch (event.error) {
      case 'not-allowed':
      case 'service-not-allowed':
        errorMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings to speak.';
        break;
      case 'no-speech':
        errorMsg = 'No speech was detected. Please tap the microphone and speak clearly.';
        break;
      case 'audio-capture':
        errorMsg = 'No microphone was found or audio capture failed. Please check your audio settings.';
        break;
      case 'network':
        errorMsg = 'Network error during voice transcription. Please check your connection or type directly.';
        break;
      case 'aborted':
        return; // User canceled intentionally
      default:
        errorMsg = event.message || `Voice recognition issue: ${event.error}`;
    }
    options.onError?.(errorMsg);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  return {
    start: () => {
      try {
        finalTranscript = '';
        recognition.start();
      } catch (e: any) {
        if (e.name === 'InvalidStateError') {
          // Already active, restart
          try {
            recognition.stop();
            setTimeout(() => recognition.start(), 100);
          } catch {}
        } else {
          options.onError?.(e.message || 'Could not start microphone.');
        }
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {}
    },
    isSupported: true,
  };
}
