import { cn } from "@/lib/format";

function Marca() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0 text-white" aria-hidden>
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="8"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeOpacity="0.38"
      />
      <path
        d="M9.2 23.2 16 8.4l6.8 14.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M12 17.4h8" fill="none" stroke="#38BDF8" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cn("flex items-center", compact ? "justify-center" : "gap-3")}>
      <Marca />
      {compact ? null : (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[10px] font-semibold tracking-[0.34em] text-white/75">
            DYNAMICS
          </span>
          <span className="mt-1 text-[17px] font-bold tracking-[0.2em] text-white">AERO</span>
        </span>
      )}
    </span>
  );
}
