import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DEMO_BRANCH_ID,
  getBankBranchById,
} from '../data/bankCatalog';
import { ThemeMode } from '../types/queue';
import { StaffBranchSelector } from './staff/StaffBranchSelector';
import { StaffWorkspace } from './staff/StaffWorkspace';

interface StaffDashboardProps {
  initialDemoBranchId?: string | null;
  onConsumeInitialDemoBranch?: () => void;
  onBackToHomepage: () => void;
  onSignedOut: () => void;
}

export function StaffDashboard({
  initialDemoBranchId,
  onConsumeInitialDemoBranch,
  onBackToHomepage,
  onSignedOut,
}: StaffDashboardProps) {
  const { user, profile, isDemoStaff, exitDemoStaffMode, logout } = useAuth();

  // Staff workspace defaults to light mode per design spec
  const [staffTheme, setStaffTheme] = useState<ThemeMode>('light');
  const [unlockedBranchId, setUnlockedBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (
      initialDemoBranchId &&
      initialDemoBranchId === DEMO_BRANCH_ID &&
      isDemoStaff
    ) {
      setUnlockedBranchId(DEMO_BRANCH_ID);
      onConsumeInitialDemoBranch?.();
    }
  }, [initialDemoBranchId, isDemoStaff, onConsumeInitialDemoBranch]);

  const unlockedBranch = getBankBranchById(unlockedBranchId);

  const staffName = isDemoStaff
    ? 'Demo Staff'
    : profile?.name || user?.displayName || 'Branch Staff';
  const staffEmail = isDemoStaff
    ? 'demo@lineless.local'
    : profile?.email || user?.email || '';

  const handleSignOut = async () => {
    setUnlockedBranchId(null);
    if (isDemoStaff) {
      exitDemoStaffMode();
    } else if (user) {
      await logout();
    }
    onSignedOut();
  };

  if (!unlockedBranch) {
    return (
      <StaffBranchSelector
        staffTheme={staffTheme}
        staffName={staffName}
        staffEmail={staffEmail}
        isDemoStaff={isDemoStaff}
        firebaseUser={user}
        onUnlockBranch={(branchId) => setUnlockedBranchId(branchId)}
        onBackToHomepage={onBackToHomepage}
        onSignOut={() => void handleSignOut()}
      />
    );
  }

  return (
    <StaffWorkspace
      branch={unlockedBranch}
      staffTheme={staffTheme}
      onToggleTheme={() =>
        setStaffTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
      }
      staffName={staffName}
      staffEmail={staffEmail}
      isDemoStaff={isDemoStaff}
      firebaseUser={user}
      onSwitchBranch={() => setUnlockedBranchId(null)}
      onBackToHomepage={onBackToHomepage}
      onSignOut={() => void handleSignOut()}
    />
  );
}
