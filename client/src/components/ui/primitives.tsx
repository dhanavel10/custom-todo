import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Search, X, type LucideIcon } from 'lucide-react';

/* ---------------- Button ---------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'danger-ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
  loading?: boolean;
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, block, loading, active, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  const cls = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', active && 'is-active', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : Icon ? <Icon /> : null}
      {children}
      {IconRight && !loading ? <IconRight /> : null}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'danger';
  active?: boolean;
  tipPos?: 'top' | 'bottom' | 'left' | 'right';
  noTip?: boolean;
  badge?: boolean;
  spinning?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', tone = 'default', active, tipPos, noTip, badge, spinning, className = '', type = 'button', ...rest },
  ref
) {
  const cls = ['icon-btn', size !== 'md' && size, tone === 'danger' && 'danger', active && 'is-active', className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      aria-label={label}
      data-tip={noTip ? undefined : label}
      data-tip-pos={tipPos}
      {...rest}
    >
      <Icon className={spinning ? 'spin' : undefined} />
      {badge && <span className="dot-badge" />}
    </button>
  );
});

export const Spinner = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className="spin" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ---------------- Switch ---------------- */

export const Switch = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) => {
  const sw = (
    <button type="button" role="switch" aria-checked={checked} className="switch" disabled={disabled} onClick={() => onChange(!checked)} aria-label={typeof label === 'string' ? label : undefined} />
  );
  if (!label) return sw;
  return (
    <label className="switch-row" onClick={(e) => { e.preventDefault(); if (!disabled) onChange(!checked); }}>
      {sw}
      <span>{label}</span>
    </label>
  );
};

/* ---------------- Kbd ---------------- */

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;
export const ModKey = () => <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>;

/* ---------------- Search field ---------------- */

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  hint?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchField = ({ value, onChange, placeholder = 'Search', className = '', autoFocus, hint, inputRef, onKeyDown }: SearchFieldProps) => (
  <div className={`search ${className}`}>
    <Search />
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.stopPropagation();
          onChange('');
        }
        onKeyDown?.(e);
      }}
      aria-label={placeholder}
    />
    {value ? <IconButton icon={X} label="Clear search" size="sm" noTip className="search-clear" onClick={() => onChange('')} /> : hint}
  </div>
);

/* ---------------- Segmented control (animated indicator) ---------------- */

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size,
  className = '',
  ariaLabel
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm';
  className?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const el = wrap.querySelector<HTMLElement>(`[data-seg="${CSS.escape(value)}"]`);
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [value, items]);

  return (
    <div ref={wrapRef} className={`segmented ${size ?? ''} ${className}`} role="tablist" aria-label={ariaLabel}>
      {ind && <span className="segmented-indicator" style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} />}
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-seg={it.value}
            className={`segmented-item ${active ? 'is-active' : ''}`}
            onClick={() => onChange(it.value)}
          >
            {Icon && <Icon />}
            {it.label}
            {it.count !== undefined && <span className="count">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Progress ---------------- */

export const ProgressBar = ({ value, tone, thin, color }: { value: number; tone?: 'success'; thin?: boolean; color?: string }) => (
  <div className={`progress ${thin ? 'thin' : ''} ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, ...(color ? { ['--progress-c' as string]: color } : {}) }} />
  </div>
);

export const ProgressRing = ({
  value,
  size = 48,
  stroke = 5,
  color,
  label,
  labelSize
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
  labelSize?: number;
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Animate from 0 on mount for a satisfying fill
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const offset = c * (1 - Math.max(0, Math.min(100, shown)) / 100);
  return (
    <div className="ring" style={{ width: size, height: size, ...(color ? { ['--ring-c' as string]: color } : {}) }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      {label !== undefined && (
        <span className="ring-label" style={{ fontSize: labelSize ?? Math.round(size * 0.26) }}>
          {label}
        </span>
      )}
    </div>
  );
};

/* ---------------- Empty state ---------------- */

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  tone,
  compact
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: string;
  compact?: boolean;
}) => (
  <div className={`empty ${compact ? 'compact' : ''}`} style={tone ? ({ ['--empty-c']: tone, ['--empty-c-soft']: `color-mix(in srgb, ${tone} 13%, transparent)` } as React.CSSProperties) : undefined}>
    <div className="empty-art">
      <Icon />
    </div>
    <div className="empty-title">{title}</div>
    {description && <div className="empty-desc">{description}</div>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

/* ---------------- Skeleton ---------------- */

export const Skeleton = ({ w = '100%', h = 14, r }: { w?: number | string; h?: number | string; r?: number }) => (
  <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
);

export const TaskListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="task-list" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="task-row skeleton-row" style={{ animationDelay: `${i * 40}ms` }}>
        <Skeleton w={18} h={18} r={9} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Skeleton w={`${55 + ((i * 17) % 35)}%`} h={12} />
          <Skeleton w={`${25 + ((i * 11) % 20)}%`} h={10} />
        </div>
      </div>
    ))}
  </div>
);

/* ---------------- Section header ---------------- */

export const SectionHead = ({ icon: Icon, title, count, right, tone }: { icon?: LucideIcon; title: ReactNode; count?: number; right?: ReactNode; tone?: string }) => (
  <div className="section-head">
    <span className="t-eyebrow" style={tone ? { color: tone } : undefined}>
      {Icon && <Icon />}
      {title}
    </span>
    {count !== undefined && <span className="count">{count}</span>}
    <span className="rule" />
    {right}
  </div>
);
