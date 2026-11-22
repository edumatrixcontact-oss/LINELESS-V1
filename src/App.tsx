import { useCallback, useEffect, useState } from 'react';
import { AuthView } from './components/AuthView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './components/home/HomePage';
import { PublicDisplay } from './components/PublicDisplay';
import { QrWalkInView } from './components/QrWalkInView';
import { StaffDashboard } from './components/StaffDashboard';
import { StaffPortalLoginView } from './components/StaffPortalLoginView';
import { VisitorLoginView } from './components/VisitorLoginView';
import { VisitorView } from './components/VisitorView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QueueProvider } from './context/QueueContext';
import { DEMO_BRANCH_ID, DEMO_DESK_ID } from './data/bankCatalog';
import { ThemeMode, ViewMode } from './types/queue';

const THEME_STORAGE_KEY = 'lineless_theme_v1';

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Fallback to dark
  }
  return 'dark';
}

function getInitialView(): ViewMode {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [routePart] = rawHash.split('?');
  const route = routePart.toLowerCase();
  if (
    route === 'home' ||
    route === 'staff' ||
    route === 'staff-login' ||
    route === 'display' ||
    route === 'visitor' ||
    route === 'visitor-login' ||
    route === 'qr' ||
    route === 'auth'
  ) {
    return route;
  }
  return 'home';
}

function parseQrQueryParams(): { branchId: string; deskId: string } {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [, hashQuery = ''] = rawHash.split('?');
  const hashParams = new URLSearchParams(hashQuery);
  const searchParams = new URLSearchParams(window.location.search);
  const branchId =
    hashParams.get('branch') || searchParams.get('branch') || DEMO_BRANCH_ID;
  const deskId = hashParams.get('desk') || searchParams.get('desk') || DEMO_DESK_ID;
  return { branchId, deskId };
}

interface AppContentProps {
  view: ViewMode;
  setView: (view: ViewMode) => void;
}

function AppContent({ view, setView }: AppContentProps) {
  const {
    user,
    isStaff,
    isDemoStaff,
    isDemoVisitor,
    authReady,
    enterDemoStaffMode,
    enterDemoVisitorMode,
    exitDemoVisitorMode,
  } = useAuth();
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [displayReturnView, setDisplayReturnView] = useState<ViewMode>('home');
  const [qrParams, setQrParams] = useState(() => parseQrQueryParams());
  const [pendingDemoBranchId, setPendingDemoBranchId] = useState<string | null>(null);

  const hasStaffAccess = isStaff || isDemoStaff;
  const hasVisitorAccess = Boolean(user) || isDemoVisitor;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    const handleHashChange = () => {
      setView(getInitialView());
      setQrParams(parseQrQueryParams());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setView]);

  const navigateExact = useCallback(
    (target: ViewMode, customHash?: string) => {
      setView(target);
      const nextHash = customHash ?? target;
      if (window.location.hash !== `#${nextHash}`) {
        window.location.hash = nextHash;
      }
      window.scrollTo({ top: 0 });
    },
    [setView]
  );

  const handleChangeView = useCallback(
    (nextView: ViewMode) => {
      if (nextView === 'display') {
        setDisplayReturnView(view === 'staff' || view === 'visitor' ? view : 'home');
        navigateExact('display');
        return;
      }

      if (nextView === 'qr') {
        const nextQrHash = `qr?branch=${encodeURIComponent(DEMO_BRANCH_ID)}&desk=${encodeURIComponent(
          DEMO_DESK_ID
        )}`;
        setQrParams({ branchId: DEMO_BRANCH_ID, deskId: DEMO_DESK_ID });
        navigateExact('qr', nextQrHash);
        return;
      }

      if (nextView === 'staff' && !hasStaffAccess) {
        navigateExact('staff-login');
        return;
      }

      if (nextView === 'visitor' && !hasVisitorAccess) {
        navigateExact('visitor-login');
        return;
      }

      navigateExact(nextView);
    },
    [hasStaffAccess, hasVisitorAccess, navigateExact, view]
  );

  const handleWatchDemoLiveQueue = useCallback(() => {
    enterDemoStaffMode();
    setPendingDemoBranchId(DEMO_BRANCH_ID);
    navigateExact('staff');
  }, [enterDemoStaffMode, navigateExact]);

  const handleNavigateVisitorAuth = (initialMode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(initialMode);
    navigateExact('auth');
  };

  const handleEnterDemoStaff = () => {
    enterDemoStaffMode();
    navigateExact('staff');
  };

  const handleStaffAuthenticated = () => {
    navigateExact('staff');
  };

  const handleEnterDemoVisitor = () => {
    enterDemoVisitorMode();
    navigateExact('visitor');
  };

  const handleVisitorAuthenticated = () => {
    exitDemoVisitorMode();
    navigateExact('visitor');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (view === 'home') {
    return (
      <HomePage
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={handleChangeView}
        onWatchDemoQueue={handleWatchDemoLiveQueue}
      />
    );
  }

  if (view === 'qr') {
    return (
      <QrWalkInView
        branchId={qrParams.branchId}
        deskId={qrParams.deskId}
        onBackToHomepage={() => navigateExact('home')}
      />
    );
  }

  if (view === 'display') {
    return (
      <PublicDisplay
        theme={theme}
        onToggleTheme={toggleTheme}
        onExitDisplay={() => handleChangeView(displayReturnView)}
      />
    );
  }

  if (view === 'staff-login') {
    return (
      <StaffPortalLoginView
        onBackToHomepage={() => navigateExact('home')}
        onStaffAuthenticated={handleStaffAuthenticated}
        onEnterDemoStaff={handleEnterDemoStaff}
      />
    );
  }

  if (view === 'visitor-login') {
    return (
      <VisitorLoginView
        onBackToHomepage={() => navigateExact('home')}
        onVisitorAuthenticated={handleVisitorAuthenticated}
        onEnterDemoVisitor={handleEnterDemoVisitor}
      />
    );
  }

  if (view === 'staff') {
    if (!authReady && !isDemoStaff) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F2] px-4 text-sm font-medium text-[#4D5E52]">
          Verifying staff authorization...
        </div>
      );
    }

    if (!hasStaffAccess) {
      return (
        <StaffPortalLoginView
          directUnauthorizedNotice={Boolean(user && !isStaff)}
          onBackToHomepage={() => navigateExact('home')}
          onStaffAuthenticated={handleStaffAuthenticated}
          onEnterDemoStaff={handleEnterDemoStaff}
        />
      );
    }

    return (
      <StaffDashboard
        initialDemoBranchId={pendingDemoBranchId}
        onConsumeInitialDemoBranch={() => setPendingDemoBranchId(null)}
        onBackToHomepage={() => navigateExact('home')}
        onSignedOut={() => navigateExact('staff-login')}
      />
    );
  }

  if (view === 'visitor') {
    if (!authReady && !isDemoVisitor) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F2] px-4 text-sm font-medium text-[#4D5E52]">
          Loading visitor session...
        </div>
      );
    }

    if (!hasVisitorAccess) {
      return (
        <VisitorLoginView
          onBackToHomepage={() => navigateExact('home')}
          onVisitorAuthenticated={handleVisitorAuthenticated}
          onEnterDemoVisitor={handleEnterDemoVisitor}
        />
      );
    }

    return (
      <VisitorView
        onNavigateAuth={(mode) => handleNavigateVisitorAuth(mode)}
        onExitDemo={() => navigateExact('visitor-login')}
        onBackToHomepage={() => navigateExact('home')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F2] text-[#10281B]">
      <div className="flex-1">
        <AuthView
          initialMode={authInitialMode}
          onSuccess={handleVisitorAuthenticated}
          onBack={() => navigateExact('visitor-login')}
        />
      </div>
    </div>
  );
}

function AppWithQueue() {
  const [view, setView] = useState<ViewMode>(() => getInitialView());
  return (
    <QueueProvider currentView={view}>
      <AppContent view={view} setView={setView} />
    </QueueProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppWithQueue />
      </AuthProvider>
    </ErrorBoundary>
  );
}
