// Fixtures sanitizados: dados fictícios no formato observado na API real em
// 15/10/2026 (ACESSORIAS.md §11). Nenhum dado de cliente real.

export const companyFixture = {
  ID: "1234",
  Identificador: "11.222.333/0001-81",
  Razao: "Empresa Exemplo Comércio Ltda",
  Fantasia: "Exemplo",
  Status: "Ativa",
  Telefone: "1133334444",
  UF: "SP",
  ClienteDesde: "2020-01-15",
  ClienteAte: "0000-00-00",
  DataDoCadastro: "2020-01-10",
  Honorario: "0.00",
  DtLastDH: "15/10/2026 14:30:00",
  Departamentos: [
    {
      ID: "5",
      Nome: "Legalização",
      RespNome: "Fulana de Tal 101",
      RespEmail: " Fulana.Tal@Escritorio.Example ",
    },
    {
      ID: "13",
      Nome: "Legalização - Certificado Digital",
      RespNome: "Beltrano Silva 102",
      RespEmail: "beltrano.silva@escritorio.example",
    },
    {
      ID: "2",
      Nome: "Fiscal",
      RespNome: "Ciclano 103",
      RespEmail: "ciclano@escritorio.example",
    },
  ],
};

export const userFixture = {
  id: "54321",
  nome: "Fulana de Tal - 101",
  email: "Fulana.Tal@Escritorio.Example",
  status: "Ativo",
};

export const requestFixture = {
  SolID: "987654",
  SolTipo: "Externa",
  SolAssunto: "Renovação do alvará de funcionamento",
  SolPrioridade: "Alta",
  SolTipoUsuario: "Externo",
  SolUsuario: "Cliente Exemplo",
  SolUsuarioID: "777",
  SolStatus: "Resolvendo",
  SolEncerrada: "Não",
  SolAvaliacao: "",
  SolJust: "",
  SolDHAbertura: "01/10/2026 09:00:00",
  SolDTPrazo: "",
  SolDHUAt: "14/10/2026 16:45:10",
  SolDHFinalizacao: "",
  SolUsuarioFinalizador: "",
  SolUsuarioFinalizadorID: "",
  SolOfficeResp: ["Fulana de Tal"],
  SolOfficeRespID: ["54321"],
  SolEmpResp: ["Cliente Exemplo"],
  SolEmpRespID: ["777"],
  DptoID: "5",
  DptoNome: "Legalização",
  EmpID: "1234",
  EmpNome: "Empresa Exemplo Comércio Ltda",
  EmpCNPJ: "11.222.333/0001-81",
};
