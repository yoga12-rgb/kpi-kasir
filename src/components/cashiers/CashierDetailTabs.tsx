'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, HandHelping, History } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getErrorMessage } from '@/lib/utils';

const TransferForm = dynamic(
  () => import('./TransferForm').then((module) => module.TransferForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3" aria-label="Memuat formulir mutasi">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-200" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-surface-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-200" />
      </div>
    ),
  }
);

type TabId = 'mutation' | 'placement' | 'mentoring';

interface OutletOption {
  id: string;
  name: string;
}

interface PlacementHistory {
  id: string;
  started_at: string;
  ended_at: string | null;
  outlet: { name: string } | { name: string }[] | null;
}

interface StatusHistory {
  id: string;
  is_active: boolean;
  effective_at: string;
  reason: string;
  changed_by: { full_name: string } | { full_name: string }[] | null;
}

interface MentoringNote {
  id: string;
  note: string;
  mentoring_session:
    | {
        visited_date: string;
        outlet: { name: string } | { name: string }[] | null;
        conducted_by: { full_name: string } | { full_name: string }[] | null;
      }
    | Array<{
        visited_date: string;
        outlet: { name: string } | { name: string }[] | null;
        conducted_by: { full_name: string } | { full_name: string }[] | null;
      }>
    | null;
}

type TabData =
  | { tab: 'mutation'; outlets: OutletOption[] }
  | { tab: 'placement'; histories: PlacementHistory[]; statusHistories: StatusHistory[] }
  | { tab: 'mentoring'; notes: MentoringNote[] };

type TabState = { data?: TabData; error?: string; loading: boolean };

interface CashierDetailTabsProps {
  cashierId: string;
  currentOutletId: string;
  canManageMutation: boolean;
  canMentor: boolean;
  canViewStatusHistory: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatTabDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date);
}

function relationItem<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function TabLoading() {
  return (
    <section className="card mt-4" aria-busy="true" aria-label="Memuat detail kasir">
      <div className="h-5 w-40 animate-pulse rounded bg-surface-200" />
      <div className="mt-4 space-y-3">
        <div className="h-12 animate-pulse rounded-lg bg-surface-100" />
        <div className="h-12 animate-pulse rounded-lg bg-surface-100" />
      </div>
    </section>
  );
}

function TabError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="card mt-4" role="alert">
      <p className="text-sm text-danger-600">Gagal memuat detail tab.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-sm font-semibold text-primary-600 hover:underline"
      >
        Coba lagi
      </button>
    </section>
  );
}

function PlacementPanel({
  data,
  canViewStatusHistory,
}: {
  data: Extract<TabData, { tab: 'placement' }>;
  canViewStatusHistory: boolean;
}) {
  return (
    <section className="card mt-4">
      <h2 className="mb-3 text-base font-semibold text-surface-900">Riwayat Penempatan</h2>
      <div className="space-y-2 text-sm">
        {data.histories.map((history) => {
          const outlet = relationItem(history.outlet);
          return (
            <div
              key={history.id}
              className="flex items-center justify-between gap-3 border-b border-surface-100 pb-2 last:border-0"
            >
              <span className="min-w-0 truncate font-medium text-surface-800">
                {outlet?.name ?? '-'}
              </span>
              <span className="shrink-0 text-xs text-surface-500">
                {formatTabDate(history.started_at)}{' '}
                {history.ended_at ? `- ${formatTabDate(history.ended_at)}` : '- sekarang'}
              </span>
            </div>
          );
        })}
        {data.histories.length === 0 && <p className="text-surface-500">Belum ada riwayat.</p>}
      </div>

      {canViewStatusHistory && (
        <div className="mt-5 border-t border-surface-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Riwayat Status</h3>
          <div className="space-y-2">
            {data.statusHistories.map((history) => {
              const changedBy = relationItem(history.changed_by);
              return (
                <div key={history.id} className="rounded-lg border border-surface-100 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-surface-800">
                      {history.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="text-surface-500">{formatTabDate(history.effective_at)}</span>
                  </div>
                  <p className="mt-1 text-surface-600">{history.reason}</p>
                  {changedBy?.full_name && (
                    <p className="mt-1 text-surface-400">oleh {changedBy.full_name}</p>
                  )}
                </div>
              );
            })}
            {data.statusHistories.length === 0 && (
              <p className="text-sm text-surface-500">Belum ada riwayat status.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MentoringPanel({ data }: { data: Extract<TabData, { tab: 'mentoring' }> }) {
  return (
    <div>
      <section className="card mt-4">
        <h2 className="mb-3 text-base font-semibold text-surface-900">Pendampingan</h2>
        <div className="space-y-3">
          {data.notes.map((note) => {
            const session = relationItem(note.mentoring_session);
            const outlet = relationItem(session?.outlet);
            const conductedBy = relationItem(session?.conducted_by);
            return (
              <div key={note.id} className="border-b border-surface-100 pb-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-surface-800">
                    {outlet?.name ?? 'Outlet'}
                  </span>
                  <span className="shrink-0 text-xs text-surface-500">
                    {formatTabDate(session?.visited_date)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-surface-600">{note.note}</p>
                {conductedBy?.full_name && (
                  <p className="mt-1 text-xs text-surface-400">oleh {conductedBy.full_name}</p>
                )}
              </div>
            );
          })}
          {data.notes.length === 0 && (
            <p className="text-sm text-surface-500">Belum ada pendampingan.</p>
          )}
        </div>
      </section>
      <Link href="/mentoring" className="btn btn-primary mt-3 w-full">
        Catat Pendampingan
      </Link>
    </div>
  );
}

export function CashierDetailTabs({
  cashierId,
  currentOutletId,
  canManageMutation,
  canMentor,
  canViewStatusHistory,
}: CashierDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('placement');
  const [tabStates, setTabStates] = useState<Record<TabId, TabState>>({
    mutation: { loading: false },
    placement: { loading: false },
    mentoring: { loading: false },
  });
  const loadedTabs = useRef(new Set<TabId>());
  const requestController = useRef<AbortController | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    mutation: null,
    placement: null,
    mentoring: null,
  });
  const tabs = [
    ...(canManageMutation
      ? [{ id: 'mutation' as const, label: 'Mutasi Outlet', icon: ArrowLeftRight }]
      : []),
    { id: 'placement' as const, label: 'Penempatan', icon: History },
    ...(canMentor ? [{ id: 'mentoring' as const, label: 'Pendampingan', icon: HandHelping }] : []),
  ];

  const loadTab = useCallback(
    async (tab: TabId, force = false) => {
      if (!force && loadedTabs.current.has(tab)) return;
      if (force) loadedTabs.current.delete(tab);

      requestController.current?.abort();
      const controller = new AbortController();
      requestController.current = controller;
      setTabStates((current) => ({
        ...current,
        [tab]: { ...current[tab], loading: true, error: undefined },
      }));

      try {
        const response = await fetch(`/api/cashiers/${cashierId}/tabs?tab=${tab}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload?.error, 'Gagal memuat detail kasir'));
        }
        if (!payload || typeof payload !== 'object' || payload.tab !== tab) {
          throw new Error('Respons detail kasir tidak valid');
        }

        loadedTabs.current.add(tab);
        setTabStates((current) => ({
          ...current,
          [tab]: { data: payload as TabData, loading: false },
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setTabStates((current) => ({
          ...current,
          [tab]: {
            ...current[tab],
            loading: false,
            error: getErrorMessage(error, 'Gagal memuat detail kasir'),
          },
        }));
      }
    },
    [cashierId]
  );

  useEffect(() => {
    void loadTab(activeTab);
    return () => requestController.current?.abort();
  }, [activeTab, loadTab]);

  useEffect(() => {
    if ((activeTab === 'mutation' && !canManageMutation) || (activeTab === 'mentoring' && !canMentor)) {
      setActiveTab('placement');
    }
  }, [activeTab, canManageMutation, canMentor]);

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

  const activeState = tabStates[activeTab];
  let activeContent: ReactNode;
  if (activeState.loading && !activeState.data) {
    activeContent = <TabLoading />;
  } else if (activeState.error) {
    activeContent = <TabError onRetry={() => void loadTab(activeTab, true)} />;
  } else if (activeTab === 'mutation' && activeState.data?.tab === 'mutation') {
    activeContent = (
      <section className="card mt-4">
        <h2 className="mb-3 text-base font-semibold text-surface-900">Mutasi Outlet</h2>
        <TransferForm
          cashierId={cashierId}
          currentOutletId={currentOutletId}
          outlets={activeState.data.outlets}
        />
      </section>
    );
  } else if (activeTab === 'mentoring' && activeState.data?.tab === 'mentoring') {
    activeContent = <MentoringPanel data={activeState.data} />;
  } else if (activeState.data?.tab === 'placement') {
    activeContent = (
      <PlacementPanel data={activeState.data} canViewStatusHistory={canViewStatusHistory} />
    );
  } else {
    activeContent = <TabLoading />;
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
