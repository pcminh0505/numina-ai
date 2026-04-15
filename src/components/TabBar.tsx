export type TabId = "quiz" | "wallet" | "apps";

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

function PokeballIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M16 2L8 6" />
      <circle cx="16" cy="13" r="1.5" fill="currentColor" />
    </svg>
  );
}

function AppsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

const TABS: { id: TabId; label: string }[] = [
  { id: "quiz",   label: "Quiz"   },
  { id: "wallet", label: "Wallet" },
  { id: "apps",   label: "Apps"   },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            className={`tab-btn${isActive ? " active" : ""}`}
            onClick={() => onChange(id)}
          >
            <span className="tab-icon">
              {id === "quiz"   && <PokeballIcon active={isActive} />}
              {id === "wallet" && <WalletIcon   active={isActive} />}
              {id === "apps"   && <AppsIcon     active={isActive} />}
            </span>
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
