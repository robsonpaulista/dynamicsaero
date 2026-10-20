"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ScanFace } from "lucide-react";
import { cn } from "@/lib/format";
import { CHAVE_BIO_PENDENTE, CHAVE_BIOMETRIA, CHAVE_EMAIL, COOKIE_LEMBRAR } from "@/lib/lembrar-cookie";
import { clienteNavegador } from "@/services/supabase-navegador";
import { criarPrimeiroAcesso, entrar, validarSessao } from "@/services/usuarios";

function aparelhoComFaceId(): boolean {
  return /iPhone|iPad/.test(navigator.userAgent);
}

function mensagemBiometria(erro: { name?: string; message: string }): string {
  const texto = `${erro.name ?? ""} ${erro.message}`.toLowerCase();
  if (texto.includes("notallowed") || texto.includes("abort")) return "A biometria foi cancelada.";
  return "Não foi possível usar a biometria neste aparelho. Entre com a senha.";
}

async function biometriaDoAparelho(): Promise<boolean> {
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function guardarEmail(valor: string, lembrar: boolean): void {
  if (lembrar) window.localStorage.setItem(CHAVE_EMAIL, valor.trim().toLowerCase());
  else window.localStorage.removeItem(CHAVE_EMAIL);
}

function ehRedirecionamento(erro: unknown): boolean {
  if (!erro || typeof erro !== "object" || !("digest" in erro)) return false;
  const digest = erro.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type FaseEntrada = "splash" | "form";

function MarcaEntrada({ animada, compacta }: { animada: boolean; compacta: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 32 32"
        className={cn(
          "text-white transition-all duration-700",
          compacta ? "size-16 sm:size-20" : "size-24 sm:size-28",
        )}
        aria-hidden
      >
        <rect
          x="0.75"
          y="0.75"
          width="30.5"
          height="30.5"
          rx="8"
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeOpacity="0.45"
        />
        <path
          d="M9.2 23.2 16 8.4l6.8 14.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
          className={animada ? "aero-traco" : undefined}
        />
        <path
          d="M12 17.4h8"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="1.7"
          strokeLinecap="round"
          className={animada ? "aero-barra" : undefined}
        />
      </svg>
      <p
        className={cn(
          "font-semibold tracking-[0.34em] text-white/75 transition-all duration-700",
          compacta ? "mt-4 text-[10px]" : "mt-6 text-[11px] sm:text-xs",
          animada && "aero-dynamics",
        )}
      >
        DYNAMICS
      </p>
      <p
        className={cn(
          "-mt-0.5 font-bold tracking-[0.2em] text-white transition-all duration-700",
          compacta ? "text-[22px] sm:text-[26px]" : "text-[28px] sm:text-[34px]",
          animada && "aero-aero",
        )}
      >
        AERO
      </p>
    </div>
  );
}

export function EntradaView({
  primeiroAcesso,
  avisoInicial,
}: {
  primeiroAcesso: boolean;
  avisoInicial: string;
}) {
  const [fase, setFase] = useState<FaseEntrada>("splash");
  const [nome, setNome] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [senha, setSenha] = useState<string>("");
  const [mostrarSenha, setMostrarSenha] = useState<boolean>(false);
  const [lembrar, setLembrar] = useState<boolean>(true);
  const [biometria, setBiometria] = useState<boolean>(false);
  const [usarBiometria, setUsarBiometria] = useState<boolean>(false);
  const [temPasskey, setTemPasskey] = useState<boolean>(false);
  const [rotuloBio, setRotuloBio] = useState<string>("Entrar com biometria");
  const [erro, setErro] = useState<string>(avisoInicial);
  const [enviando, setEnviando] = useState<boolean>(false);

  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setFase("form"), reduzido ? 0 : 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_EMAIL);
    if (salvo) {
      setEmail(salvo);
      setLembrar(true);
    }
    setTemPasskey(window.localStorage.getItem(CHAVE_BIOMETRIA) === "1");
    setRotuloBio(aparelhoComFaceId() ? "Entrar com Face ID" : "Entrar com biometria");
    void biometriaDoAparelho().then((disponivel) => {
      setBiometria(disponivel);
      setUsarBiometria(disponivel);
    });
  }, []);

  async function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setErro("");
    guardarEmail(email, lembrar);
    if (lembrar && usarBiometria && biometria) {
      window.localStorage.setItem(CHAVE_BIO_PENDENTE, "1");
    } else {
      window.localStorage.removeItem(CHAVE_BIO_PENDENTE);
    }
    const falha = primeiroAcesso
      ? await criarPrimeiroAcesso(nome, email, senha, lembrar)
      : await entrar(email, senha, lembrar);
    if (falha) {
      window.localStorage.removeItem(CHAVE_BIO_PENDENTE);
      setErro(falha);
      setEnviando(false);
    }
  }

  async function aoUsarBiometria() {
    setEnviando(true);
    setErro("");
    try {
      const seguro = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${COOKIE_LEMBRAR}=1; Path=/; Max-Age=${400 * 24 * 60 * 60}; SameSite=Lax${seguro}`;
      const supabase = clienteNavegador();
      const resultado = await supabase.auth.signInWithPasskey();
      if (resultado.error || !resultado.data.session) {
        setErro(
          resultado.error
            ? mensagemBiometria(resultado.error)
            : "Não foi possível entrar com a biometria.",
        );
        setEnviando(false);
        return;
      }
      const falha = await validarSessao();
      if (falha) {
        setErro(falha);
        setEnviando(false);
        return;
      }
    } catch (falha) {
      if (ehRedirecionamento(falha)) throw falha;
      const mensagem =
        falha instanceof Error ? mensagemBiometria(falha) : "Não foi possível entrar com a biometria.";
      setErro(mensagem);
      setEnviando(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0F172A] px-6 text-white [color-scheme:dark]">
      <div className="aero-brilho pointer-events-none absolute size-[34rem] rounded-full bg-[#38BDF8]/25 blur-3xl" />
      <div className="aero-varredura pointer-events-none absolute inset-0" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <MarcaEntrada animada={fase === "splash"} compacta={fase === "form"} />
        {fase === "form" ? (
          <form
            onSubmit={(event) => {
              void aoEnviar(event);
            }}
            className="aero-sobe mt-8 w-full"
          >
            <p className="text-center text-[11px] font-semibold tracking-[0.28em] text-white/55 uppercase">
              {primeiroAcesso ? "Primeiro acesso" : "Acesso"}
            </p>
            <h1 className="mt-2 text-center text-[22px] font-bold tracking-tight text-white">
              {primeiroAcesso ? "Criar o primeiro acesso" : "Entrar na operação"}
            </h1>
            <p className="mt-2 text-center text-[14px] leading-5 text-white/60">
              {primeiroAcesso
                ? "Esse acesso comanda o cockpit. Depois dá para incluir o restante da equipe."
                : "Use o e-mail e a senha da operação."}
            </p>

            <div className="mt-7 flex flex-col gap-4">
              {primeiroAcesso ? (
                <label>
                  <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">
                    Nome
                  </span>
                  <input
                    required
                    autoComplete="name"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="aero-campo h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#38BDF8]"
                  />
                </label>
              ) : null}
              <label>
                <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">
                  E-mail
                </span>
                <input
                  required
                  type="email"
                  autoComplete={primeiroAcesso ? "username" : "username webauthn"}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="aero-campo h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#38BDF8]"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">
                  Senha
                </span>
                <span className="relative block">
                  <input
                    required
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete={primeiroAcesso ? "new-password" : "current-password"}
                    minLength={8}
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    className="aero-campo h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 pr-11 text-[15px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-[#38BDF8]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((atual) => !atual)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/70 hover:text-white"
                  >
                    {mostrarSenha ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </span>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[14px] text-white/80">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(event) => {
                    const marcado = event.target.checked;
                    setLembrar(marcado);
                    if (!marcado) setUsarBiometria(false);
                  }}
                  className="size-4 accent-[#38BDF8]"
                />
                Lembrar-me neste aparelho
              </label>
              {biometria && !temPasskey ? (
                <label className="flex items-start gap-2 text-[14px] text-white/80">
                  <input
                    type="checkbox"
                    checked={lembrar && usarBiometria}
                    disabled={!lembrar}
                    onChange={(event) => setUsarBiometria(event.target.checked)}
                    className="mt-0.5 size-4 accent-[#38BDF8]"
                  />
                  <span>
                    {rotuloBio.replace("Entrar com ", "Ativar ")}
                    <span className="mt-0.5 block text-[12px] leading-4 text-white/50">
                      O aparelho pede a biometria na próxima entrada. A senha não fica salva.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>

            {erro ? (
              <p className="mt-4 text-center text-[13px] font-semibold text-[#FCA5A5]" role="alert">
                {erro}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={enviando}
              className="mt-7 h-11 w-full rounded-xl bg-[#38BDF8] text-[15px] font-bold text-[#0F172A] transition-colors hover:bg-[#7DD3FC] disabled:opacity-60"
            >
              {enviando ? "Entrando…" : primeiroAcesso ? "Criar e entrar" : "Entrar"}
            </button>
            {temPasskey && biometria && !primeiroAcesso ? (
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  void aoUsarBiometria();
                }}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/25 text-[15px] font-bold text-white hover:border-[#38BDF8] disabled:opacity-60"
              >
                <ScanFace className="size-4" aria-hidden />
                {rotuloBio}
              </button>
            ) : null}
          </form>
        ) : (
          <p className="sr-only">Abrindo a Dynamics Aero</p>
        )}
      </div>
    </main>
  );
}
