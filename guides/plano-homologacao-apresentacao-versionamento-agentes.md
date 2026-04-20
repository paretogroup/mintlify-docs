# Plano de navegação — homologação e apresentação

## Versionamento de agentes (TESS-13 / PR [#3658](https://github.com/paretogroup/tess-ai-platform/pull/3658))

Documento de apoio para **QA em homologação** e **demo para stakeholders**. Baseado no comportamento implementado no `tess-ai-platform` (branch integrada em `master` via migração TESS-13).

---

## 1. Visão rápida do que o PR entrega


| Camada                 | Entrega                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI**                 | Painel lateral React `VersionHistoryPanel`: lista paginada de versões, detalhe, diff campo a campo, fluxo de **rollback** com confirmação (incl. cenário de arquivos da Knowledge Base ausentes). |
| **Entrada na UI**      | Ícone de **histórico** (relógio) no **header do AI Studio** (`form-v2`), ao lado de Preview / Save. Abre o painel via estado global (Jotai).                                                      |
| **Persistência**       | Tabela `agent_versions`, colunas de versionamento em `openai` (`current_version_id`, etc.).                                                                                                       |
| **Gravação de versão** | Serviço acoplado ao fluxo de **save** do template (`PublishTemplateController` / gravação após alterações), criando snapshot quando o conteúdo muda em relação à última versão.                   |
| **API**                | Rotas REST para listar, obter detalhe e **rollback** (painel com sessão e API Sanctum).                                                                                                           |
| **Permissões**         | Features `AGENT_VERSION_READ` e `AGENT_VERSION_WRITE` (RBAC + seeder).                                                                                                                            |
| **Auditoria**          | Eventos / activity ao publicar versão ou concluir rollback (listener dedicado).                                                                                                                   |


---

## 2. Regras de exibição (comportamento crítico para homologação)

### 2.1 Quando o ícone de histórico **aparece**

No Blade `form-v2.blade.php`, o trigger `#agent-version-history-trigger` só deixa de estar `hidden` se **ambas** forem verdade:

1. O usuário tem permissão `feature.AGENT_VERSION_READ` (constante `AGENT_VERSION_READ`).
2. O agente tem `current_version_id` **não nulo** — ou seja, já existe pelo menos **uma versão registrada** (`OpenAIGenerator::hasBeenPublished()`).

**Implicação para testes:** em agente **novo** ou ainda sem nenhuma versão persistida, o ícone **não aparece**, mesmo com permissão de leitura. É preciso **salvar** uma alteração que gere a primeira versão; em seguida recarregar/estado atualizado conforme implementação.

### 2.2 Quem pode **rollback**

`canRestore` no React é `1` se:

- **Admin** da plataforma, **ou**
- Usuário com `AGENT_VERSION_READ` + `AGENT_VERSION_WRITE` **e** é **dono do template** *ou* tem permissão de escrita de template no workspace (`WORKSPACE_TEMPLATE_WRITE` no contexto do agente).

Quem só tem leitura deve conseguir **abrir o painel e ver histórico/diff**, mas **não** restaurar versões.

### 2.3 Onde navegar (URL conceitual)

- Fluxo de edição do agente no **painel** (AI Studio **v2** — `openai_v2` / `form-v2`), **não** na URL de “cópia” (`/1` no path desabilita fluxo de template completo para alguns controles).

---

## 3. Plano de navegação — **homologação (QA)**

Use como checklist. Ajuste IDs de workspace/agente aos do ambiente.

### Fase A — Pré-condições


| #   | Ação                                                                               | Resultado esperado                                           |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A1  | Confirmar deploy do build com `VersionHistoryPanel`, migrations e seed de features | Sem erro 500 ao abrir AI Studio                              |
| A2  | Usuário **com** `AGENT_VERSION_READ` + `AGENT_VERSION_WRITE`, owner do agente      | Preparado para fluxo completo                                |
| A3  | Usuário **só leitura** (READ, sem WRITE)                                           | Para teste de rollback bloqueado                             |
| A4  | Usuário **sem** `AGENT_VERSION_READ`                                               | Ícone de histórico ausente                                   |
| A5  | Workspace com plano/flags que habilitam as features de versão                      | Conforme `FeaturesSeeder` / `config/feature.php` no ambiente |


### Fase B — Primeira versão e aparição do ícone


| #   | Ação                                                                                                                | Resultado esperado                                              |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| B1  | Abrir **Agent Studio** → agente existente **sem** `current_version_id` (ou novo após primeiro save que cria versão) | Conforme regra 2.1                                              |
| B2  | Editar prompt ou campo relevante → **Salvar**                                                                       | Nova linha em `agent_versions`; `current_version_id` preenchido |
| B3  | Recarregar a página de edição                                                                                       | Ícone de histórico **visível** (se A2)                          |


### Fase C — Painel de histórico


| #   | Ação                                                                       | Resultado esperado                                                          |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| C1  | Clicar no ícone (relógio) — `aria-label` “View history” / título traduzido | Painel lateral abre (`isVersionHistoryOpenAtom = true`)                     |
| C2  | Listar versões                                                             | Paginação se muitas versões; ordem coerente (versão mais recente acessível) |
| C3  | Abrir uma versão específica                                                | Detalhe com snapshot / resumo de mudanças                                   |
| C4  | Comparar com anterior                                                      | Diff visual (incl. reorder de steps quando aplicável — `stepsChanged`)      |


### Fase D — Rollback (perfil com permissão)


| #   | Ação                                                   | Resultado esperado                                                                      |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| D1  | Escolher versão anterior → iniciar rollback            | Modal / confirmação (copy em **en / pt / pt-BR / es** via `__()`)                       |
| D2  | Confirmar                                              | Nova versão criada “em cima” do snapshot antigo; agente atual reflete estado restaurado |
| D3  | Cenário **KB com arquivos faltando** (se reproduzível) | Fluxo de aviso / confirmação extra conforme commits de rollback + KB                    |
| D4  | Após rollback                                          | Activity / auditoria registrada (evento publicado)                                      |


### Fase E — Permissões negativas


| #   | Ação                                               | Resultado esperado                                                                  |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| E1  | Usuário sem READ                                   | Sem ícone ou sem abertura do painel                                                 |
| E2  | Usuário com READ sem WRITE                         | Painel e diff OK; **sem** ação de rollback ou botão desabilitado (`canRestore="0"`) |
| E3  | Não-owner sem `WORKSPACE_TEMPLATE_WRITE` no agente | `canRestore` falso para não-admin                                                   |


### Fase F — Regressão leve


| #   | Ação                                                 | Resultado esperado                                                                       |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F1  | **Preview** do agente                                | Continua funcionando                                                                     |
| F2  | **Save** após rollback                               | Nova versão incremental, histórico coerente                                              |
| F3  | Mudança de **visibilidade** para público (não-admin) | Mensagens de “enviado para revisão” preservadas (commit relacionado a `isAdmin` + flash) |


### Fase G — API (opcional, homolog técnica)

Rotas (referência `master`):

- **API (Bearer + workspace):** `GET /api/agents/{agentId}/versions`, `GET .../versions/{versionId}`, `POST .../versions/{versionId}/rollback` (middleware `AGENT_VERSION_READ` / `AGENT_VERSION_WRITE` conforme rota).
- **Painel (sessão):** grupo `backend-api` → `agents/{agentId}/versions` (mesma controller com auth de painel).

Validar **401/403** com token ou sessão sem permissão.

---

## 4. Plano de navegação — **apresentação (demo)**

Roteiro sugerido **5–8 minutos** para Product / CS / Enterprise.

### 4.1 Narrativa

1. **Problema (30 s):** edições em agente crítico afetam todos os canais; sem histórico fica difícil auditar e reverter.
2. **Solução (1 min):** versões automáticas a cada save com mudança real; histórico único no AI Studio.
3. **Demo ao vivo (4–5 min):** seguir sequência **Login → Agentes → AI Studio (agente real) → ícone → painel → diff → rollback → save novo**.
4. **Governança (1 min):** permissões read vs write; owners/admins; auditoria em Activity.
5. **Encerramento (30 s):** limites conhecidos (ex.: modelo de “publicação” draft/publish explícito pode evoluir).

### 4.2 Roteiro de tela (ordem de cliques)


| Passo | O que mostrar                                             | O que dizer                                                                     |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | Lista de agentes / abrir agente já com versões            | “Aqui é o AI Studio onde o time edita o agente.”                                |
| 2     | Header superior direito: **ícone de relógio**             | “Só aparece para quem tem permissão e depois da primeira versão.”               |
| 3     | Clique → **painel lateral**                               | “Linha do tempo de versões; cada save relevante gera snapshot.”                 |
| 4     | Selecionar duas versões / **diff**                        | “Vemos o que mudou entre versões — prompt, passos, etc.”                        |
| 5     | **Rollback** (perfil com permissão)                       | “Restaurar não apaga o histórico: cria uma nova versão com o conteúdo antigo.”  |
| 6     | (Opcional) Mostrar usuário **só leitura** em outra sessão | “Quem só audita vê o histórico; quem restaura precisa de permissão de escrita.” |


### 4.3 Materiais de apoio

- Card Linear **TESS-13** (escopo e critérios de aceite).
- Documentação pública: `[pt/agent-versioning.mdx](../pt/agent-versioning.mdx)` (ajustar URL do site público se necessário).
- Screenshots homologados na pasta `images/` (referenciados na doc):
  - `agent-versioning-ai-studio-header.png` — header do AI Studio com ícone **Ver histórico**.
  - `agent-versioning-history-panel-diff.png` — painel aberto com linha do tempo e diff (ANTES/DEPOIS).
- Vídeo curto do painel como fallback se a homologação estiver instável.

### 4.4 Perguntas frequentes (preparação)

- **“Isso publica o agente no Marketplace?”** — Não por si só; versionamento é histórico técnico. Visibilidade continua em [Visibilidade](../pt/visibility.mdx).
- **“Embed/API passam a usar a versão antiga automaticamente?”** — Depende do roadmap de execução; o PR foca em histórico e rollback no editor (validar mensagem com engenharia se necessário).
- **“Quem pode ver o histórico?”** — Quem tem `AGENT_VERSION_READ` e agente com pelo menos uma versão.

---

## 5. Referências técnicas (para o time)


| Item            | Local no código (referência `master`)                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Trigger + gates | `resources/views/panel/admin/openai/custom/form-v2.blade.php`                                            |
| Painel React    | `resources/js/components/agentVersion/VersionHistoryPanel.jsx`                                           |
| Hooks           | `resources/js/hooks/useAgentVersions.js`                                                                 |
| Controller API  | `app/Http/Controllers/API/Agent/AgentVersionController.php`                                              |
| Rotas painel    | `routes/panel.php` → `agents/{agentId}/versions`                                                         |
| Rotas API       | `routes/api.php` → `agents/{agentId}/versions`                                                           |
| Permissões      | `app/Console/Commands/update_plans_permissions_configs/rbac.json`, `database/seeders/FeaturesSeeder.php` |


---

*Última atualização: alinhado ao comportamento descrito no PR 3658 e inspeção de rotas/templates no repositório `paretogroup/tess-ai-platform`.*