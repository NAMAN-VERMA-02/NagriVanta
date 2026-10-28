import { useState } from 'react';
import { Link } from 'react-router';
import { Bot, Building2, Camera, ClipboardCheck, Layers, MapPin, Mic, Search, ShieldCheck, Star, ThumbsUp, Timer, UserRound, Users, WifiOff } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { useReveal } from '../hooks/useMotion';

// Step-by-step instructions per role. Bilingual so first-time users can follow along in Hindi.
const ROLES = {
  citizen: {
    icon: UserRound,
    en: { name: 'Citizens', intro: 'Report a problem in your area and follow it until it is fixed.' },
    hi: { name: 'नागरिक', intro: 'अपने इलाक़े की समस्या दर्ज करें और ठीक होने तक उसे ट्रैक करें।' },
    steps: [
      [UserRound, { en: ['Create a free account', 'Tap "Get started", enter your name, email and a password. Signing in lets you track every report.'], hi: ['मुफ़्त खाता बनाएँ', '"शुरू करें" दबाएँ, नाम, ईमेल और पासवर्ड डालें। साइन इन करके आप हर शिकायत ट्रैक कर सकते हैं।'] }],
      [Camera, { en: ['Describe the problem', 'Open "Report issue". Type, or tap Speak to dictate in Hindi or English. Add up to 3 photos and a short video; photos are shrunk on your phone to save data.'], hi: ['समस्या बताइए', '"समस्या दर्ज करें" खोलें। लिखें या "बोलें" दबाकर हिंदी/अंग्रेज़ी में बोलें। 3 फ़ोटो और एक छोटा वीडियो जोड़ सकते हैं।'] }],
      [MapPin, { en: ['Mark the exact spot', 'Use "My location", search a landmark, click the map, or enter your 6-digit pincode to jump to your area. A photo with GPS can set the location automatically.'], hi: ['सही जगह चुनें', '"मेरी लोकेशन" दबाएँ, कोई जगह खोजें, नक्शे पर क्लिक करें, या 6 अंकों का पिनकोड डालें। GPS वाली फ़ोटो से लोकेशन अपने आप भी आ सकती है।'] }],
      [Layers, { en: ['Choose the map style you like', 'The layers button on every map switches between Default, Streets, Satellite, Terrain, Light and Dark. Satellite helps you find the exact building or road.'], hi: ['नक्शे का प्रकार चुनें', 'हर नक्शे पर लेयर बटन से Default, Streets, Satellite, Terrain, Light और Dark बदल सकते हैं।'] }],
      [ThumbsUp, { en: ['Check for duplicates', 'If the same issue is already reported nearby you will see it. You can still submit, or open "Nearby issues" and press "Me too". Votes raise priority.'], hi: ['दोहराव देखें', 'अगर वही समस्या पास में पहले से दर्ज है तो दिखेगी। आप फिर भी भेज सकते हैं या "मेरी भी" दबा सकते हैं।'] }],
      [ClipboardCheck, { en: ['Submit and save your reference ID', 'You get an ID like CIV-261028-1A2B3C4D straight away. The AI suggests a category and priority, and smart routing sends it to the right department.'], hi: ['भेजें और रेफ़रेंस आईडी सँभालें', 'तुरंत CIV-261028-1A2B3C4D जैसा आईडी मिलता है। AI श्रेणी और प्राथमिकता सुझाता है और सही विभाग को भेजता है।'] }],
      [Timer, { en: ['Follow progress', 'Notifications tell you when it is assigned, in progress and resolved. Every case has a target date; late cases are escalated automatically.'], hi: ['प्रगति देखें', 'सौंपे जाने, काम शुरू होने और हल होने पर सूचना मिलती है। हर केस की लक्ष्य तिथि होती है।'] }],
      [Star, { en: ['Rate the fix or reopen', 'When it is resolved you see the after-photo and the evidence checks. Rate it 1–5, or reopen it within 30 days if the problem is back.'], hi: ['रेटिंग दें या फिर से खोलें', 'हल होने पर मरम्मत की फ़ोटो दिखती है। 1–5 रेटिंग दें, या 30 दिन में समस्या लौटे तो फिर से खोलें।'] }],
    ],
  },
  officer: {
    icon: Building2,
    en: { name: 'Department officers', intro: 'Work through the cases assigned to you or your department.' },
    hi: { name: 'विभाग अधिकारी', intro: 'आपको या आपके विभाग को सौंपे गए केस निपटाएँ।' },
    steps: [
      [Users, { en: ['Open "My queue"', 'Filter by status, category, priority or "Overdue only". AUTO marks cases that smart routing assigned to you.'], hi: ['"मेरी कतार" खोलें', 'स्थिति, श्रेणी, प्राथमिकता या "सिर्फ़ देर वाले" से छाँटें।'] }],
      [Timer, { en: ['Start work', 'Open a case and move it to "In progress". Add notes; untick "Internal only" to keep the citizen informed.'], hi: ['काम शुरू करें', 'केस खोलकर "काम जारी" करें। नोट जोड़ें ताकि नागरिक को जानकारी मिले।'] }],
      [Camera, { en: ['Resolve with proof', 'Choose "Resolved", write what was done and attach a fresh after-photo. The system checks it differs from the report photo, was not reused, and (with GPS) was taken on site.'], hi: ['सबूत के साथ हल करें', '"हल हो गई" चुनें, क्या किया लिखें और मरम्मत के बाद की नई फ़ोटो लगाएँ।'] }],
    ],
  },
  admin: {
    icon: ShieldCheck,
    en: { name: 'Administrators', intro: 'Check AI triage, assign work and watch city-wide performance.' },
    hi: { name: 'प्रशासक', intro: 'AI सुझाव जाँचें, काम सौंपें और पूरे शहर का प्रदर्शन देखें।' },
    steps: [
      [Bot, { en: ['Confirm the triage', 'Each case shows the AI suggestion with its reasons and the priority score. Confirm or correct the category and priority; your change is logged.'], hi: ['AI सुझाव जाँचें', 'हर केस में AI का सुझाव और कारण दिखते हैं। श्रेणी और प्राथमिकता पक्की करें या बदलें।'] }],
      [Users, { en: ['Assign or re-assign', 'Pick the department and an officer. The due date comes from the department SLA unless you set one.'], hi: ['काम सौंपें', 'विभाग और अधिकारी चुनें। तारीख़ विभाग की SLA से अपने आप आती है।'] }],
      [Search, { en: ['Watch the analytics', 'Overdue cases, officer workload, recurring hotspots on the map, and rain-based risk alerts help you plan inspections before problems grow.'], hi: ['विश्लेषण देखें', 'देर वाले केस, अधिकारियों का काम, बार-बार आने वाली समस्याएँ और बारिश के जोखिम अलर्ट देखें।'] }],
    ],
  },
};

const EXTRAS = [
  [Bot, { en: ['AI assistant', 'The round button at the bottom right. Describe a problem and it drafts a report; paste a reference ID to hear its status.'], hi: ['AI सहायक', 'नीचे दाईं ओर गोल बटन। समस्या बताइए, वह रिपोर्ट तैयार करेगा; आईडी डालें तो स्थिति बताएगा।'] }],
  [Mic, { en: ['Voice input', 'Speak instead of typing (Chrome, Edge, Safari). Switch the interface to Hindi with the हिं button.'], hi: ['आवाज़ से लिखें', 'टाइप करने के बजाय बोलें। हिं बटन से इंटरफ़ेस हिंदी में करें।'] }],
  [WifiOff, { en: ['Offline & Lite mode', 'No signal? Your report is saved and sent automatically later. The feather button turns on Lite mode to save data.'], hi: ['ऑफ़लाइन और लाइट मोड', 'नेटवर्क नहीं? शिकायत सेव होकर बाद में अपने आप जाएगी। पंख वाला बटन डेटा बचाता है।'] }],
  [Search, { en: ['Track without signing in', 'Anyone can check a case status on the Track page with its reference ID.'], hi: ['बिना लॉगिन ट्रैक करें', 'कोई भी ट्रैक पेज पर आईडी डालकर स्थिति देख सकता है।'] }],
];

export default function Guide() {
  const { lang } = usePrefs();
  const [role, setRole] = useState('citizen');
  const ref = useReveal();
  const R = ROLES[role];
  return (
    <div ref={ref} className="mx-auto max-w-4xl">
      <header data-reveal className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{lang === 'hi' ? 'NagriVanta कैसे इस्तेमाल करें' : 'How to use NagriVanta'}</h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'शिकायत दर्ज करने से लेकर मरम्मत के सबूत तक, हर कदम आसान भाषा में।' : 'From filing a report to seeing proof of the fix, every step in plain language.'}</p>
      </header>

      <div role="tablist" aria-label="Choose your role" data-reveal className="mt-8 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-ink-900">
        {Object.entries(ROLES).map(([k, r]) => {
          const Icon = r.icon;
          return (
            <button key={k} type="button" role="tab" aria-selected={role === k} onClick={() => setRole(k)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${role === k ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800'}`}>
              <Icon className="h-4 w-4" aria-hidden /> {r[lang].name}
            </button>
          );
        })}
      </div>

      <section key={role} className="mt-6 animate-page" role="tabpanel" aria-label={R[lang].name}>
        <p className="text-slate-600 dark:text-slate-300">{R[lang].intro}</p>
        <ol className="mt-6 space-y-0">
          {R.steps.map(([Icon, txt], i) => {
            const [title, body] = txt[lang];
            return (
              <li key={title} className="relative flex gap-4 pb-8 last:pb-0">
                {i < R.steps.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-slate-200 dark:bg-ink-700" aria-hidden />}
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-[0_6px_14px_-6px_rgb(15_118_110/0.8)]"><Icon className="h-5 w-5" aria-hidden /></span>
                <div className="pt-1.5">
                  <h2 className="font-semibold"><span className="mr-2 tabular-nums text-slate-400">{i + 1}.</span>{title}</h2>
                  <p className="mt-1 max-w-[65ch] text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section data-reveal className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-ink-900">
        <h2 className="text-xl font-bold">{lang === 'hi' ? 'काम की और बातें' : 'Good to know'}</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {EXTRAS.map(([Icon, txt]) => (
            <div key={txt.en[0]} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-500" aria-hidden />
              <div><dt className="font-semibold">{txt[lang][0]}</dt><dd className="mt-1 text-sm text-slate-600 dark:text-slate-300">{txt[lang][1]}</dd></div>
            </div>
          ))}
        </dl>
      </section>

      <div data-reveal className="mt-10 flex flex-wrap gap-3">
        <Link to="/register" className="btn-primary px-6 py-3">{lang === 'hi' ? 'खाता बनाएँ' : 'Create a free account'}</Link>
        <Link to="/faq" className="btn-secondary px-6 py-3">{lang === 'hi' ? 'सवाल-जवाब पढ़ें' : 'Read the FAQ'}</Link>
      </div>
    </div>
  );
}
