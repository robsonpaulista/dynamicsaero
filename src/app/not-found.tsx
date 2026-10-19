import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-tse-bg px-6 text-center text-tse-text">
      <p className="font-display text-[28px] tracking-[0.12em]">AERO</p>
      <h1 className="mt-4 text-[22px] font-bold">Esta página não existe</h1>
      <p className="mt-2 max-w-sm text-[14px] text-tse-muted">
        O endereço não faz parte da operação de demonstração.
      </p>
      <Link
        href="/painel"
        className="mt-6 rounded-md bg-tse-olive px-4 py-2 text-[13px] font-bold text-white"
      >
        Ir ao painel
      </Link>
    </main>
  );
}
