import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, X, Info, BellRing, AlertTriangle, Trash2, type LucideIcon } from 'lucide-react';
import { Dialog } from './overlays';
import { Button } from './primitives';

/* ======================= Toasts ======================= */

export type ToastKind = 'success' | 'error' | 'info' | 'reminder';

export interface ToastOptions {
  title: string;
  description?: string;
  kind?: ToastKind;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  leaving?: boolean;
}

const ToastCtx = createContext<(t: ToastOptions) => void>(() => {});

const KIND_ICON: Record<ToastKind, LucideIcon> = { success: Check, error: X, info: Info, reminder: BellRing };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 200);
  }, []);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-3), { ...opts, id }]);
      setTimeout(() => dismiss(id), opts.duration ?? (opts.kind === 'error' || opts.kind === 'reminder' ? 9000 : 4200));
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toast-region" role="region" aria-live="polite" aria-label="Notifications">
          {items.map((t) => {
            const kind = t.kind ?? 'success';
            const Icon = KIND_ICON[kind];
            return (
              <div key={t.id} className={`toast ${kind} ${t.leaving ? 'is-leaving' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
                <span className="toast-icon">
                  <Icon strokeWidth={3} />
                </span>
                <div className="toast-text">
                  <div className="toast-title">{t.title}</div>
                  {t.description && <div className="toast-desc">{t.description}</div>}
                </div>
                {t.action && (
                  <button
                    className="toast-action"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
                <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                  <X />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ======================= Confirm dialog ======================= */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpen(false);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onClose={() => finish(false)}
        title={opts?.title}
        icon={opts?.danger ? Trash2 : AlertTriangle}
        iconTone={opts?.danger ? 'var(--coral)' : 'var(--amber)'}
        width={420}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => finish(false)}>
              {opts?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => finish(true)} autoFocus>
              {opts?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {opts?.message && <div className="t-caption" style={{ fontSize: 13.5 }}>{opts.message}</div>}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
