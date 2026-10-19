"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { OperacaoProvider } from "@/context/operacao-context";
import { OPERACAO } from "@/data/calendario";
import { cn } from "@/lib/format";
import { NAV_ITEMS, titleForPath } from "@/components/shell/nav";
import { Wordmark } from "@/components/shell/wordmark";
import { hidratarLocal, restaurarDemonstracao } from "@/services/dados";

function NavLinks({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-1 flex-col gap-0.5 py-3", compact ? "px-2" : "px-3")}
      aria-label="Principal"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={compact ? item.title : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-md border-l-[3px] text-[14px] transition-colors",
              compact ? "justify-center px-0" : "gap-3 px-3",
              active
                ? "border-tse-yellow bg-tse-soft font-bold text-tse-text"
                : "border-transparent font-medium text-tse-text hover:bg-[#F4F4F2]",
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", active ? "text-tse-gold" : "text-tse-muted")}
              aria-hidden
            />
            <span className={compact ? "sr-only" : undefined}>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Viewer({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-tse-line py-4",
        compact ? "justify-center px-2" : "px-4",
      )}
      title={compact ? OPERACAO.viewerName : undefined}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tse-yellow text-[12px] font-bold text-white">
        {OPERACAO.viewerInitials}
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold text-tse-text">
            {OPERACAO.viewerName}
          </span>
          <span className="block truncate text-[12px] text-tse-muted">
            {OPERACAO.viewerRole}
          </span>
        </span>
      )}
    </div>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [recolhida, setRecolhida] = useState<boolean>(false);
  const mobileOpen = openPath === pathname;
  const title = titleForPath(pathname);
  const closeMenu = () => setOpenPath(null);
  const alternarMenu = () => setRecolhida((atual) => !atual);

  return (
    <div className="flex h-dvh overflow-hidden bg-tse-bg text-tse-text">
      <aside
        id="cockpit-sidebar"
        className={cn(
          "hidden h-full shrink-0 flex-col overflow-hidden border-r border-tse-line bg-white shadow-[4px_0_18px_rgba(0,0,0,0.04)] transition-[width] duration-200 ease-out lg:flex",
          recolhida ? "w-[4.5rem]" : "w-60",
        )}
      >
        <button
          type="button"
          onClick={alternarMenu}
          aria-expanded={!recolhida}
          aria-controls="cockpit-sidebar"
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex h-16 w-full shrink-0 items-center border-b border-tse-top-line bg-tse-yellow text-white hover:bg-[#162032]",
            recolhida ? "justify-center px-0" : "px-4",
          )}
        >
          <Wordmark compact={recolhida} />
        </button>
        {recolhida ? null : (
          <>
            <p className="px-4 pt-4 text-[10px] font-bold tracking-[0.16em] text-tse-muted uppercase">
              Operação
            </p>
            <p className="px-4 pb-1 text-[13px] font-semibold">{OPERACAO.name}</p>
          </>
        )}
        <NavLinks compact={recolhida} />
        <Viewer compact={recolhida} />
        {recolhida ? null : <RodapeCadastro />}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Fechar menu"
            onClick={closeMenu}
          />
          <aside className="relative flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-tse-top-line bg-tse-yellow px-4">
              <Wordmark />
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md text-white hover:bg-white/20"
                onClick={closeMenu}
                aria-label="Fechar menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="px-4 pt-4 text-[10px] font-bold tracking-[0.16em] text-tse-muted uppercase">
              Operação
            </p>
            <p className="px-4 pb-1 text-[13px] font-semibold">{OPERACAO.name}</p>
            <NavLinks onNavigate={closeMenu} />
            <Viewer />
            <RodapeCadastro />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          id="cockpit-topbar"
          className="flex h-16 shrink-0 items-center gap-3 border-b border-tse-top-line bg-tse-yellow px-3 sm:px-5"
        >
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-white hover:bg-white/20 lg:hidden"
            onClick={() => setOpenPath(pathname)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/painel" className="lg:hidden" aria-label="Dynamics Aero">
            <Wordmark />
          </Link>
          <span className="hidden h-4 w-px bg-white/40 sm:block" aria-hidden />
          <h1 className="truncate font-display text-[13px] tracking-[0.08em] text-white uppercase sm:text-[15px]">
            {title}
          </h1>
          <div className="ml-auto flex items-center gap-2 text-white">
            <span className="hidden text-[13px] font-semibold sm:inline">
              {OPERACAO.viewerName}
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#333333]">
              {OPERACAO.viewerInitials}
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function HidratarDados() {
  useEffect(() => {
    hidratarLocal();
  }, []);
  return null;
}

function RodapeCadastro() {
  const [confirmar, setConfirmar] = useState<boolean>(false);

  return (
    <div className="px-4 pb-4">
      <p className="text-[11px] leading-4 text-tse-muted">
        Os lançamentos ficam neste navegador. O banco entra na etapa seguinte.
      </p>
      {confirmar ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              restaurarDemonstracao();
              setConfirmar(false);
            }}
            className="text-[12px] font-bold text-[#EF4444]"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            className="text-[12px] font-semibold text-tse-muted"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="mt-2 text-left text-[12px] font-bold text-tse-olive"
        >
          Restaurar demonstração
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OperacaoProvider>
      <HidratarDados />
      <ShellFrame>{children}</ShellFrame>
    </OperacaoProvider>
  );
}
