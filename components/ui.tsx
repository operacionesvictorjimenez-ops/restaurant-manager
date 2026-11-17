import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-14 px-5 text-base";
const btnVariants = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  ghost: "bg-surface text-ink border border-line hover:bg-surface-2",
  danger: "bg-crit text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof btnVariants }) {
  return <button className={cx(btnBase, btnVariants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof btnVariants }) {
  return <Link className={cx(btnBase, btnVariants[variant], className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-5", className)}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid gap-1">
      <h1 className="font-display text-3xl font-bold leading-none sm:text-4xl">{children}</h1>
      {sub && <p className="text-muted">{sub}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function Pill({
  tone = "accent",
  children,
}: {
  tone?: "ok" | "warn" | "crit" | "accent" | "muted";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    crit: "bg-crit-soft text-crit",
    accent: "bg-accent-soft text-accent",
    muted: "bg-surface-2 text-muted border border-line",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone])}>
      {children}
    </span>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-crit-soft px-4 py-3 text-sm font-semibold text-crit">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
        {state.ok}
      </p>
    );
  return null;
}
