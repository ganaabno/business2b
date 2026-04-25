// src/Parts/Header.tsx
import type { User as UserType } from "../types/type";
import ThemeToggle from "../components/ThemeToggle";
import { LogOut } from "lucide-react";

interface HeaderProps {
  currentUser: UserType;
  pendingUsername?: string;
  onLogout: () => Promise<void>;
  isUserRole: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  superadmin: 'Super Admin',
  manager: 'Manager',
  provider: 'Provider',
  agent: 'Agent',
  subcontractor: 'Subcontractor',
  user: 'User',
};

export default function Header({
  currentUser,
  pendingUsername,
  onLogout,
  isUserRole,
}: HeaderProps) {
  const displayName = pendingUsername
    ? pendingUsername
    : currentUser.username ||
      `${currentUser.first_name ?? ""} ${currentUser.last_name ?? ""}`.trim() ||
      currentUser.email?.split("@")[0] ||
      "User";

  const role = currentUser.role ?? "user";
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <header
      className="sticky top-0 z-1000 backdrop-blur-sm"
      style={{
        background: 'var(--mono-surface)',
        borderBottom: '1px solid var(--mono-border)',
      }}
    >
      <div className="mono-container px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex justify-between items-center gap-4">
          {/* Left: User info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{
                background: 'var(--mono-accent-soft)',
                color: 'var(--mono-accent)',
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className="text-sm font-semibold leading-tight truncate"
                  style={{ color: 'var(--mono-text)' }}
                >
                  {pendingUsername ? "Reviewing:" : "Welcome,"}{" "}
                  {displayName}
                </p>
                {/* Role badge */}
                <span className="mono-badge text-xs shrink-0">
                  {roleLabel}
                </span>
                {/* Pending approval badge */}
                {pendingUsername && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
                    style={{
                      background: 'var(--mono-warning-bg)',
                      color: 'var(--mono-warning-text)',
                      border: '1px solid var(--mono-border)',
                    }}
                  >
                    Pending Approval
                  </span>
                )}
              </div>
              <p
                className="text-xs mt-0.5 hidden sm:block"
                style={{ color: 'var(--mono-text-soft)' }}
              >
                {isUserRole ? "Booking workspace" : "Management workspace"}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center shrink-0 gap-1.5">
            <ThemeToggle className="px-2.5 py-2 text-xs sm:text-sm" showLabel={false} />

            <button
              onClick={async () => {
                try {
                  await onLogout();
                } catch {
                  // Silent fail — logout almost always succeeds
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              aria-label="Log out"
              style={{ color: 'var(--mono-text-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
                (e.currentTarget as HTMLElement).style.color = 'var(--mono-text)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--mono-text-muted)';
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
