import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type FetchGlobal = typeof fetch;

let cliente: SupabaseClient | null = null;

/** Realtime não é usado no servidor; evita exigir WebSocket nativo (Node 22+). */
function transporteInerte(): typeof WebSocket {
  return class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 3;
    bufferedAmount = 0;
    extensions = "";
    protocol = "";
    url = "";
    binaryType: BinaryType = "blob";
    onclose: ((this: WebSocket, ev: CloseEvent) => unknown) | null = null;
    onerror: ((this: WebSocket, ev: Event) => unknown) | null = null;
    onmessage: ((this: WebSocket, ev: MessageEvent) => unknown) | null = null;
    onopen: ((this: WebSocket, ev: Event) => unknown) | null = null;
    constructor(_url: string | URL, _protocols?: string | string[]) {}
    close(_code?: number, _reason?: string): void {}
    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(_event: Event): boolean {
      return false;
    }
  } as unknown as typeof WebSocket;
}

function mensagemRede(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro);
  const causa =
    "cause" in erro && erro.cause instanceof Error
      ? `${erro.cause.message} ${"code" in erro.cause ? String((erro.cause as { code?: string }).code ?? "") : ""}`
      : "";
  return `${erro.name} ${erro.message} ${causa}`.toLowerCase();
}

function ehFalhaTransitoria(erro: unknown): boolean {
  const texto = mensagemRede(erro);
  return /fetch failed|failed to fetch|network|econnreset|econnrefused|etimedout|enotfound|und_err|socket|aborted|timeout|falar com o banco/.test(
    texto,
  );
}

async function esperar(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const fetchComRetry: FetchGlobal = async (input, init) => {
  const tentativas = 3;
  let ultimo: unknown;
  for (let i = 0; i < tentativas; i += 1) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 12_000);
    try {
      const sinalExterno = init?.signal;
      if (sinalExterno) {
        if (sinalExterno.aborted) controle.abort();
        else {
          sinalExterno.addEventListener("abort", () => controle.abort(), { once: true });
        }
      }
      const resposta = await fetch(input, { ...init, signal: controle.signal });
      clearTimeout(timer);
      return resposta;
    } catch (erro: unknown) {
      clearTimeout(timer);
      ultimo = erro;
      if (!ehFalhaTransitoria(erro) || i === tentativas - 1) throw erro;
      await esperar(300 * (i + 1));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("Falha de rede com o Supabase.");
};

export function clienteServico(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Faltam a URL do Supabase ou a chave de serviço.");
  }

  cliente = createClient(url, chave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: transporteInerte(),
    },
    global: {
      fetch: fetchComRetry,
    },
  });
  return cliente;
}

export function ehErroRedeSupabase(erro: unknown): boolean {
  if (typeof erro === "object" && erro !== null && "message" in erro) {
    return ehFalhaTransitoria(erro);
  }
  return ehFalhaTransitoria(erro);
}
