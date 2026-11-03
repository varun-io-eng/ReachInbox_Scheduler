import { Navigate } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
);

export default function LoginPage() {
  const { isAuthenticated, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-base">
        <Spinner size={32} className="text-primary-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-base relative overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-dark-card border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Mail size={24} className="text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent mb-1">
            ReachInbox
          </h1>
          <p className="text-slate-400 text-center text-sm mb-8">
            Email Scheduler Dashboard
          </p>

          {/* Divider */}
          <div className="border-t border-slate-700/50 mb-8" />

          <h2 className="text-lg font-semibold text-white text-center mb-2">
            Welcome Back
          </h2>
          <p className="text-slate-400 text-center text-sm mb-6">
            Sign in to manage your email campaigns, schedule sends, and track
            deliveries in real time.
          </p>

          {/* Google Sign In Button */}
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all hover:shadow-lg hover:shadow-white/5 active:scale-[0.98]"
          >
            <GoogleIcon />
            Sign in with Google
            <ArrowRight size={16} className="ml-auto text-gray-400" />
          </button>

          {/* Info text */}
          <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
            By signing in, you agree to let ReachInbox access your name, email,
            and profile picture for authentication purposes only.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Powered by <span className="text-slate-500">Outbox Labs</span> •
          ReachInbox v1.0
        </p>
      </div>
    </div>
  );
}

