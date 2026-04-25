import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import PageContainer from './PageContainer';
import Footer from '../../Parts/Footer';
import type { User } from '../../types/type';

interface AppShellProps {
  currentUser: User;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}

const AppShell = ({ currentUser, onLogout, children }: AppShellProps) => {
  const location = useLocation();
  const hideFooter = useMemo(() => {
    return ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  }, [location.pathname]);

  return (
    <div
      className="mono-shell min-h-screen flex flex-col"
      style={{ background: 'var(--mono-bg)' }}
    >
      {/* Sticky top bar spanning full width */}
      <TopBar currentUser={currentUser} onLogout={onLogout} />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar currentUser={currentUser} onLogout={onLogout} />
        <AnimatePresence mode="wait">
          <PageContainer key={location.pathname}>
            {children}
          </PageContainer>
        </AnimatePresence>
      </div>

      {!hideFooter && <Footer />}
    </div>
  );
};

export default AppShell;
