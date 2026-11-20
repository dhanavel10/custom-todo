import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';
import { IconButton } from './primitives';

/** Keeps content mounted for `ms` after `open` turns false so exit animations can play. */
export function useExitTransition(open: boolean, ms = 190) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { mounted, closing };
}

/** Stack of open modal layers so Escape only closes the top-most one. */
const layerStack: number[] = [];
let layerSeq = 0;

export function useLayer(active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const id = ++layerSeq;
    layerStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (layerStack[layerStack.length - 1] !== id) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = layerStack.indexOf(id);
      if (i >= 0) layerStack.splice(i, 1);
    };
  }, [active]);
}

export const isAnyLayerOpen = () => layerStack.length > 0;
const useModalBehavior = useLayer;

/* ---------------- Dialog ---------------- */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  iconTone?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  hideClose?: boolean;
  /** Render body without default padding */
  bare?: boolean;
  labelledBy?: string;
}

export const Dialog = ({ open, onClose, title, subtitle, icon: Icon, iconTone, width, children, footer, className = '', hideClose, bare }: DialogProps) => {
  const { mounted, closing } = useExitTransition(open);
  useModalBehavior(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog for keyboard users, restore on close
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        const target = panel.querySelector<HTMLElement>('[autofocus], input, textarea, select, button:not([aria-label="Close"])');
        (target ?? panel).focus({ preventScroll: true });
      }
    }, 30);
    return () => {
      clearTimeout(t);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <div className={`dialog-overlay ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        style={width ? ({ ['--dialog-w']: `${width}px` } as React.CSSProperties) : undefined}
      >
        {(title || !hideClose) && (
          <div className="dialog-header">
            {Icon && (
              <div className="dialog-icon" style={iconTone ? ({ ['--dialog-icon-c']: iconTone, ['--dialog-icon-bg']: `color-mix(in srgb, ${iconTone} 13%, transparent)` } as React.CSSProperties) : undefined}>
                <Icon />
              </div>
            )}
            <div className="dialog-titles">
              {title && <div className="dialog-title">{title}</div>}
              {subtitle && <div className="dialog-subtitle">{subtitle}</div>}
            </div>
            {!hideClose && <IconButton icon={X} label="Close" size="sm" noTip onClick={onClose} />}
          </div>
        )}
        {bare ? children : <div className="dialog-body">{children}</div>}
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

/* ---------------- Drawer ---------------- */

export const Drawer = ({ open, onClose, header, children, label }: { open: boolean; onClose: () => void; header: ReactNode; children: ReactNode; label: string }) => {
  const { mounted, closing } = useExitTransition(open, 220);
  useModalBehavior(open, onClose);
  if (!mounted) return null;
  return createPortal(
    <>
      <div className={`drawer-overlay ${closing ? 'is-closing' : ''}`} onClick={onClose} />
      <aside className={`drawer ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="drawer-header">{header}</div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>,
    document.body
  );
};

/* ---------------- Popover / Menu ---------------- */

export interface MenuTriggerProps {
  ref: (el: HTMLElement | null) => void;
  onClick: (e: React.MouseEvent) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
}

interface MenuProps {
  trigger: (props: MenuTriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
  onOpenChange?: (open: boolean) => void;
}

export const Menu = ({ trigger, children, align = 'end', width, onOpenChange }: MenuProps) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: 'top' | 'bottom' } | null>(null);

  const setOpenState = useCallback(
    (v: boolean) => {
      setOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange]
  );
  const close = useCallback(() => setOpenState(false), [setOpenState]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = popRef.current;
      if (!a || !p) return;
      const pw = p.offsetWidth;
      const ph = p.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'end' ? a.right - pw : a.left;
      left = Math.max(8, Math.min(left, vw - pw - 8));
      const below = a.bottom + 6;
      const fitsBelow = below + ph <= vh - 8;
      const top = fitsBelow ? below : Math.max(8, a.top - ph - 6);
      setPos({ top, left, origin: fitsBelow ? 'top' : 'bottom' });
    };
    place();
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a || a.bottom < 0 || a.top > window.innerHeight) {
        close();
        return;
      }
      place();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, align, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        anchorRef.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(popRef.current?.querySelectorAll<HTMLElement>('.menu-item:not(:disabled)') ?? []);
        if (!items.length) return;
        e.preventDefault();
        const idx = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  return (
    <>
      {trigger({
        ref: (el) => {
          anchorRef.current = el;
        },
        onClick: (e) => {
          e.stopPropagation();
          setOpenState(!open);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open
      })}
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="popover"
            role="menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, transformOrigin: pos?.origin ?? 'top', visibility: pos ? 'visible' : 'hidden' }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
};

export const MenuItem = ({
  icon: Icon,
  children,
  hint,
  onSelect,
  danger,
  selected,
  swatch,
  disabled
}: {
  icon?: LucideIcon;
  children: ReactNode;
  hint?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  selected?: boolean;
  swatch?: string;
  disabled?: boolean;
}) => (
  <button type="button" role="menuitem" className={`menu-item ${danger ? 'danger' : ''} ${selected ? 'is-selected' : ''}`} onClick={onSelect} disabled={disabled}>
    {swatch ? <span className="menu-swatch" style={{ background: swatch }} /> : Icon ? <Icon /> : null}
    <span>{children}</span>
    {hint && <span className="menu-hint">{hint}</span>}
  </button>
);

export const MenuLabel = ({ children }: { children: ReactNode }) => <div className="menu-label">{children}</div>;
export const MenuSep = () => <div className="menu-sep" />;
