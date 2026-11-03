import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Upload, X, Plus, Clock, Zap, Gauge, Mail } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import { emailApi, senderApi, uploadApi } from '@/services/api';
import type { Sender, ScheduleEmailRequest } from '@/types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function toLocalDatetimeValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export default function ComposeModal({
  isOpen,
  onClose,
  onScheduled,
}: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDatetimeValue(addMinutes(new Date(), 5))
  );
  const [delayBetween, setDelayBetween] = useState(2);
  const [maxPerHour, setMaxPerHour] = useState(50);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showNewSender, setShowNewSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const fetchSenders = useCallback(async () => {
    setLoadingSenders(true);
    try {
      const data = await senderApi.getSenders();
      setSenders(data);
      if (data.length > 0 && !senderEmail) {
        setSenderEmail(data[0].email);
      }
    } catch {
      toast.error('Failed to load senders');
    } finally {
      setLoadingSenders(false);
    }
  }, [senderEmail]);

  useEffect(() => {
    if (isOpen) {
      fetchSenders();
      setScheduledAt(toLocalDatetimeValue(addMinutes(new Date(), 5)));
    }
  }, [isOpen, fetchSenders]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      try {
        // Try server-side parsing first
        const result = await uploadApi.uploadCSV(file);
        if (result.emails.length > 0) {
          setRecipients((prev) => {
            const all = [...prev, ...result.emails];
            return [...new Set(all)];
          });
          toast.success(`Found ${result.emails.length} email addresses`);
        } else {
          toast.error('No valid email addresses found in file');
        }
      } catch {
        // Fallback: parse client-side
        const text = await file.text();
        const matches = text.match(EMAIL_REGEX) || [];
        const unique = [...new Set(matches)];
        if (unique.length > 0) {
          setRecipients((prev) => [...new Set([...prev, ...unique])]);
          toast.success(`Found ${unique.length} email addresses`);
        } else {
          toast.error('No valid email addresses found in file');
        }
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((e) => e !== email));
  };

  const handleAddSender = async () => {
    if (!newSenderEmail.trim()) return;
    setAddingSender(true);
    try {
      const sender = await senderApi.createSender(
        newSenderEmail.trim(),
        newSenderName.trim() || newSenderEmail.trim()
      );
      setSenders((prev) => [...prev, sender]);
      setSenderEmail(sender.email);
      setShowNewSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
      toast.success('Sender added');
    } catch {
      toast.error('Failed to add sender');
    } finally {
      setAddingSender(false);
    }
  };

  const handleSchedule = async () => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }
    if (!senderEmail) {
      toast.error('Please select a sender email');
      return;
    }
    if (recipients.length === 0) {
      toast.error('At least one recipient is required');
      return;
    }

    setScheduling(true);
    try {
      const data: ScheduleEmailRequest = {
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        sender_email: senderEmail,
        scheduled_at: new Date(scheduledAt).toISOString(),
        delay_between_ms: delayBetween * 1000,
        max_per_hour: maxPerHour,
      };

      await emailApi.scheduleEmails(data);
      toast.success(
        `Scheduled ${recipients.length} email${recipients.length > 1 ? 's' : ''} successfully!`
      );
      onScheduled();
      resetForm();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to schedule emails';
      toast.error(message);
    } finally {
      setScheduling(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setRecipients([]);
    setDelayBetween(2);
    setMaxPerHour(50);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email Campaign"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {/* Subject */}
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject…"
        />

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email content…"
            rows={6}
            className="w-full px-3 py-2 bg-dark-base border border-slate-600 hover:border-slate-500 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 resize-y"
          />
        </div>

        {/* Sender */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Sender Email
          </label>
          {loadingSenders ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner size={14} /> Loading senders…
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-dark-base border border-slate-600 hover:border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              >
                <option value="">Select sender…</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowNewSender(!showNewSender)}
              >
                <Plus size={16} />
              </Button>
            </div>
          )}

          {/* New sender inline form */}
          {showNewSender && (
            <div className="mt-2 p-3 rounded-lg bg-dark-base border border-slate-700 space-y-2">
              <Input
                placeholder="sender@example.com"
                value={newSenderEmail}
                onChange={(e) => setNewSenderEmail(e.target.value)}
              />
              <Input
                placeholder="Sender Name (optional)"
                value={newSenderName}
                onChange={(e) => setNewSenderName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={addingSender}
                  onClick={handleAddSender}
                >
                  Add Sender
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewSender(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* CSV Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Recipients
          </label>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? 'border-primary-500 bg-primary-500/5'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'
              }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner size={24} className="text-primary-400" />
                <p className="text-sm text-slate-400">Parsing file…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload
                  size={28}
                  className={isDragActive ? 'text-primary-400' : 'text-slate-500'}
                />
                <p className="text-sm text-slate-400">
                  {isDragActive
                    ? 'Drop your file here…'
                    : 'Drag & drop a CSV or TXT file, or click to browse'}
                </p>
                <p className="text-xs text-slate-600">
                  Supports .csv and .txt files
                </p>
              </div>
            )}
          </div>

          {/* Recipient chips */}
          {recipients.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <Mail size={14} className="text-primary-400" />
                <span className="text-sm text-slate-300">
                  {recipients.length} email address
                  {recipients.length !== 1 ? 'es' : ''} detected
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded-lg bg-dark-base border border-slate-700">
                {recipients.map((email) => (
                  <div
                    key={email}
                    className="inline-flex items-center gap-1 mr-1.5 mb-1 px-2 py-1 rounded-md bg-slate-700/50 text-xs text-slate-300"
                  >
                    {email}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecipient(email);
                      }}
                      className="ml-0.5 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Schedule settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-dark-base border border-slate-700">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-1.5">
              <Clock size={14} />
              Start Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-1.5">
              <Zap size={14} />
              Delay (seconds)
            </label>
            <input
              type="number"
              min={0}
              value={delayBetween}
              onChange={(e) => setDelayBetween(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-1.5">
              <Gauge size={14} />
              Max per hour
            </label>
            <input
              type="number"
              min={1}
              value={maxPerHour}
              onChange={(e) => setMaxPerHour(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          fullWidth
          size="lg"
          loading={scheduling}
          onClick={handleSchedule}
        >
          <Mail size={18} />
          Schedule {recipients.length > 0 ? `${recipients.length} ` : ''}Email
          {recipients.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </Modal>
  );
}
