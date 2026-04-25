import type { WorkspaceTabKey } from "../hooks/useWorkspaceProgress";

export type WorkspaceSectionItem = {
  key: WorkspaceTabKey;
  label: string;
  description?: string;
  badge?: string | number | null;
};

type BaseProps = {
  items: WorkspaceSectionItem[];
  activeKey: WorkspaceTabKey;
  onSelect: (key: WorkspaceTabKey) => void;
};

type DesktopProps = BaseProps & {
  title: string;
  subtitle: string;
};

export function WorkspaceDesktopSectionNav({
  items,
  activeKey,
  onSelect,
  title,
  subtitle,
}: DesktopProps) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 sticky top-4 self-start max-h-[calc(100vh-1rem)] bg-white border-r border-gray-200 flex-col">
      <div className="p-5 border-b border-gray-200">
        <h2 className="mono-title text-lg">{title}</h2>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item, index) => {
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? "border-gray-300 bg-gray-100 text-gray-900"
                  : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isActive ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>

              {item.badge !== null && item.badge !== undefined && item.badge !== "" && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-gray-200 bg-white px-1.5 text-[11px] font-semibold text-gray-700">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function WorkspaceMobileSectionNav({ items, activeKey, onSelect }: BaseProps) {
  const activeItem = items.find((item) => item.key === activeKey) || null;

  return (
    <div className="md:hidden mono-card p-3 mb-4 sticky top-2 z-20">
      {activeItem?.description ? (
        <p className="mb-2 text-xs text-gray-600">{activeItem.description}</p>
      ) : null}

      <div className="flex gap-2 overflow-x-auto">
        {items.map((item, index) => {
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`mono-button whitespace-nowrap ${isActive ? "" : "mono-button--ghost"}`}
            >
              <span>
                {index + 1}. {item.label}
              </span>
              {item.badge !== null && item.badge !== undefined && item.badge !== "" && (
                <span
                  className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                    isActive
                      ? "bg-white/80 text-gray-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
