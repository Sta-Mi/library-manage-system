import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ReaderPage from './pages/ReaderPage';
import ReaderProfilePage from './pages/ReaderProfilePage';
import AdminPage from './pages/AdminPage';
import { getCurrentUser } from './lib/api';

function RequireRole({ role, children }) {
  const u = getCurrentUser();
  if (!u || u.role !== role) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/reader"
        element={
          <RequireRole role="reader">
            <ReaderPage />
          </RequireRole>
        }
      />
      <Route
        path="/reader/profile"
        element={
          <RequireRole role="reader">
            <ReaderProfilePage />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminPage />
          </RequireRole>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
