import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react';
import { emailApi } from '@/services/api';
import type { QueueStats as QueueStatsType } from '@/types';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-card border border-slate-700/50`}>
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export default function QueueStats() {
  const [stats, setStats] = useState<QueueStatsType | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await emailApi.getEmailStats();
      setStats(data);
    } catch {
      // Silently fail - stats are not critical
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard
        label="Waiting"
        value={stats.waiting}
        icon={<Clock size={18} className="text-yellow-400" />}
        color="bg-yellow-500/10"
      />
      <StatCard
        label="Active"
        value={stats.active}
        icon={<Zap size={18} className="text-blue-400" />}
        color="bg-blue-500/10"
      />
      <StatCard
        label="Completed"
        value={stats.completed}
        icon={<CheckCircle2 size={18} className="text-green-400" />}
        color="bg-green-500/10"
      />
      <StatCard
        label="Failed"
        value={stats.failed}
        icon={<XCircle size={18} className="text-red-400" />}
        color="bg-red-500/10"
      />
      <StatCard
        label="Delayed"
        value={stats.delayed}
        icon={<Timer size={18} className="text-orange-400" />}
        color="bg-orange-500/10"
      />
    </div>
  );
}
