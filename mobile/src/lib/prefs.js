import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const S = {
  en: {
    profile: 'Profile', myReports: 'My reports', report: 'Report', nearby: 'Nearby', chat: 'Assistant', queue: 'Queue', signOut: 'Out',
    reportTitle: 'Report an issue', reportSub: 'A clear photo and exact location help the right team.',
    shortTitle: 'Short title', what: 'What is the problem?', whatPh: 'English or Hindi is fine. Tap the mic on your keyboard to speak.',
    category: 'Category', ward: 'Ward', landmark: 'Landmark (optional)', location: 'Location', useLoc: 'Use my location', locating: 'Locating…',
    photos: 'Photos', camera: 'Camera', gallery: 'Gallery', submit: 'Submit report', submitting: 'Submitting…',
    dups: 'Possibly already reported nearby', dupsHint: 'You can still submit; staff decide if it is the same issue.',
    savedOffline: 'No connection. Your report is saved on this phone and will be sent automatically.',
    queued: (n) => `${n} report(s) waiting to be sent`, metoo: 'Me too', nearbyTitle: 'Issues near you', nearbySub: 'Your "me too" raises priority.',
    chatTitle: 'Civic assistant', chatPh: 'Describe a problem or paste a reference ID', send: 'Send', useDraft: 'Use this draft',
    chatHello: 'Namaste! Describe a problem and I will draft a report, or send a reference ID to check its status.',
  },
  hi: {
    profile: 'प्रोफ़ाइल', myReports: 'मेरी शिकायतें', report: 'शिकायत', nearby: 'आस-पास', chat: 'सहायक', queue: 'कतार', signOut: 'बाहर',
    reportTitle: 'समस्या दर्ज करें', reportSub: 'साफ़ फ़ोटो और सही लोकेशन से सही टीम जल्दी काम करती है।',
    shortTitle: 'छोटा शीर्षक', what: 'समस्या क्या है?', whatPh: 'हिंदी या अंग्रेज़ी में लिखें। बोलने के लिए कीबोर्ड का माइक दबाएँ।',
    category: 'श्रेणी', ward: 'वार्ड', landmark: 'पहचान स्थल (वैकल्पिक)', location: 'लोकेशन', useLoc: 'मेरी लोकेशन लें', locating: 'लोकेशन ढूँढ रहे हैं…',
    photos: 'फ़ोटो', camera: 'कैमरा', gallery: 'गैलरी', submit: 'शिकायत भेजें', submitting: 'भेजी जा रही है…',
    dups: 'शायद यह पहले ही दर्ज है', dupsHint: 'आप फिर भी भेज सकते हैं; स्टाफ़ तय करेगा।',
    savedOffline: 'इंटरनेट नहीं है। शिकायत फ़ोन में सेव है और अपने आप भेज दी जाएगी।',
    queued: (n) => `${n} शिकायत भेजी जानी बाकी`, metoo: 'मेरी भी', nearbyTitle: 'आपके आस-पास की समस्याएँ', nearbySub: '"मेरी भी" से प्राथमिकता बढ़ती है।',
    chatTitle: 'नागरिक सहायक', chatPh: 'समस्या लिखें या रेफ़रेंस आईडी डालें', send: 'भेजें', useDraft: 'यह ड्राफ़्ट इस्तेमाल करें',
    chatHello: 'नमस्ते! समस्या बताइए, मैं शिकायत तैयार कर दूँगा, या रेफ़रेंस आईडी भेजिए।',
  },
};

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [lang, setLang] = useState('en');
  useEffect(() => { AsyncStorage.getItem('lang').then((l) => l && setLang(l)); }, []);
  const value = useMemo(() => ({
    lang,
    toggleLang: () => setLang((l) => { const n = l === 'en' ? 'hi' : 'en'; AsyncStorage.setItem('lang', n); return n; }),
    t: (k, ...a) => { const s = S[lang][k] ?? S.en[k] ?? k; return typeof s === 'function' ? s(...a) : s; },
  }), [lang]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
