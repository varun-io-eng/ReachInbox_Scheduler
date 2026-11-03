import { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown, Hash, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user, logout, refreshUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSlackConnect = () => {
    const popup = window.open(
      '/api/slack/connect',
      'slack-connect',
      'width=600,height=700,scrollbars=yes'
    );

    // Poll for popup close, then refresh user
    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval);
        refreshUser();
      }
    }, 1000);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-700 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
              <Mail size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
              ReachInbox
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Slack button */}
            {user?.slackConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <Hash size={14} />
                Slack Connected ✓
              </div>
            ) : (
              <button
                onClick={handleSlackConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Hash size={14} />
                Connect Slack
              </button>
            )}

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full ring-2 ring-slate-600"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-slate-600">
                    {user?.name?.charAt(0) || '?'}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-white leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-xs text-slate-400 leading-tight">
                    {user?.email}
                  </p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-card border border-slate-700 rounded-xl shadow-2xl animate-slide-up overflow-hidden">
                  <div className="p-3 border-b border-slate-700/50 sm:hidden">
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
