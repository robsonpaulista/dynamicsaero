export const CABECALHO_USUARIO = "x-aero-usuario";

const PREFIXO = "base64-";

export type SessaoCookie = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export function chaveAuth(urlSupabase: string): string {
  const host = new URL(urlSupabase).hostname.split(".")[0] ?? "";
  return `sb-${host}-auth-token`;
}

function juntarCookie(cookies: { name: string; value: string }[], chave: string): string {
  const direto = cookies.find((cookie) => cookie.name === chave)?.value;
  if (direto) return direto;
  const partes: string[] = [];
  for (let indice = 0; ; indice += 1) {
    const pedaco = cookies.find((cookie) => cookie.name === `${chave}.${indice}`)?.value;
    if (!pedaco) break;
    partes.push(pedaco);
  }
  return partes.join("");
}

function lerObjeto(bruto: string): SessaoCookie | null {
  if (!bruto) return null;
  let texto = bruto;
  if (bruto.startsWith(PREFIXO)) {
    try {
      texto = Buffer.from(bruto.slice(PREFIXO.length), "base64url").toString("utf8");
    } catch {
      return null;
    }
  }
  if (!texto.startsWith("{")) return null;
  try {
    const valor: unknown = JSON.parse(texto);
    if (!valor || typeof valor !== "object") return null;
    const item = valor as Record<string, unknown>;
    if (typeof item.access_token !== "string" || typeof item.refresh_token !== "string") return null;
    const expires = typeof item.expires_at === "number" ? item.expires_at : 0;
    return {
      access_token: item.access_token,
      refresh_token: item.refresh_token,
      expires_at: expires,
    };
  } catch {
    return null;
  }
}

export function usuarioDoToken(accessToken: string): string | null {
  const partes = accessToken.split(".");
  if (partes.length < 2) return null;
  try {
    const json = Buffer.from(partes[1] ?? "", "base64url").toString("utf8");
    const valor: unknown = JSON.parse(json);
    if (!valor || typeof valor !== "object") return null;
    const sub = (valor as Record<string, unknown>).sub;
    if (typeof sub !== "string") return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub)) return null;
    return sub;
  } catch {
    return null;
  }
}

export function lerSessaoCookie(
  cookies: { name: string; value: string }[],
  chave: string,
): SessaoCookie | null {
  return lerObjeto(juntarCookie(cookies, chave));
}
