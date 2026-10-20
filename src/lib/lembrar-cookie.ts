export const COOKIE_LEMBRAR = "aero-lembrar";
export const CHAVE_EMAIL = "dynamics-aero-email";
export const CHAVE_BIOMETRIA = "dynamics-aero-biometria";
export const CHAVE_BIO_PENDENTE = "dynamics-aero-biometria-pendente";

export function cookieSeguro(https: boolean): boolean {
  return https;
}

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
