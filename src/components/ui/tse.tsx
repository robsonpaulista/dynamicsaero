"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDados } from "@/hooks/use-dados";
import { cn } from "@/lib/format";
import { corDoSocio, STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";
import { formatPercent } from "@/lib/format";
import { getAircraft, partnerShort } from "@/services/operacao";

export function PageStack({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-white p-4 shadow-sm sm:p-5", className)}>
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-bold text-tse-text">{title}</h2> : null}
            {subtitle ? (
              <p className="mt-0.5 text-[12px] leading-5 text-tse-muted">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        STATUS_CLASS[value] ?? "bg-tse-bg text-tse-muted",
      )}
    >
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function OwnershipBar({ aircraftId }: { aircraftId: string }) {
  useDados();
  const aircraft = getAircraft(aircraftId);
  if (!aircraft) return null;

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-tse-bg">
        {aircraft.ownership.map((item) => (
          <div
            key={item.partnerId}
            style={{
              width: `${item.share * 100}%`,
              background: corDoSocio(item.partnerId),
            }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-tse-muted">
        {aircraft.ownership.map((item) => (
          <li key={item.partnerId}>
            <span className="font-semibold text-tse-text">
              {partnerShort(item.partnerId)}
            </span>{" "}
            {formatPercent(item.share)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-bold uppercase tracking-wide text-tse-olive hover:underline"
    >
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-tse-bg px-4 py-8 text-center text-[13px] text-tse-muted">
      {children}
    </p>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">{children}</div>
  );
}

export const tableClass = "w-full min-w-[720px] text-left text-[13px]";
export const theadClass =
  "bg-tse-bar text-[11px] font-bold uppercase tracking-wide text-tse-muted";
export const thClass = "px-3 py-2.5 font-bold";
export const tdClass = "px-3 py-2.5 align-middle";
export const trClass = "border-t border-[#EEEEEE] hover:bg-tse-soft";

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-tse-muted">
      {children}
    </span>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-40 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] text-tse-text outline-none focus:border-tse-yellow"
      >
        {children}
      </select>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="min-w-48 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] text-tse-text outline-none focus:border-tse-yellow"
      />
    </label>
  );
}
