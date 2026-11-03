import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import Table, { type Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { emailApi } from '@/services/api';
import type { EmailJob } from '@/types';

export default function SentEmailsTable() {
  const [data, setData] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await emailApi.getSentEmails(page, 20);
      setData(res.data);
      setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      fetchEmails();
      return;
    }
    setSearching(true);
    try {
      const results = await emailApi.searchEmails(searchQuery.trim());
      setData(results.filter((e) => ['sent', 'failed'].includes(e.status)));
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
      header: 'Sent At',
      render: (row) =>
        row.sent_at ? (
          <div>
            <p className="text-slate-300 text-sm">
              {format(new Date(row.sent_at), 'MMM d, yyyy h:mm a')}
            </p>
            <p className="text-slate-500 text-xs">
              {formatDistanceToNow(new Date(row.sent_at), { addSuffix: true })}
            </p>
          </div>
        ) : (
          <span className="text-slate-500 text-sm">—</span>
        ),
    },
    {
      header: 'Status',
      render: (row) => (
        <div>
          <Badge status={row.status} />
          {row.error_message && (
            <p className="text-xs text-red-400 mt-1 max-w-[180px] truncate" title={row.error_message}>
              {row.error_message}
            </p>
          )}
        </div>
      ),
      className: 'w-40',
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
            placeholder="Search sent emails…"
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
            title="No emails sent yet"
            description="Schedule some emails to get started."
          />
        }
      />
    </div>
  );
}
