import { useCallback, useRef, useState } from 'react';

// Voice input through the browser's Web Speech API (Chrome, Edge, Safari). Hindi uses hi-IN.
export function useSpeech(lang, onText) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => { rec.current?.stop(); setListening(false); }, []);

  const start = useCallback(() => {
    if (!Recognition) return false;
    const r = new Recognition();
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e) => {
      const text = [...e.results].slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ');
      if (text) onText(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
    return true;
  }, [Recognition, lang, onText]);

  return { supported: Boolean(Recognition), listening, start, stop };
}
