import { useState, useCallback } from 'react';
import { PenSquare } from 'lucide-react';
import Header from '@/components/layout/Header';
import QueueStats from '@/components/email/QueueStats';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import ComposeModal from '@/components/email/ComposeModal';
import ScheduledEmailsTable from '@/components/email/ScheduledEmailsTable';
import SentEmailsTable from '@/components/email/SentEmailsTable';

export default function DashboardPage() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleScheduled = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const tabs = [
    {
      id: 'scheduled',
      label: 'Scheduled Emails',
      content: (
        <ScheduledEmailsTable
          onCompose={() => setComposeOpen(true)}
          refreshTrigger={refreshTrigger}
        />
      ),
    },
    {
      id: 'sent',
      label: 'Sent Emails',
      content: <SentEmailsTable />,
    },
  ];

  return (
    <div className="min-h-screen bg-dark-base">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Queue Stats */}
        <div className="mb-6">
          <QueueStats />
        </div>

        {/* Main content area with compose button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Email Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Manage and monitor your email campaigns
            </p>
          </div>

          <Button onClick={() => setComposeOpen(true)}>
            <PenSquare size={16} />
            Compose New Email
          </Button>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} />
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={handleScheduled}
      />
    </div>
  );
}

