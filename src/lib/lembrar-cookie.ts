export const COOKIE_LEMBRAR = "aero-lembrar";

type OpcoesComPrazo = {
  maxAge?: number;
  expires?: Date;
};

export function opcoesConformeLembranca<T extends OpcoesComPrazo>(options: T, lembrar: boolean): T {
  if (lembrar) return options;
  const copia = { ...options };
  delete copia.maxAge;
  delete copia.expires;
  return copia;
}
