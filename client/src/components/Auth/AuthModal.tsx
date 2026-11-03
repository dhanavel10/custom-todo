import { useState } from 'react';
import { X, Lock, Mail, User as UserIcon } from 'lucide-react';
import { api, setAuthToken } from '../../lib/api';
import type { User, UserPreferences } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, preferences: UserPreferences) => void;
}

export const AuthModal = ({ isOpen, onClose, onSuccess }: AuthModalProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        const res = await api.auth.register({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined
        });
        setAuthToken(res.token);
        const me = await api.auth.me();
        onSuccess(me.user, me.preferences);
        onClose();
      } else {
        const res = await api.auth.login({
          email: email.trim(),
          password
        });
        setAuthToken(res.token);
        const me = await api.auth.me();
        onSuccess(me.user, me.preferences);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title">
            {isRegister ? 'Create an Account' : 'Sign In to Inbox'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="badge badge-urgent" style={{ padding: '8px 12px', width: '100%', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="input-group">
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserIcon size={13} /> Name
              </label>
              <input
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <div className="input-group">
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> Email
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={13} /> Password
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 4px', textDecoration: 'underline' }}
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
