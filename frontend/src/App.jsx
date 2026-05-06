import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import HomestayDetailPage from './pages/HomestayDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingPage from './pages/BookingPage';
import UserDashboardPage from './pages/UserDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import HostDashboardPage from './pages/HostDashboardPage';
import SearchPage from './pages/SearchPage';
import WishlistPage from './pages/WishlistPage';
import ChatPage from './pages/ChatPage';
import AccountPage from './pages/AccountPage';
import HostProfilePage from './pages/HostProfilePage';
import ChatWidget from './components/ChatWidget';
import { useAuth } from './context/AuthContext';
import { ChatWidgetProvider } from './context/ChatWidgetContext';

const PrivateRoute = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const { user } = useAuth();
  const hostRedirect = user?.role === 'host' ? <Navigate to="/host" replace /> : null;

  return (
    <ChatWidgetProvider>
      <MainLayout>
        <Routes>
          <Route path="/" element={hostRedirect || <HomePage />} />
          <Route path="/search" element={hostRedirect || <SearchPage />} />
          <Route path="/hosts/:id" element={hostRedirect || <HostProfilePage />} />
          <Route path="/homestays/:id" element={hostRedirect || <HomestayDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/book/:id" element={<PrivateRoute roles={['user', 'admin']}><BookingPage /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute roles={['user', 'admin']}><UserDashboardPage /></PrivateRoute>} />
          <Route path="/wishlist" element={<PrivateRoute roles={['user', 'admin']}><WishlistPage /></PrivateRoute>} />
          <Route path="/chats" element={<PrivateRoute roles={['user', 'admin']}><ChatPage /></PrivateRoute>} />
          <Route path="/account" element={<PrivateRoute roles={['user', 'host', 'admin']}><AccountPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute roles={['admin']}><AdminDashboardPage /></PrivateRoute>} />
          <Route path="/host" element={<PrivateRoute roles={['host']}><HostDashboardPage /></PrivateRoute>} />
        </Routes>
      </MainLayout>
      <ChatWidget />
    </ChatWidgetProvider>
  );
}

export default App;
