import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import Header from './components/Header';
import Footer from './components/Footer';
import { Spinner } from './components/ui';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';
import { Login, Register } from './pages/Auth';
import Report from './pages/Report';
import MyReports from './pages/MyReports';
import ComplaintDetail from './pages/ComplaintDetail';
import Queue from './pages/Queue';
import Analytics from './pages/Analytics';
import Scorecard from './pages/Scorecard';
import Notifications from './pages/Notifications';

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

// UI guard only; the API enforces every permission itself.
function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
