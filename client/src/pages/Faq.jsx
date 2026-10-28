import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Search } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { useReveal } from '../hooks/useMotion';

const FAQ = [
  ['Getting started', [
    [{ en: 'Is NagriVanta free?', hi: 'क्या NagriVanta मुफ़्त है?' }, { en: 'Yes. Creating an account, reporting and tracking are free for citizens.', hi: 'हाँ। नागरिकों के लिए खाता बनाना, शिकायत करना और ट्रैक करना मुफ़्त है।' }],
    [{ en: 'Do I need an account to report?', hi: 'क्या शिकायत के लिए खाता ज़रूरी है?' }, { en: 'Yes, so we can notify you and stop spam. Anyone can track a case without signing in on the Track page.', hi: 'हाँ, ताकि आपको सूचना मिले और फ़र्ज़ी शिकायतें रुकें। ट्रैक पेज पर बिना लॉगिन कोई भी स्थिति देख सकता है।' }],
    [{ en: 'Which problems can I report?', hi: 'कौन-सी समस्याएँ दर्ज कर सकते हैं?' }, { en: 'Potholes and damaged roads, garbage and dumping, water leaks and supply, streetlights, drains, sewers and waterlogging, plus "other" civic issues.', hi: 'गड्ढे और टूटी सड़कें, कूड़ा, पानी का रिसाव, स्ट्रीटलाइट, नाली, सीवर, जलभराव, और अन्य नागरिक समस्याएँ।' }],
    [{ en: 'Is this for emergencies?', hi: 'क्या यह आपातकाल के लिए है?' }, { en: 'No. If anyone is in danger, call 112 immediately.', hi: 'नहीं। किसी की जान को ख़तरा हो तो तुरंत 112 पर कॉल करें।' }],
  ]],
  ['Reporting', [
    [{ en: 'How do I set the exact location?', hi: 'सही लोकेशन कैसे चुनें?' }, { en: 'Use "My location", search a landmark, click the map, or type your pincode to jump to your area. Switch to Satellite view to spot the exact building.', hi: '"मेरी लोकेशन" दबाएँ, जगह खोजें, नक्शे पर क्लिक करें, या पिनकोड डालें। सही इमारत देखने के लिए Satellite व्यू चुनें।' }],
    [{ en: 'Why does it ask for my pincode?', hi: 'पिनकोड क्यों पूछा जाता है?' }, { en: 'It is optional. It fills in your district and area, moves the map to you, and helps departments plan by area.', hi: 'यह वैकल्पिक है। इससे ज़िला और इलाक़ा अपने आप भरता है और नक्शा आपके पास आ जाता है।' }],
    [{ en: 'Can I report in Hindi or by voice?', hi: 'क्या हिंदी में या बोलकर शिकायत कर सकते हैं?' }, { en: 'Yes. Write in Hindi, English or Hinglish, or press Speak. Switch the whole interface with the हिं button.', hi: 'हाँ। हिंदी, अंग्रेज़ी या हिंग्लिश में लिखें, या "बोलें" दबाएँ। हिं बटन से पूरा इंटरफ़ेस हिंदी में।' }],
    [{ en: 'What if someone already reported it?', hi: 'अगर किसी ने पहले ही दर्ज कर दिया हो?' }, { en: 'You will see similar nearby reports while typing. Add your "Me too" to show more people are affected; it raises the priority.', hi: 'लिखते समय पास की मिलती-जुलती शिकायतें दिखेंगी। "मेरी भी" दबाएँ, इससे प्राथमिकता बढ़ती है।' }],
    [{ en: 'I have no internet. What happens?', hi: 'इंटरनेट नहीं है तो क्या होगा?' }, { en: 'Your report is saved on your device and sent automatically when you are back online.', hi: 'शिकायत आपके डिवाइस पर सेव हो जाती है और इंटरनेट आने पर अपने आप भेज दी जाती है।' }],
  ]],
  ['After you report', [
    [{ en: 'How long will it take?', hi: 'कितना समय लगेगा?' }, { en: 'Each case gets a target date by priority (by default: critical 8 h, high 24 h, medium 3 days, low 7 days). Overdue cases are escalated to administrators automatically.', hi: 'प्राथमिकता के हिसाब से लक्ष्य तिथि मिलती है (गंभीर 8 घंटे, ऊँची 24 घंटे, मध्यम 3 दिन, कम 7 दिन)। देर होने पर मामला अपने आप ऊपर जाता है।' }],
    [{ en: 'How do I know it was really fixed?', hi: 'कैसे पता चले कि सच में ठीक हुआ?' }, { en: 'Officers must upload a new after-photo. The system checks it is different from your photo, was not reused, and was taken after your report and near the spot. You can rate it or reopen it.', hi: 'अधिकारी को मरम्मत के बाद की नई फ़ोटो डालनी होती है। सिस्टम जाँचता है कि फ़ोटो अलग है, दोबारा इस्तेमाल नहीं हुई और सही जगह ली गई। आप रेटिंग दे या फिर से खोल सकते हैं।' }],
    [{ en: 'Can records be changed later?', hi: 'क्या रिकॉर्ड बाद में बदले जा सकते हैं?' }, { en: 'Every step is stored in a hash-chained history. Any later edit breaks the chain and shows as an integrity warning on the case.', hi: 'हर कदम हैश-चेन वाले रिकॉर्ड में दर्ज होता है। बाद में बदलाव करने पर चेतावनी दिखती है।' }],
  ]],
  ['Privacy & AI', [
    [{ en: 'Who can see my name and location?', hi: 'मेरा नाम और लोकेशन कौन देख सकता है?' }, { en: 'Only staff handling your case. Public pages show totals and locations rounded to about 100 m, never your name.', hi: 'सिर्फ़ आपके केस पर काम करने वाला स्टाफ़। सार्वजनिक पेज पर नाम नहीं, केवल ~100 मीटर तक अनुमानित लोकेशन।' }],
    [{ en: 'Does AI decide my case?', hi: 'क्या AI मेरा केस तय करता है?' }, { en: 'No. AI only suggests a category, summary and priority, with its reasons. Authorised staff confirm every decision.', hi: 'नहीं। AI केवल श्रेणी, सारांश और प्राथमिकता सुझाता है। हर फ़ैसला अधिकृत स्टाफ़ करता है।' }],
    [{ en: 'Is this an official government portal?', hi: 'क्या यह सरकारी पोर्टल है?' }, { en: 'No. NagriVanta is an independent pilot. It offers a standard Open311 API so municipal systems can connect to it.', hi: 'नहीं। NagriVanta एक स्वतंत्र पायलट है। इसमें Open311 API है ताकि नगर निगम के सिस्टम जुड़ सकें।' }],
  ]],
];

export default function Faq() {
  const { lang } = usePrefs();
  const [q, setQ] = useState('');
  const ref = useReveal();
  const needle = q.trim().toLowerCase();
  const sections = FAQ.map(([title, items]) => [title, items.filter(([qq, a]) => !needle || `${qq[lang]} ${a[lang]} ${qq.en} ${a.en}`.toLowerCase().includes(needle))]).filter(([, items]) => items.length);

  return (
    <div ref={ref} className="mx-auto max-w-3xl">
      <header data-reveal>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{lang === 'hi' ? 'अक्सर पूछे जाने वाले सवाल' : 'Frequently asked questions'}</h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'जवाब न मिले तो नीचे दाईं ओर AI सहायक से पूछें।' : 'Can\'t find an answer? Ask the AI assistant at the bottom right.'}</p>
      </header>
      <label data-reveal className="mt-6 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-slate-700 dark:bg-ink-800">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <span className="sr-only">Search questions</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'hi' ? 'सवाल खोजें…' : 'Search questions…'} className="h-11 w-full bg-transparent text-sm outline-none" />
      </label>
      {sections.length === 0 && <p className="mt-8 text-slate-500">No matching questions.</p>}
      {sections.map(([title, items]) => (
        <section key={title} data-reveal className="mt-10">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-ink-700 dark:border-slate-800 dark:bg-ink-900">
            {items.map(([qq, a]) => (
              <details key={qq.en} className="group px-5 [&[open]>summary_svg]:rotate-180">
                <summary className="flex items-center justify-between gap-4 py-4 font-medium transition hover:text-brand-700 dark:hover:text-brand-500">
                  {qq[lang]}
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300" aria-hidden />
                </summary>
                <p className="-mt-1 max-w-[65ch] animate-fade pb-5 text-slate-600 dark:text-slate-300">{a[lang]}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p data-reveal className="mt-10 text-sm text-slate-500">{lang === 'hi' ? 'और जानना है? ' : 'Want the full walkthrough? '}<Link to="/how-it-works" className="font-semibold text-brand-700 hover:underline dark:text-brand-500">{lang === 'hi' ? 'कैसे काम करता है' : 'How it works'}</Link></p>
    </div>
  );
}
