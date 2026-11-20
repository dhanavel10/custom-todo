import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Mail, User as UserIcon, AtSign, AlertCircle, X, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { api, setAuthToken } from '../../lib/api';
import { QUADRANTS } from '../../lib/quadrants';
import type { User, UserPreferences } from '../../types';
import { Button, IconButton, Segmented, useExitTransition, useLayer } from '../ui';
import { BrandMark } from '../Shell/BrandMark';
import './Auth.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, preferences: UserPreferences) => void;
  /** When false the screen can't be dismissed (nobody is signed in). */
  canDismiss?: boolean;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const AuthModal = ({ isOpen, onClose, onSuccess, canDismiss = true }: AuthModalProps) => {
  const { mounted, closing } = useExitTransition(isOpen, 220);
  useLayer(isOpen && canDismiss, onClose);
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const googleBtnId = useId().replace(/:/g, '_') + '_gbtn';

  // Password criteria checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);

  const criteriaPassed = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  const passwordStrength: 'weak' | 'fair' | 'strong' =
    criteriaPassed <= 2 ? 'weak' : criteriaPassed <= 4 ? 'fair' : 'strong';

  // Fetch public auth config for Google Client ID
  useEffect(() => {
    let active = true;
    api.auth.getConfig()
      .then((cfg) => {
        if (active && cfg?.googleClientId) {
          setGoogleClientId(cfg.googleClientId);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Initialize Google Identity Services if client ID is set
  useEffect(() => {
    if (!googleClientId || !isOpen) return;

    const scriptId = 'google-gsi-client';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initGsi = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const btnContainer = document.getElementById(googleBtnId);
      if (btnContainer) {
        btnContainer.innerHTML = '';
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    } else {
      initGsi();
    }
  }, [googleClientId, isOpen, mode]);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  if (!mounted) return null;
  const isRegister = mode === 'register';

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) return;
    setError(null);
    setIsGoogleLoading(true);
    try {
      const res = await api.auth.google(response.credential);
      setAuthToken(res.token);
      const me = await api.auth.me();
      onSuccess(me.user, me.preferences);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google authentication failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleManualGoogleClick = () => {
    if (!googleClientId) {
      setError('Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to the environment (.env) to enable.');
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (criteriaPassed < 5) {
        setError('Please satisfy all password criteria (min 8 chars, uppercase, lowercase, number, and symbol).');
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = isRegister
        ? await api.auth.register({
            email: email.trim(),
            username: username.trim() || undefined,
            password,
            displayName: displayName.trim() || undefined
          })
        : await api.auth.login({
            identifier: identifier.trim(),
            password
          });

      setAuthToken(res.token);
      const me = await api.auth.me();
      onSuccess(me.user, me.preferences);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className={`auth-screen ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={isRegister ? 'Create an account' : 'Sign in'}>
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <BrandMark size={34} />
          <span>Productivity Inbox</span>
        </div>
        <div className="auth-brand-copy">
          <h1>
            Capture first.
            <br />
            <em>Organize later.</em>
          </h1>
          <p>Write things down the way they come to you. Dates are detected, and AI files each task into the quadrant where it belongs.</p>
        </div>
        <div className="auth-matrix" aria-hidden="true">
          {QUADRANTS.map((q, i) => {
            const Icon = q.icon;
            return (
              <div key={q.key} className="auth-q" style={{ ['--q' as string]: q.color, animationDelay: `${200 + i * 90}ms` }}>
                <Icon />
                <b>{q.name}</b>
                <span>{q.tagline}</span>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="auth-main">
        {canDismiss && <IconButton className="auth-close" icon={X} label="Close" noTip onClick={onClose} />}
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <BrandMark size={36} />
          </div>
          <h2>{isRegister ? 'Create your workspace' : 'Welcome back'}</h2>
          <p className="auth-sub">{isRegister ? 'Sign up with strong password protection or Google.' : 'Sign in with your username, email, or Google.'}</p>

          {/* Social Sign-In (Google) */}
          <div className="auth-social">
            {googleClientId ? (
              <div id={googleBtnId} className="auth-google-wrapper" />
            ) : (
              <button
                type="button"
                className="btn-google"
                onClick={handleManualGoogleClick}
                disabled={isGoogleLoading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}
          </div>

          <div className="auth-divider">
            <span>or with email / username</span>
          </div>

          <Segmented
            className="auth-tabs"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            items={[
              { value: 'signin', label: 'Sign in' },
              { value: 'register', label: 'Create account' }
            ]}
          />

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister ? (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="auth-name">
                    <UserIcon /> Full Name
                  </label>
                  <input id="auth-name" className="input input-lg" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Dhanavel" autoComplete="name" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="auth-user">
                    <AtSign /> Username
                  </label>
                  <input id="auth-user" className="input input-lg" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a unique username" autoComplete="username" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="auth-email">
                    <Mail /> Email Address
                  </label>
                  <input id="auth-email" type="email" className="input input-lg" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
                </div>
              </>
            ) : (
              <div className="field">
                <label className="field-label" htmlFor="auth-id">
                  <Mail /> Username or Email
                </label>
                <input id="auth-id" type="text" className="input input-lg" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="username or you@example.com" required autoFocus autoComplete="username" />
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="auth-pass">
                <Lock /> Password
              </label>
              <input
                id="auth-pass"
                type="password"
                className="input input-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>

            {/* Password strength & requirements for registration */}
            {isRegister && (
              <div className="password-checker">
                <div className="strength-meter">
                  <div className="strength-bar-bg">
                    <div className={`strength-bar-fill is-${passwordStrength}`} style={{ width: `${(criteriaPassed / 5) * 100}%` }} />
                  </div>
                  <span className={`strength-label is-${passwordStrength}`}>
                    <ShieldCheck size={13} />
                    {password ? `${passwordStrength.toUpperCase()} PASSWORD` : 'STRONG PASSWORD REQUIRED'}
                  </span>
                </div>
                <ul className="criteria-list">
                  <li className={hasMinLength ? 'met' : ''}>
                    <Check size={12} /> At least 8 characters
                  </li>
                  <li className={hasUppercase ? 'met' : ''}>
                    <Check size={12} /> Uppercase letter (A-Z)
                  </li>
                  <li className={hasLowercase ? 'met' : ''}>
                    <Check size={12} /> Lowercase letter (a-z)
                  </li>
                  <li className={hasNumber ? 'met' : ''}>
                    <Check size={12} /> Number (0-9)
                  </li>
                  <li className={hasSpecial ? 'met' : ''}>
                    <Check size={12} /> Special symbol (!@#$...)
                  </li>
                </ul>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" block loading={isLoading || isGoogleLoading} iconRight={ArrowRight} className="auth-submit">
              {isRegister ? 'Create secure account' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>,
    document.body
  );
};
