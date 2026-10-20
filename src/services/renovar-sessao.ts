export type TokenRenovado = {
  access_token: string;
  refresh_token: string;
};

function ehToken(valor: unknown): valor is TokenRenovado {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Record<string, unknown>;
  return typeof item.access_token === "string" && typeof item.refresh_token === "string";
}

export async function renovarSessao(
  urlSupabase: string,
  chaveAnonima: string,
  refreshToken: string,
): Promise<TokenRenovado | null> {
  try {
    const resposta = await fetch(`${urlSupabase}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: chaveAnonima,
        Authorization: `Bearer ${chaveAnonima}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!resposta.ok) return null;
    const corpo: unknown = await resposta.json();
    return ehToken(corpo) ? corpo : null;
  } catch {
    return null;
  }
}
