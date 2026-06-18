# Front-end — Triagem de Ansiedade em Adolescentes

Front-end já integrado ao back-end real (`main.py`, FastAPI). Arquivos:

- `index.html` — estrutura da página
- `style.css` — estilos
- `script.js` — toda a lógica de integração com a API

## Como rodar

1. Suba o back-end (na pasta dele): `uvicorn main:app --reload` (porta padrão `8000`, com o modelo em `models/melhor_modelo.pkl`).
2. Abra o `index.html` no navegador (ou sirva com `python -m http.server`, se preferir).

Sem o back-end no ar, o front entra em **modo demonstração** automaticamente: aparece um aviso no topo e os resultados/histórico são gerados localmente, só para visualização. Isso **não é o modelo real**.

## Rotas usadas pelo front (já implementadas em `main.py`)

### `GET /`
Usada só para detectar se a API está no ar (não existe um `/health` dedicado).

### `POST /prever`
**Request body:**
```json
{
  "idade": 15,
  "genero": "M",
  "horas_diarias_redes_sociais": 4.0,
  "uso_plataforma": "Instagram",
  "horas_sono": 7.0,
  "tempo_tela_antes_dormir": 1.0,
  "desempenho_academico": 3.0,
  "atividade_fisica": 1.0,
  "nivel_interacao_social": "medio",
  "nivel_estresse": 5,
  "nivel_vicio": 5
}
```
Os campos categóricos vão como texto, exatamente como o back-end espera: `genero` (`M`/`F`), `uso_plataforma` (`Instagram`/`TikTok`/`ambos`), `nivel_interacao_social` (`baixo`/`medio`/`alto`).

**Response:**
```json
{
  "status": "sucesso",
  "predicao_ansiedade_alta": 1,
  "dados_recebidos": { ... }
}
```
Importante: **não há campo de probabilidade** — o back-end só chama `modelo.predict()`, não `predict_proba()`. Por isso o front mostra um indicador binário (ícone + selo "Alto risco"/"Baixo risco"), sem percentual, quando está usando a API real. O medidor com "%" só aparece no modo demonstração.

Se `status` vier como `"erro"` (ex.: modelo não carregado), o front exibe um alerta para o usuário e registra o detalhe no console.

### `GET /predicoes`
**Response:**
```json
{
  "total": 1,
  "predicoes": [
    {
      "id": 1,
      "data_hora": "2026-06-12 19:29:15",
      "dados_entrada": { ... },
      "predicao_ansiedade_alta": 1
    }
  ]
}
```
O front desaninha cada item (`dados_entrada` + `predicao_ansiedade_alta` + `data_hora`) para montar a tabela de histórico, e inverte a ordem para mostrar o mais recente primeiro.

> ⚠️ Esse histórico fica em memória no back-end — reiniciar o servidor (`uvicorn`) apaga tudo. Isso é esperado, está documentado no README do back-end também.

## Onde editar se algo mudar no back-end

Tudo fica isolado no topo do `script.js`:
```js
const API_BASE_URL = "http://localhost:8000";
const ENDPOINTS = {
  root:    () => `${API_BASE_URL}/`,
  predict: () => `${API_BASE_URL}/prever`,
  history: () => `${API_BASE_URL}/predicoes`,
};
```
Se o back-end passar a expor `predict_proba` (probabilidade) no futuro, basta o `POST /prever` devolver um campo `probability` (0 a 1) que o front já volta a mostrar o medidor com percentual automaticamente — essa lógica já está pronta em `renderResult()`.
