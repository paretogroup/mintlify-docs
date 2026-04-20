# Plano de homologação — TESS-44 (Artefatos do workspace / Tess Pages)

**PR:** [paretogroup/tess-ai-platform#3616](https://github.com/paretogroup/tess-ai-platform/pull/3616)  
**Card:** [Linear — Workspace Artifacts](https://linear.app/tessai/review/workspace-artifacts-personal-settings-section-and-workspace-pages-api-4893ade57e61)

## 1. Snapshot do PR

| Área | Entrega |
|------|---------|
| **UI (painel)** | Seção **Artifacts** nas configurações pessoais (modal de Settings): lista paginada, filtro por status (`active` / `inactive`), links para o chat de origem, coluna de criador para quem tem **manage**, publicar/despublicar com confirmação na despublicação. |
| **API pública** | `GET /api/executions/pages/workspace` — lista páginas publicadas do workspace. `POST /api/pages/{page_id}/publish` — publica ou despublica por id da página (body `unpublish`). |
| **API painel** | `GET /backend-api/pages/workspace` — mesma listagem para sessão autenticada. Publicação no painel continua em `POST /backend-api/executions/{id}/pages/publish`, agora retornando **200** com estado da página (antes **202** enfileirado). |
| **Persistência / RBAC** | Novas permissões: `workspace:pages:read`, `workspace:pages:write`, `workspace:pages:manage` (seed + `config/feature.php`). Regras de visibilidade: sem **read** e sem **manage** → 403 na listagem; só **manage** filtra por `user_id` na query. |
| **Correções** | Status do painel `GET .../pages/status` não retorna mais `index_document`. Fluxo de publish usa `bucket_path`/`bucket_name` da página quando existem. |

## 2. Regras críticas

- **Cabeçalho obrigatório:** `x-workspace-id` nas rotas de workspace de API pública; sem ele → **400** (mensagem traduzida).
- **Publicar via API:** exige **write** ou **manage** no workspace; caso contrário → **403** com mensagem de permissão.
- **Listar via API (chave sem usuário):** middleware trata leitura/gestão no escopo da chave conforme implementação do controller (documentado no código: contexto API sem `Auth::user()` recebe trilha específica de permissões na listagem e no publish).
- **Despublicar:** confirmação no browser (subdomínio pode ser reutilizado).
- **Arquivos no storage:** se não houver `index.html` no caminho esperado do workspace → **404** com erro de “No site files found…”.

## 3. Fases de teste (painel)

### A — Pré-condições

- Usuário em um workspace com Tess Pages já geradas (subdomínio preenchido).
- Combinações de papel: sem read; só read; write; manage (idealmente 4 contas ou ajustes de permissão).

### B — Navegação

1. Abrir **Settings** pelo menu do perfil (canto inferior esquerdo).
2. No menu lateral, abrir **Artifacts**.
3. Verificar subtítulo “Manage your published workspace artifacts” (ou string localizada).

### C — Listagem e filtros

- Paginação (`per_page` no client vs servidor, máximo 50 no backend).
- Filtro de status: ativas, inativas, todas.
- Com **manage**: filtro por criador (`user_id`) restringe linhas; sem **manage**: lista só artefatos do próprio usuário.

### D — Happy path publicar / despublicar

- Publicar página inativa e verificar URL pública e status **active**.
- Despublicar: aceitar confirmação; status **inactive**; link público deixa de ser válido (conforme RPA).

### E — Chat

- Quando a página tem **chat de origem** associado (id raiz > 0), o link “abrir chat” deve apontar para a rota interna com `_chat_id`.

### F — Negativo / produto

- Usuário sem permissão de artefatos e **sem** `workspace:billing:write`: mensagem de sem permissão.
- Usuário sem permissão de artefatos mas **com** billing write: CTA de upgrade (conforme testes do frontend).

### G — Regressão Tess Pages

- Fluxo existente de publicação a partir do chat (`ToolDropdown`) continua funcionando.
- `GET .../pages/status` não inclui `index_document`.

## 4. Roteiro de demo (5–8 min)

1. Mostrar onde fica **Artifacts** nas configurações pessoais.  
2. Listar páginas com filtro de status.  
3. Abrir link público de uma página ativa.  
4. Despublicar com confirmação e mostrar que o status mudou.  
5. (Opcional) Mostrar coluna de criador como admin com **manage**.  

**FAQ:** Diferença entre lista no painel e `GET /api/executions/pages/workspace`? Mesma origem de dados; API é para integrações com token e header de workspace.

## 5. Smoke API (curl)

Substitua `TOKEN`, `WORKSPACE_ID` e `PAGE_ID`.

```bash
curl -sS -H "Authorization: Bearer TOKEN" \
  -H "Accept: application/json" \
  -H "x-workspace-id: WORKSPACE_ID" \
  "https://api.tess.im/api/executions/pages/workspace?per_page=15&status=active"
```

```bash
curl -sS -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: WORKSPACE_ID" \
  -d '{"unpublish":false}' \
  "https://api.tess.im/api/pages/PAGE_ID/publish"
```

**Esperado:** **200** com corpo JSON contendo `id`, `subdomain`, `status`, `url` (quando aplicável), `updated_at` após publish; erros **400** (header), **403** (workspace ou permissão), **404** (página / arquivos), **500** (falha ao disparar RPA).

## 6. Screenshots (Mintlify)

Capturas feitas em **https://s4-tech.tess.im/** (Cursor IDE Browser MCP, sem Playwright), salvas em `images/` com prefixo `te44-s4-` e referenciadas em `en/pt/es/workspace-artifacts.mdx`. Cobrem a navegação (B), o *happy path* de listagem (C) e o *gated* (F) quando ainda houver ficheiro dedicado.

- `te44-s4-settings-modal.png` — modal de Settings: **Workspace → Artifacts** na barra lateral e, com permissão de leitura de páginas, **tabela** (filtros “all statuses / all users”, colunas, paginação, ações *Publish* / *Unpublish*, *Open chat*).
- `te44-s4-workspace-artifacts.png` — painel **Artifacts** com **CTA de upgrade** (utilizador com `workspace:billing:write` mas sem acesso a Tess Pages; fase F, secção 3).
- `te44-s4-chat-overview.png` — visão do **chat** (agente) antes de abrir **Settings** pelo menu do perfil (fase B, secção 3; opcional para runbooks).
- (Opcional) Caso de **sem permissão e sem billing write** (só mensagem, fase F, secção 3): regravar um `te44-s4-workspace-artifacts-denied.png` ou reutilizar texto, se quiserem ilustrar os três desfechos (lista / CTA / sem permissão).

**Regravação:** após alterações de UI, ou trocar de combinação de plano/roles, ou trocar de conta no browser MCP.
