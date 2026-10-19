"""Importação única dos vencimentos do sistema anterior (decisões de 19/10/2026).

Lê as planilhas exportadas (docs/*.xlsx, fora do git) e gera
supabase/apply/legal_legacy_import.sql (fora do git), para rodar uma vez no
SQL Editor do Supabase depois de aplicar legal_024.

Uso: python -I scripts/legacy-import/generate.py   (requer openpyxl)

Regras:
* As planilhas não têm CNPJ: o cliente é encontrado pelo nome, normalizado
  (maiúsculas, sem acento/pontuação, sem tipo societário, sem raiz de CNPJ
  do MEI). Importa só quando há exatamente um cliente ativo; "(MATRIZ)" com
  matriz e filiais de mesmo nome usa o CNPJ /0001. Filiais "F2", "F3"... e
  nomes ambíguos ou não encontrados ficam pendentes (relatório no JSON).
* Tipo pelo nome do documento (DOCUMENT_TYPES); documento desconhecido
  interrompe a geração.
* Responsável: a da Legalização do cliente (depto 5), senão a do
  Certificado Digital (13), como no cadastro manual.
* Situação ACTIVE; emissão, periodicidade, número e órgão ficam em branco
  para as operadoras completarem. Observação original preservada.
* Não duplica: ignora linha cujo (cliente, documento, vencimento) já existe.
* Autoria e auditoria (EXPIRATION_CREATED) do ADMIN, via sessão simulada.
"""

import datetime
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
SHEETS = [
    ROOT / "docs" / "Vencimentos_A1_formatado.xlsx",
    ROOT / "docs" / "Vencimentos_certs_formatado.xlsx",
]
OUTPUT = ROOT / "supabase" / "apply" / "legal_legacy_import.sql"
ADMIN_EMAIL = "desenvolvimento@escritoriologica.com.br"

CERTIFICADO, LICENCA, OUTRO = "CERTIFICADO", "LICENCA", "OUTRO"

DOCUMENT_TYPES = {
    "CERTIFICADO DIGITAL A1": CERTIFICADO,
    "CERTIFICADO DIGITAL A3": CERTIFICADO,
    "CERTIFICADO DIGITAL E CPF": CERTIFICADO,
    "SYN PASS - VALIDADOR EM NUVEM IDENTIDADE ELETRÔNICA": CERTIFICADO,
    "C.L.I - CERTIFICADO DE LICENCIAMENTO INTEGRADO": LICENCA,
    "AUTO DE VISTORIA DO BOMBEIRO": LICENCA,
    "ALVARA SANITARIO": LICENCA,
    "RENOVAÇÃO DO ALVARA SANITARIO": LICENCA,
    "LICENÇA DE OPERAÇÃO DA CETESB": LICENCA,
    "RENOVAÇÃO DA CETESB": LICENCA,
    "DISPENSA CETESB": LICENCA,
    "CERTIFICADO DE MOVIMENTAÇÃO DE RESIDUOS - CETESB": LICENCA,
    "TAXA DE LICENÇA DE FUNCIONAMENTO": LICENCA,
    "ALVARÁ DE FUNCIONAMENTO - OUTRO MUNICIPIO": LICENCA,
    "IBAMA": LICENCA,
    "CREMESP": LICENCA,
    "RENOVAÇÃO DO CREMESP": LICENCA,
    "CREA": LICENCA,
    "PROCURAÇÃO ELETRONICA": OUTRO,
    "PROCURAÇÃO": OUTRO,
    "PROCURAÇÃO DT-E SIARE/MG": OUTRO,
    "DECLARAÇÃO E-BEF": OUTRO,
    "DECLARAÇÃO PROINDE": OUTRO,
    "RETOMAR ASSUNTO COM O CLIENTE": OUTRO,
    "ISENÇÃO DE IPTU": OUTRO,
    "ISENÇÃO DE ISSQN": OUTRO,
    "ATA DE ELEIÇÃO DE MEMBROS": OUTRO,
    "CADASTRO ORGAO DE CLASSE": OUTRO,
    "ART": OUTRO,
    "SPE VENCIMENTO DO OBJETIVO SOCIAL": OUTRO,
}

# Normalização compartilhada pelos dois lados do vínculo (ver docstring).
BASE = """btrim(regexp_replace(regexp_replace(
      translate(upper({x}),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^A-Z0-9]+', ' ', 'g'), '\\s+', ' ', 'g'))"""
STRONG = """btrim(regexp_replace(regexp_replace(regexp_replace(
      ' ' || {base} || ' ',
      '^ \\d{{2}} \\d{{3}} \\d{{3}} | \\d{{11}} $', ' ', 'g'),
      ' (LTDA|ME|EPP|EIRELI|MEI|S A|SA|SS|LIMITADA|MATRIZ|DOMESTICA|0001) ', ' ', 'g'),
      '\\s+', ' ', 'g'))"""


def base(x: str) -> str:
    return BASE.format(x=x)


def strong(x: str) -> str:
    # Duas passagens: tokens vizinhos ("LTDA ME") compartilham o espaço.
    return STRONG.format(base=STRONG.format(base=base(x)))


def lit(value) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def read_rows():
    rows = []
    for path in SHEETS:
        sheet = openpyxl.load_workbook(path, data_only=True).worksheets[0]
        for number, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            if number == 1 or not any(cell not in (None, "") for cell in row):
                continue
            client, document, due, notes = (list(row) + [None] * 4)[:4]
            if not client or not document or not isinstance(due, datetime.datetime):
                sys.exit(f"{path.name} linha {number}: cliente, documento ou data inválidos")
            document = str(document).strip()
            if document not in DOCUMENT_TYPES:
                sys.exit(f"{path.name} linha {number}: documento sem tipo definido: {document!r}")
            notes = str(notes).replace("\r\n", "\n").strip() if notes else None
            if notes and len(notes) > 2000:
                sys.exit(f"{path.name} linha {number}: observação acima de 2000 caracteres")
            rows.append((path.name, number, str(client).strip(), document,
                         DOCUMENT_TYPES[document], due.date().isoformat(), notes))
    return rows


def main():
    rows = read_rows()
    values = ",\n  ".join(
        f"({lit(s)}, {n}, {lit(c)}, {lit(d)}, {lit(t)}, '{due}'::date, {lit(o)})"
        for s, n, c, d, t, due, o in rows
    )
    sql = f"""-- Importação dos vencimentos do sistema anterior. Gerado por
-- scripts/legacy-import/generate.py; contém dados de clientes: não versionar.
-- Pré-requisito: legal_024 aplicada. Rodar uma vez no SQL Editor; rodar de
-- novo não duplica. Retorna uma única célula JSON.
--
-- O SQL Editor grava cada comando separadamente: as tabelas temporárias
-- duram a sessão (preserve rows) e toda a gravação em legal_expirations
-- acontece num único bloco DO, que é tudo ou nada.

drop table if exists legal_import_rows, legal_import_result, legal_import_match;
create temp table legal_import_rows (
  sheet text, line int, client_name text, document_name text,
  expiration_type text, expiration_date date, notes text
) on commit preserve rows;
create temp table legal_import_result (
  sheet text, line int, client_name text, outcome text
) on commit preserve rows;

insert into legal_import_rows values
  {values};

do $$
declare
  v_admin_user uuid;
begin
  select user_id into v_admin_user
  from public.legal_profiles
  where email = {lit(ADMIN_EMAIL)} and active and hierarchy_level = 'ADMIN';
  if v_admin_user is null then
    raise exception 'Perfil ADMIN não encontrado ou inativo';
  end if;

  -- Sessão Microsoft do ADMIN: autoria e auditoria vêm dela (triggers).
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin_user,
      'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', 0)),
      'app_metadata', json_build_object('provider', 'azure', 'providers', json_build_array('azure'))
    )::text,
    true
  );

  create temp table legal_import_match on commit preserve rows as
  with names as (
    select distinct client_name,
           {base('client_name')} ~ '(^| )(F ?\\d{{1,2}}|FILIAL)( |$)' as is_branch,
           {strong('client_name')} as key
    from legal_import_rows
  ),
  clients as (
    select c.id, c.status, c.document_number, {strong('c.corporate_name')} as key
    from public.legal_clients c
    union all
    select c.id, c.status, c.document_number, {strong('c.trade_name')} as key
    from public.legal_clients c
    where c.trade_name is not null
  ),
  candidates as (
    select n.client_name, n.is_branch,
           array_agg(distinct c.id) filter (where c.status = 'Ativa') as active_ids,
           array_agg(distinct c.id) filter (where c.status = 'Ativa'
             and regexp_replace(coalesce(c.document_number, ''), '\\D', '', 'g') ~ '^\\d{{8}}0001\\d{{2}}$') as head_ids,
           count(distinct c.id) as any_status
    from names n
    left join clients c on c.key = n.key and n.key <> ''
    group by n.client_name, n.is_branch
  )
  select client_name,
         case
           when is_branch then null
           when cardinality(active_ids) = 1 then active_ids[1]
           when cardinality(active_ids) > 1 and cardinality(head_ids) = 1 then head_ids[1]
         end as client_id,
         case
           when is_branch then 'filial sem CNPJ na planilha'
           when cardinality(active_ids) = 1 then null
           when cardinality(active_ids) > 1 and cardinality(head_ids) = 1 then null
           when cardinality(active_ids) > 1 then 'mais de um cliente ativo com esse nome'
           when any_status > 0 then 'cliente inativo no Acessórias'
           else 'cliente não encontrado no Acessórias'
         end as reason
  from candidates;

  insert into legal_import_result
  select r.sheet, r.line, r.client_name, m.reason
  from legal_import_rows r
  join legal_import_match m using (client_name)
  where m.client_id is null;

  -- Linhas vinculadas, sem repetir (cliente, documento, vencimento).
  with linked as (
    select distinct on (m.client_id, r.document_name, r.expiration_date)
           r.sheet, r.line, r.client_name, m.client_id, r.document_name,
           r.expiration_type, r.expiration_date, r.notes
    from legal_import_rows r
    join legal_import_match m using (client_name)
    where m.client_id is not null
    order by m.client_id, r.document_name, r.expiration_date, r.sheet, r.line
  ),
  fresh as (
    select l.* from linked l
    where not exists (
      select 1 from public.legal_expirations e
      where e.client_id = l.client_id
        and e.document_name = l.document_name
        and e.expiration_date = l.expiration_date
        and e.deleted_at is null)
  ),
  inserted as (
    insert into public.legal_expirations (
      client_id, expiration_type, document_name, expiration_date, notes,
      responsible_user_id
    )
    select f.client_id, f.expiration_type::public.legal_expiration_type,
           f.document_name, f.expiration_date, f.notes,
           (select p.id
            from public.legal_client_responsibles cr
            join public.legal_profiles p
              on p.email = cr.responsible_email and p.active and p.hierarchy_level <> 'ADMIN'
            where cr.client_id = f.client_id and cr.department_id in ('5', '13')
            order by case cr.department_id when '5' then 0 else 1 end
            limit 1)
    from fresh f
    returning client_id, document_name, expiration_date
  )
  insert into legal_import_result
  select l.sheet, l.line, l.client_name,
         case when i.client_id is null then 'já existia' else 'importado' end
  from linked l
  left join inserted i
    on i.client_id = l.client_id and i.document_name = l.document_name
   and i.expiration_date = l.expiration_date;

  perform set_config('request.jwt.claims', '', true);
end
$$;

select jsonb_build_object(
  'linhas_na_planilha', (select count(*) from legal_import_rows),
  'importados', (select count(*) from legal_import_result where outcome = 'importado'),
  'ja_existiam', (select count(*) from legal_import_result where outcome = 'já existia'),
  'por_tipo', (select jsonb_object_agg(expiration_type, n) from (
      select r.expiration_type, count(*) n
      from legal_import_result x join legal_import_rows r using (sheet, line)
      where x.outcome = 'importado' group by r.expiration_type) t),
  'pendentes', (select count(*) from legal_import_result where outcome not in ('importado', 'já existia')),
  'pendentes_por_motivo', (select jsonb_object_agg(outcome, n) from (
      select outcome, count(*) n from legal_import_result
      where outcome not in ('importado', 'já existia') group by outcome) t),
  'pendentes_por_cliente', (select jsonb_agg(jsonb_build_object('cliente', client_name, 'motivo', outcome, 'linhas', n) order by client_name) from (
      select client_name, outcome, count(*) n from legal_import_result
      where outcome not in ('importado', 'já existia') group by client_name, outcome) t)
) as result;
"""
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(sql, encoding="utf-8", newline="\n")
    print(f"{len(rows)} linhas -> {OUTPUT}")


if __name__ == "__main__":
    main()
