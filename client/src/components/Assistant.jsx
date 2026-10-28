import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bot, Mic, MicOff, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useSpeech } from '../hooks/useSpeech';
import { api } from '../services/api';

// Floating AI civic assistant: the chat channel for reporting and status questions.
export default function Assistant() {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const endRef = useRef(null);
  const speech = useSpeech(lang, (text) => setInput((v) => `${v} ${text}`.trim()));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api('/assistant/chat', { method: 'POST', body: { messages: next.map(({ role, content }) => ({ role, content })), lang } });
      setMsgs([...next, { role: 'assistant', content: data.reply, draft: data.draft, complaintId: data.complaintId }]);
    } catch (err) {
      setMsgs([...next, { role: 'assistant', content: err.message }]);
    } finally {
      setBusy(false);
    }
  };

  const useDraft = (draft) => {
    setOpen(false);
    navigate(user?.role === 'citizen' ? '/report' : '/login', { state: { draft, from: '/report' } });
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={t('chat.open')}
        className="fixed bottom-5 right-5 z-[1100] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg shadow-brand-800/30 transition hover:scale-105">
        <Bot className="h-6 w-6" aria-hidden />
      </button>
    );
  }

  return (
    <section aria-label={t('chat.title')} className="fixed bottom-4 right-4 z-[1100] flex h-[32rem] max-h-[80vh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-ink-900">
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand-700 to-brand-800 px-4 py-3 text-white">
        <Bot className="h-5 w-5" aria-hidden />
        <h2 className="font-semibold">{t('chat.title')}</h2>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded p-1 hover:bg-white/10" aria-label="Close"><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 dark:bg-ink-800">{t('chat.hello')}</p>
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 ${m.role === 'user' ? 'rounded-tr-sm bg-brand-700 text-white' : 'rounded-tl-sm bg-slate-100 dark:bg-ink-800'}`}>
              {m.content}
              {m.draft && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-ink-900 dark:text-slate-200">
                  <p className="font-semibold">{m.draft.title}</p>
                  <p className="mt-1 capitalize text-slate-500">{m.draft.category}</p>
                  <button type="button" className="btn-primary mt-2 w-full py-1.5 text-xs" onClick={() => useDraft(m.draft)}>{t('chat.use')}</button>
                </div>
              )}
              {m.complaintId && <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => { setOpen(false); navigate(`/complaints/${m.complaintId}`); }}>Open case</button>}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-500">…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
        {speech.supported && (
          <button type="button" onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening}
            className={`btn-ghost h-10 w-10 shrink-0 rounded-full p-0 ${speech.listening ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200' : ''}`}
            aria-label={speech.listening ? t('report.listening') : t('report.speak')}>
            {speech.listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          </button>
        )}
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chat.ph')} aria-label={t('chat.ph')} maxLength={2000} />
        <button className="btn-primary h-10 w-10 shrink-0 rounded-full p-0" disabled={busy || !input.trim()} aria-label={t('chat.send')}><Send className="h-4 w-4" aria-hidden /></button>
      </form>
    </section>
  );
}
