import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import Table, { type Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { emailApi } from '@/services/api';
import type { EmailJob } from '@/types';

interface ScheduledEmailsTableProps {
  onCompose: () => void;
  refreshTrigger: number;
}

export default function ScheduledEmailsTable({
  onCompose,
  refreshTrigger,
}: ScheduledEmailsTableProps) {
  const [data, setData] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await emailApi.getScheduledEmails(page, 20);
      setData(res.data);
      setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Initial load & auto-refresh
  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [fetchEmails, refreshTrigger]);

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchEmails();
      return;
    }
    setSearching(true);
    try {
      const results = await emailApi.searchEmails(searchQuery.trim());
      setData(
        results.filter((e) =>
          ['scheduled', 'queued', 'sending', 'rate_limited'].includes(e.status)
        )
      );
      setTotalPages(1);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, fetchEmails]);

  const columns: Column<EmailJob>[] = [
    {
      header: 'Recipient',
      render: (row) => (
        <span className="font-medium text-white">{row.recipient_email}</span>
      ),
    },
    {
      header: 'Subject',
      render: (row) => (
        <span className="max-w-[200px] truncate block">{row.subject}</span>
      ),
    },
    {
      header: 'Scheduled For',
      render: (row) => (
        <div>
          <p className="text-slate-300 text-sm">
            {format(new Date(row.scheduled_at), 'MMM d, yyyy h:mm a')}
          </p>
          <p className="text-slate-500 text-xs">
            {formatDistanceToNow(new Date(row.scheduled_at), {
              addSuffix: true,
            })}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
      className: 'w-32',
    },
  ];

  return (
    <div className="card">
      {/* Search bar */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="relative max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search scheduled emails…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 bg-dark-base border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        keyExtractor={(row) => row.id}
        emptyState={
          <EmptyState
            title="No scheduled emails yet"
            description="Click 'Compose' to schedule your first email campaign."
            actionLabel="Compose Email"
            onAction={onCompose}
          />
        }
      />
    </div>
  );
}
