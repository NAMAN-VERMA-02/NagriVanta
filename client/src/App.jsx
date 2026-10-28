import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { WifiOff } from 'lucide-react';
import Assistant from './components/Assistant';
import Header from './components/Header';
import Footer from './components/Footer';
import { Spinner } from './components/ui';
import { useAuth } from './context/AuthContext';
import { usePrefs } from './context/PrefsContext';
import { flushQueue, queuedCount } from './utils/offlineQueue';
import Home from './pages/Home';
import { Login, Register } from './pages/Auth';
import Report from './pages/Report';
import MyReports from './pages/MyReports';
import Community from './pages/Community';
import ComplaintDetail from './pages/ComplaintDetail';
import Queue from './pages/Queue';
import Analytics from './pages/Analytics';
import Scorecard from './pages/Scorecard';
import Notifications from './pages/Notifications';

// Sends reports saved while offline as soon as the user is signed in and online.
function OutboxBanner() {
  const { t, online } = usePrefs();
  const { user } = useAuth();
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const refresh = () => queuedCount().then(setQueued);
    refresh();
    window.addEventListener('outbox:changed', refresh);
    return () => window.removeEventListener('outbox:changed', refresh);
  }, []);
  useEffect(() => { if (online && user?.role === 'citizen') flushQueue(); }, [online, user]);
  if (online && !queued) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
      <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        {!online ? t('offline.banner') : t('offline.queued', queued)}
      </p>
    </div>
  );
}

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <OutboxBanner />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <Assistant />
    </div>
  );
}

// UI guard only; the API enforces every permission itself.
function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname, draft: location.state?.draft }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="scorecard" element={<Scorecard />} />
        <Route element={<RequireRole roles={['citizen']} />}>
          <Route path="report" element={<Report />} />
          <Route path="my-reports" element={<MyReports />} />
          <Route path="community" element={<Community />} />
        </Route>
        <Route element={<RequireRole roles={['officer', 'admin']} />}>
          <Route path="queue" element={<Queue />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route element={<RequireRole />}>
          <Route path="complaints/:id" element={<ComplaintDetail />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<div className="py-20 text-center"><h1 className="text-2xl font-bold">Page not found</h1></div>} />
      </Route>
    </Routes>
  );
}
