"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FieldLabel } from "@/components/ui/tse";
import { PageStack } from "@/components/ui/tse";

export function FormPage({
  voltarHref,
  voltar,
  titulo,
  texto = "O lançamento entra na leitura e no rateio e fica salvo no banco da operação.",
  children,
}: {
  voltarHref: string;
  voltar: string;
  titulo: string;
  texto?: string;
  children: ReactNode;
}) {
  return (
    <PageStack>
      <Link
        href={voltarHref}
        className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline"
      >
        {voltar}
      </Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[22px] font-bold tracking-tight">{titulo}</h2>
        <p className="mt-1 text-[13px] text-tse-muted">{texto}</p>
        <div className="mt-5">{children}</div>
      </section>
    </PageStack>
  );
}

export function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Campo({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "tel" | "numeric" | "decimal";
}) {
  return (
    <label>
      <FieldLabel>{label}</FieldLabel>
      <input
        required={required}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow"
      />
    </label>
  );
}

export function CampoArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="sm:col-span-2">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-tse-border bg-white px-2.5 py-2 text-[13px] outline-none focus:border-tse-yellow"
      />
    </label>
  );
}

export function CampoSelect({
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
    <label>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow"
      >
        {children}
      </select>
    </label>
  );
}

export function ErroForm({ children }: { children: string }) {
  return (
    <p className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[13px] font-semibold text-[#EF4444]">
      {children}
    </p>
  );
}

export function AcoesForm({
  cancelarHref,
  excluir,
  salvando,
}: {
  cancelarHref: string;
  excluir?: () => void;
  salvando?: string;
}) {
  const [confirmar, setConfirmar] = useState<boolean>(false);

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md bg-tse-olive px-4 text-[13px] font-bold text-white hover:bg-[#1E293B]"
      >
        {salvando ?? "Salvar"}
      </button>
      <Link
        href={cancelarHref}
        className="inline-flex h-9 items-center rounded-md bg-[#E8E8E8] px-4 text-[13px] font-semibold hover:bg-[#DDDDDD]"
      >
        Cancelar
      </Link>
      {excluir ? (
        confirmar ? (
          <>
            <button
              type="button"
              onClick={excluir}
              className="inline-flex h-9 items-center rounded-md bg-[#EF4444] px-4 text-[13px] font-bold text-white"
            >
              Confirmar exclusão
            </button>
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              className="text-[13px] font-semibold text-tse-muted"
            >
              Manter
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmar(true)}
            className="ml-auto text-[13px] font-bold text-[#EF4444]"
          >
            Excluir
          </button>
        )
      ) : null}
    </div>
  );
}

export function numeroCampo(value: string): number {
  const normal = value.trim().replace(",", ".");
  if (!normal) return 0;
  const parsed = Number(normal);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function BotaoNovo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex h-8 items-center rounded-md bg-tse-olive px-3 text-[13px] font-bold text-white hover:bg-[#1E293B]"
    >
      {children}
    </Link>
  );
}

export function LinkEditar({ href }: { href: string }) {
  return (
    <Link href={href} prefetch={false} className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline">
      Editar
    </Link>
  );
}
