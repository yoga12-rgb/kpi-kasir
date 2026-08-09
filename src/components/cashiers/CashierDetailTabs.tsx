'use client';

import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { ArrowLeftRight, HandHelping, History } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'mutation' | 'placement' | 'mentoring';

interface CashierDetailTabsProps {
  mutation?: ReactNode;
  placement: ReactNode;
  mentoring?: ReactNode;
}

export function CashierDetailTabs({ mutation, placement, mentoring }: CashierDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('placement');
  const tabs = [
    ...(mutation
      ? [{ id: 'mutation' as const, label: 'Mutasi Outlet', icon: ArrowLeftRight }]
      : []),
    { id: 'placement' as const, label: 'Penempatan', icon: History },
    ...(mentoring ? [{ id: 'mentoring' as const, label: 'Pendampingan', icon: HandHelping }] : []),
  ];

  const activeContent =
    activeTab === 'mutation' ? mutation : activeTab === 'mentoring' ? mentoring : placement;
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    mutation: null,
    placement: null,
    mentoring: null,
  });

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: TabId) {
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Detail kasir"
        className="flex overflow-x-auto rounded-xl border border-surface-200 bg-surface-100 p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              id={`cashier-tab-${id}`}
              role="tab"
              aria-selected={active}
              aria-controls="cashier-tabpanel"
              tabIndex={active ? 0 : -1}
              ref={(element) => {
                tabRefs.current[id] = element;
              }}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, id)}
              className={cn(
                'flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50',
                active
                  ? 'bg-surface-200 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:bg-surface-200/60 hover:text-surface-800'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div
        id="cashier-tabpanel"
        role="tabpanel"
        aria-labelledby={`cashier-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeContent}
      </div>
    </div>
  );
}
