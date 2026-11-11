import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CircleCheck, CircleAlert, OctagonX, Minus } from 'lucide-react';
import type { EvidenceStatus } from '../../../data/types';

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        size === 'sm' && 'h-8 rounded-lg px-3 text-[13px]',
        size === 'md' && 'h-10 rounded-lg px-4 text-[14px]',
        size === 'lg' && 'h-12 rounded-xl px-5 text-[15px]',
        variant === 'primary' && 'bg-teal text-white hover:bg-teal-ink shadow-sm',
        variant === 'secondary' && 'bg-[#eef0ec] text-ink hover:bg-[#e4e7e2]',
        variant === 'ghost' && 'text-ink-2 hover:bg-black/5',
        variant === 'danger' && 'border border-bad-line bg-surface text-bad hover:bg-bad-soft',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line/80 bg-surface shadow-[0_1px_2px_rgba(23,33,43,0.04)]', className)}>{children}</div>;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export const STATUS_META: Record<
  EvidenceStatus | 'none',
  { label: string; short: string; tone: string; dot: string; soft: string; Icon: typeof CircleCheck }
> = {
  supported: {
    label: 'Backed by your evidence',
    short: 'Backed by evidence',
    tone: 'bg-ok-soft text-ok border-ok-line',
    dot: 'bg-ok',
    soft: 'bg-ok-soft text-ok',
    Icon: CircleCheck,
  },
  review: {
    label: 'A person needs to check this',
    short: 'Needs an expert',
    tone: 'bg-warn-soft text-warn border-warn-line',
    dot: 'bg-[#d08a14]',
    soft: 'bg-warn-soft text-warn',
    Icon: CircleAlert,
  },
  blocked: {
    label: 'Must be fixed before publishing',
    short: 'Must fix',
    tone: 'bg-bad-soft text-bad border-bad-line',
    dot: 'bg-bad',
    soft: 'bg-bad-soft text-bad',
    Icon: OctagonX,
  },
  none: {
    label: 'Nothing to check',
    short: 'Nothing to check',
    tone: 'bg-canvas text-muted border-line',
    dot: 'bg-line-2',
    soft: 'bg-canvas text-muted',
    Icon: Minus,
  },
};

export function StatusBadge({ status, long, className }: { status: EvidenceStatus | 'none'; long?: boolean; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium', m.tone, className)}>
      <m.Icon size={13} strokeWidth={2.2} aria-hidden />
      {long ? m.label : m.short}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2', className)}>
      {children}
    </span>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputCls =
  'w-full rounded-md border border-line-2 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/15';

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-2 bg-surface/60 px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-muted">{icon}</div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
