interface BadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  scheduled: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  queued: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  sending: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  sent: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  rate_limited: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function Badge({ status, className = '' }: BadgeProps) {
  const style = statusStyles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${style} ${className}`}
    >
      {label}
    </span>
  );
}
