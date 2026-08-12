'use client';

import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';

type TabId = 'users' | 'permissions' | 'invite';
const TAB_IDS: TabId[] = ['users', 'permissions', 'invite'];

function isTabId(value: string | null): value is TabId {
  return value !== null && TAB_IDS.includes(value as TabId);
}

export function UserSettingsTabs({
  userList,
  rolePermissions,
  invite,
}: {
  userList: ReactNode;
  rolePermissions: ReactNode;
  invite: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    isTabId(requestedTab) ? requestedTab : 'users'
  );
  const tabs = [
    { id: 'users' as const, label: 'Pengguna', icon: Users },
    { id: 'permissions' as const, label: 'Hak Akses', icon: ShieldCheck },
    { id: 'invite' as const, label: 'Undang', icon: UserPlus },
  ];
  const content = {
    users: userList,
    permissions: rolePermissions,
    invite,
  }[activeTab];
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    users: null,
    permissions: null,
    invite: null,
  });

  useEffect(() => {
    setActiveTab(isTabId(requestedTab) ? requestedTab : 'users');
  }, [requestedTab]);

  function selectTab(tabId: TabId) {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === 'users') params.delete('tab');
    else params.set('tab', tabId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

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
    selectTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Pengaturan pengguna"
        className="flex overflow-x-auto rounded-xl border border-surface-200 bg-surface-100 p-1"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              id={`user-settings-tab-${id}`}
              role="tab"
              aria-selected={active}
              aria-controls="user-settings-tabpanel"
              tabIndex={active ? 0 : -1}
              ref={(element) => {
                tabRefs.current[id] = element;
              }}
              onClick={() => selectTab(id)}
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
        id="user-settings-tabpanel"
        role="tabpanel"
        aria-labelledby={`user-settings-tab-${activeTab}`}
        tabIndex={0}
        className="mt-4"
      >
        {content}
      </div>
    </div>
  );
}
