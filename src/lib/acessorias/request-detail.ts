import { parseAcessoriasDateTime } from "./dates";
import type { AcessoriasRequestDetail } from "./schemas";

/** Únicos endereços de onde o servidor aceita baixar anexos. */
export const ATTACHMENT_HOSTS = ["app.acessorias.com"] as const;

export type RequestInteraction = {
  author: string;
  at: string | null;
  kind: string;
  text: string;
  attachments: { name: string; url: string }[];
};

export type RequestDetail = {
  id: string;
  subject: string;
  type: string;
  priority: string;
  status: string;
  departmentName: string;
  officeResponsibles: string[];
  companyName: string;
  openedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedBy: string;
  /** Mais antigas primeiro, como uma linha do tempo. */
  interactions: RequestInteraction[];
};

/** Converte o detalhe da API (datas de Brasília sem fuso, quebras \r). */
export function mapRequestDetail(raw: AcessoriasRequestDetail): RequestDetail {
  const interactions = raw.SolInteracoes.map((item) => ({
    author: item.CmtUsuario.trim() || "—",
    at: parseAcessoriasDateTime(item.CmtDH),
    kind: item.CmtTipo.trim(),
    text: item.CmtText.replace(/\r\n?/g, "\n").trim(),
    attachments: item.CmtAnx.filter((anexo) =>
      isAllowedAttachmentUrl(anexo.Url),
    ).map((anexo) => ({ name: anexo.Nome.trim() || "anexo", url: anexo.Url })),
  })).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));

  return {
    id: raw.SolID,
    subject: raw.SolAssunto,
    type: raw.SolTipo,
    priority: raw.SolPrioridade,
    status: raw.SolStatus,
    departmentName: raw.DptoNome,
    officeResponsibles: raw.SolOfficeResp,
    companyName: raw.EmpNome,
    openedAt: parseAcessoriasDateTime(raw.SolDHAbertura),
    dueAt: parseAcessoriasDateTime(raw.SolDTPrazo),
    completedAt: parseAcessoriasDateTime(raw.SolDHFinalizacao),
    completedBy: raw.SolUsuarioFinalizador,
    interactions,
  };
}

/** Só HTTPS e hosts do Acessórias: impede usar o servidor como proxy aberto. */
export function isAllowedAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (ATTACHMENT_HOSTS as readonly string[]).includes(url.hostname) &&
      url.username === "" &&
      url.password === "" &&
      url.port === ""
    );
  } catch {
    return false;
  }
}

/**
 * Nome seguro para Content-Disposition: sem separadores de caminho, aspas
 * ou caracteres de controle, com no máximo 150 caracteres.
 */
export function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f"\\/:;*?<>|]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 150);
  return cleaned || "anexo";
}
