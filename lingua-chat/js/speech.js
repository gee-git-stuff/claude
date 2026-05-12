/**
 * Speech module: Web Speech API for recognition and synthesis.
 */
const Speech = (() => {
  let recognition = null;
  let isListening = false;
  let onResultCallback = null;
  let onErrorCallback = null;
  let onEndCallback = null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function isRecognitionSupported() {
    return !!SpeechRecognition;
  }

  function isSynthesisSupported() {
    return 'speechSynthesis' in window;
  }

  function initRecognition(lang) {
    if (!isRecognitionSupported()) return false;

    recognition = new SpeechRecognition();
    recognition.lang = LanguageData.SPEECH_CODES[lang] || lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript;
      const isFinal = last.isFinal;
      if (onResultCallback) onResultCallback(transcript, isFinal);
    };

    recognition.onerror = (event) => {
      isListening = false;
      if (onErrorCallback) onErrorCallback(event.error);
    };

    recognition.onend = () => {
      isListening = false;
      if (onEndCallback) onEndCallback();
    };

    return true;
  }

  function startListening(lang, { onResult, onError, onEnd } = {}) {
    if (isListening) {
      stopListening();
    }

    onResultCallback = onResult || null;
    onErrorCallback = onError || null;
    onEndCallback = onEnd || null;

    initRecognition(lang);
    if (!recognition) return false;

    try {
      recognition.start();
      isListening = true;
      return true;
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
      return false;
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    isListening = false;
  }

  function speak(text, lang, rate = 1.0) {
    if (!isSynthesisSupported()) return false;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LanguageData.SPEECH_CODES[lang] || lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Try to find a voice for this language
    const voices = window.speechSynthesis.getVoices();
    const langCode = LanguageData.SPEECH_CODES[lang] || lang;
    const matchedVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    return new Promise((resolve) => {
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    });
  }

  function speakSlow(text, lang) {
    return speak(text, lang, 0.6);
  }

  function getListening() {
    return isListening;
  }

  // Preload voices (some browsers need this)
  function preloadVoices() {
    if (isSynthesisSupported()) {
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }

  return {
    isRecognitionSupported,
    isSynthesisSupported,
    startListening,
    stopListening,
    speak,
    speakSlow,
    getListening,
    preloadVoices
  };
})();
