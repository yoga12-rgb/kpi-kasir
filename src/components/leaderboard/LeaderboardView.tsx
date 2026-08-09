'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Feedback';
import { cn, formatScore } from '@/lib/utils';

interface Row {
  cashier_id: string;
  name: string;
  avatar_url: string | null;
  outlet_id: string;
  outlet_name: string;
  branch_id: string;
  branch_name: string;
  total_score: number;
  rank: number;
}

interface BranchOption {
  id: string;
  name: string;
}

interface OutletOption {
  id: string;
  name: string;
  branch_id: string;
}

export function LeaderboardView({
  branches,
  outlets,
}: {
  branches: BranchOption[];
  outlets: OutletOption[];
}) {
  const [level, setLevel] = useState<'global' | 'branch' | 'outlet'>('global');
  const [mode, setMode] = useState<'period' | 'cumulative'>('period');
  const [branchId, setBranchId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('level', level);
    params.set('mode', mode);
    if (branchId) params.set('branchId', branchId);
    if (outletId) params.set('outletId', outletId);

    try {
      const res = await fetch(`/api/leaderboard?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat leaderboard');
        setRows([]);
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setError('Gagal memuat leaderboard');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [level, mode, branchId, outletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-4">
      {/* Filter level */}
      <div className="grid grid-cols-3 gap-2">
        {(['global', 'branch', 'outlet'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setLevel(l);
              setBranchId('');
              setOutletId('');
            }}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              level === l
                ? 'border-primary-500 bg-primary-500 text-surface-900'
                : 'border-surface-300 bg-white text-surface-600'
            )}
          >
            {l === 'global' ? 'Lintas Cabang' : l === 'branch' ? 'Per Cabang' : 'Per Outlet'}
          </button>
        ))}
      </div>

      {level === 'branch' && (
        <Select
          label="Pilih Cabang"
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setOutletId('');
          }}
          options={[
            { value: '', label: 'Semua cabang' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      )}

      {level === 'outlet' && (
        <Select
          label="Pilih Cabang"
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setOutletId('');
          }}
          options={[
            { value: '', label: 'Semua cabang' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      )}

      {level === 'outlet' && branchId && (
        <Select
          label="Pilih Outlet"
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
          options={[
            { value: '', label: 'Semua outlet' },
            ...outlets
              .filter((o) => o.branch_id === branchId)
              .map((o) => ({ value: o.id, label: o.name })),
          ]}
        />
      )}

      {/* Toggle mode */}
      <div className="grid grid-cols-2 gap-2">
        {(['period', 'cumulative'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              mode === m
                ? 'border-primary-500 bg-primary-500 text-surface-900'
                : 'border-surface-300 bg-white text-surface-600'
            )}
          >
            {m === 'period' ? 'Skor Periode' : 'Skor Akumulatif'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {error && <p className="text-center text-sm text-danger-600">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-surface-500">Belum ada data leaderboard.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.slice(0, 100).map((row) => (
            <Link key={row.cashier_id} href={`/cashiers/${row.cashier_id}`} className="block">
              <Card className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-100">
                <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
                  <div
                    className={cn(
                      'rank-frame',
                      row.rank === 1 && 'rank-frame-gold',
                      row.rank === 2 && 'rank-frame-silver',
                      row.rank === 3 && 'rank-frame-bronze'
                    )}
                  >
                    <CashierAvatar name={row.name} src={row.avatar_url} size={56} />
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-1 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface-50 px-1.5 text-xs font-bold shadow-sm',
                      row.rank === 1 && 'bg-amber-300 text-amber-950',
                      row.rank === 2 && 'bg-slate-300 text-slate-800',
                      row.rank === 3 && 'bg-orange-400 text-orange-950',
                      row.rank > 3 && 'bg-surface-100 text-surface-500'
                    )}
                  >
                    {row.rank}
                  </span>
                  {row.rank <= 3 && (
                    <span
                      className={cn(
                        'absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-50 shadow-lg',
                        row.rank === 1 && 'bg-amber-300 text-amber-950',
                        row.rank === 2 && 'bg-slate-300 text-slate-800',
                        row.rank === 3 && 'bg-orange-400 text-orange-950'
                      )}
                      aria-label={`Peringkat ${row.rank}`}
                    >
                      {row.rank === 1 ? (
                        <Trophy className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Medal className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-surface-900">{row.name}</p>
                  <p className="truncate text-xs text-surface-500">
                    {row.outlet_name} · {row.branch_name}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary-600">
                  {formatScore(row.total_score)}
                </span>
              </Card>
            </Link>
          ))}
          {rows.length > 100 && (
            <p className="py-2 text-center text-xs text-surface-400">Menampilkan 100 teratas</p>
          )}
        </div>
      )}
    </div>
  );
}
