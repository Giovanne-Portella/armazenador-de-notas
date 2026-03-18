# Contexto de IA — Armazenador de Notas

## Visão Geral do Projeto

Aplicação web para gerenciamento de notas e análises em formato Kanban com sistema de amizades e compartilhamento de notas em tempo real. Desenvolvida em HTML5, CSS3 e JavaScript puro (ES Modules). Autenticação via Google OAuth (Supabase Auth). Dados persistidos no PostgreSQL via Supabase com Row Level Security (RLS). Push Notifications via Web Push API + Service Worker. Hospedada no Netlify via deploy automático do GitHub.

**URL de produção:** `https://salvar-notas.netlify.app`

## Stack Técnica

| Camada          | Tecnologia                                              |
| --------------- | ------------------------------------------------------- |
| Linguagem       | JavaScript ES2020+ (ES Modules)                         |
| Markup          | HTML5 semântico                                         |
| Estilo          | CSS3 com Custom Properties (variáveis)                  |
| Backend/DB      | Supabase (PostgreSQL + Auth + RLS)                      |
| Autenticação    | Google OAuth 2.0 via Supabase Auth                      |
| PDF             | jsPDF 2.5.1 + html2canvas 1.4.1                        |
| Push            | Web Push API + Service Worker + Netlify Scheduled Fn    |
| Deploy          | Netlify (auto-deploy via GitHub, sem build step)        |
| Segurança       | RLS por usuário, headers HTTP, CHECK constraints        |
| Dependências    | web-push ^3.6.7, @supabase/supabase-js ^2.49.0         |

## Arquitetura Modular

```
login.html          ← Página de login (Google OAuth)
index.html          ← App principal (protegido por auth)
_headers            ← Headers de segurança HTTP (Netlify)
netlify.toml        ← Config Netlify (build, functions, cron)
sw.js               ← Service Worker (push notifications, cache v2)
package.json        ← Dependências (web-push, supabase-js)
├── css/
│   ├── variables.css   ← Variáveis CSS e temas (cores, gradientes)
│   ├── base.css        ← Reset, tipografia, botões, animações
│   ├── layout.css      ← Header, loading, perfil, colunas Kanban, stats
│   ├── components.css  ← Cards de nota, paletas de cor, análises, amigos, pull-refresh
│   ├── editor.css      ← Toolbar rich text, blocos, PDF export
│   ├── modal.css       ← Modal base e variantes
│   ├── login.css       ← Página de login (glassmorphism, dark mode)
│   └── responsive.css  ← Breakpoints mobile (768px), tablet, small
├── js/
│   ├── supabase.js     ← Client Supabase (URL + anon key)
│   ├── auth.js         ← Google OAuth login/logout, session management
│   ├── app.js          ← Entry point, auth check, bindings, init, pull-to-refresh
│   ├── state.js        ← Estado centralizado, CRUD Supabase, migração, shared notes
│   ├── notes.js        ← CRUD de notas (UUID), visualização, compartilhamento
│   ├── editor.js       ← Rich text (formatação, cores, imagens, resize)
│   ├── render.js       ← Renderização de colunas, stats, filtros, drag & drop
│   ├── theme.js        ← Dark mode e seleção de temas
│   ├── export.js       ← Exportação PDF/JSON de notas e análises
│   ├── analysis.js     ← CRUD de análises (UUID), blocos, side notes
│   ├── friends.js      ← Sistema de amizades, compartilhamento, modais
│   ├── push.js         ← Web Push subscription, permissão, envio
│   └── utils.js        ← Constantes, paleta de cores, helpers
├── netlify/
│   └── functions/
│       └── check-reminders.mjs  ← Scheduled function (cron 1h) — push reminders
└── docs/
    ├── AI_CONTEXT.md           ← Este arquivo
    ├── SUPABASE_SETUP.md       ← Guia completo de configuração Supabase
    ├── MODULARIZATION.md       ← Histórico de modularização e próximos passos
    └── FRIENDS_MIGRATION.sql   ← SQL de migração (profiles, friendships, note_shares)
```

## Modelo de Dados

### Banco de Dados (Supabase/PostgreSQL)

#### Tabela `notes`
| Coluna       | Tipo         | Descrição                                    |
| ------------ | ------------ | -------------------------------------------- |
| `id`         | UUID (PK)    | Identificador único                          |
| `user_id`    | UUID (FK)    | Referência a `auth.users(id)` ON DELETE CASCADE |
| `title`      | TEXT         | Título da nota (obrigatório)                 |
| `content`    | TEXT         | Conteúdo HTML rico                           |
| `group_name` | TEXT         | Nome do grupo (opcional)                     |
| `color`      | TEXT         | Cor do card (default: 'gray')                |
| `status`     | TEXT         | ID da coluna Kanban (dinâmico)               |
| `reminder_at`| TIMESTAMPTZ  | Data/hora do lembrete (nullable)             |
| `created_at` | TIMESTAMPTZ  | Data de criação                              |
| `updated_at` | TIMESTAMPTZ  | Auto-atualizado via trigger                  |

**Cores disponíveis:** `blue`, `green`, `red`, `yellow`, `orange`, `purple`, `pink`, `cyan`, `lime`, `indigo`, `gray`

**Status (colunas Kanban):** Dinâmico via tabela `columns`. Padrão: `notes`, `to-do`, `in-progress`, `impediment`, `agenda`, `completed`. Especial: `compartilhadas` (auto-criada para notas recebidas).

#### Tabela `analyses`
| Coluna       | Tipo         | Descrição                                    |
| ------------ | ------------ | -------------------------------------------- |
| `id`         | UUID (PK)    | Identificador único                          |
| `user_id`    | UUID (FK)    | Referência a `auth.users(id)` ON DELETE CASCADE |
| `title`      | TEXT         | Título da análise (obrigatório)              |
| `blocks`     | JSONB        | Array de blocos `[{id, content, sideNote}]`  |
| `created_at` | TIMESTAMPTZ  | Data de criação                              |
| `updated_at` | TIMESTAMPTZ  | Auto-atualizado via trigger                  |

#### Tabela `columns`
| Coluna       | Tipo         | Descrição                                    |
| ------------ | ------------ | -------------------------------------------- |
| `id`         | TEXT (PK)    | Slug gerado a partir do título               |
| `user_id`    | UUID (FK)    | Referência a `auth.users(id)` ON DELETE CASCADE |
| `title`      | TEXT         | Nome da coluna (obrigatório)                 |
| `position`   | INTEGER      | Posição de ordenação                         |
| `is_done`    | BOOLEAN      | Se marca notas como concluídas               |

#### Tabela `profiles`
| Coluna        | Tipo         | Descrição                                   |
| ------------- | ------------ | ------------------------------------------- |
| `id`          | UUID (PK/FK) | Referência a `auth.users(id)` ON DELETE CASCADE |
| `email`       | TEXT         | Email do usuário                             |
| `display_name`| TEXT         | Nome de exibição                             |
| `avatar_url`  | TEXT         | URL do avatar (Google)                       |
| `created_at`  | TIMESTAMPTZ  | Data de criação                              |

> Criada automaticamente via trigger `on_auth_user_created` a cada login/signup.

#### Tabela `friendships`
| Coluna         | Tipo         | Descrição                                  |
| -------------- | ------------ | ------------------------------------------ |
| `id`           | UUID (PK)    | Identificador único                        |
| `requester_id` | UUID (FK)    | Quem enviou o pedido (`auth.users`)        |
| `addressee_id` | UUID (FK)    | Quem recebeu (`auth.users`)               |
| `status`       | TEXT         | `pending` ou `accepted`                    |
| `created_at`   | TIMESTAMPTZ  | Data do pedido                             |

> UNIQUE constraint em `(requester_id, addressee_id)`.

#### Tabela `note_shares`
| Coluna      | Tipo         | Descrição                                    |
| ----------- | ------------ | -------------------------------------------- |
| `note_id`   | UUID (PK/FK) | Nota compartilhada (`notes.id`) ON DELETE CASCADE |
| `user_id`   | UUID (PK/FK) | Destinatário (`auth.users.id`) ON DELETE CASCADE |
| `shared_by` | UUID (FK)    | Quem compartilhou (`auth.users.id`)          |
| `created_at`| TIMESTAMPTZ  | Data do compartilhamento                     |

> PK composta `(note_id, user_id)`.

#### Tabela `push_subscriptions`
| Coluna         | Tipo         | Descrição                                 |
| -------------- | ------------ | ----------------------------------------- |
| `id`           | UUID (PK)    | Identificador único                       |
| `user_id`      | UUID (FK)    | Referência a `auth.users(id)`             |
| `endpoint`     | TEXT         | URL do push endpoint (UNIQUE)             |
| `p256dh`       | TEXT         | Chave pública do cliente                  |
| `auth`         | TEXT         | Segredo de autenticação                   |
| `created_at`   | TIMESTAMPTZ  | Data de registro                          |

### Objeto JS interno (mapeado de/para DB)

#### Nota
```json
{
    "id": "uuid-v4",
    "title": "Título da nota",
    "content": "<p>Conteúdo HTML rico</p>",
    "group": "Nome do grupo",
    "color": "blue",
    "status": "to-do",
    "reminderAt": "2026-03-17T10:00:00.000Z",
    "createdAt": "2026-03-17T00:00:00.000Z",
    "isShared": false,
    "isSharedCompleted": false
}
```

> **Flags especiais de notas compartilhadas:**
> - `isShared: true` — nota recebida de outro usuário (via `note_shares`)
> - `isSharedCompleted: true` — o criador marcou como concluída (status numa coluna `isDone`)

#### Análise
```json
{
    "id": "uuid-v4",
    "title": "Título da análise",
    "blocks": [
        {
            "id": 1710000000001,
            "content": "<p>Conteúdo HTML do bloco</p>",
            "sideNote": "Anotação lateral do bloco"
        }
    ],
    "createdAt": "2026-03-17T00:00:00.000Z"
}
```

> **Mapeamento DB → JS:** `group_name` → `group`, `created_at` → `createdAt`, `reminder_at` → `reminderAt`. Feito em `state.js` via `mapNoteFromDb()` / `mapAnalysisFromDb()` / `mapColumnFromDb()`.

## Skills da IA para este Projeto

### 1. Autenticação & Sessão
- **O que saber:** Login via Google OAuth gerenciado pelo Supabase Auth. `auth.js` expõe `signInWithGoogle()`, `signOut()`, `requireAuth()`, `getSession()`.
- **Fluxo:** `login.html` verifica sessão → se logado, redireciona para `/`. `index.html` chama `requireAuth()` → se não logado, redireciona para `/login.html`.
- **Regra:** Nunca manipule sessão diretamente. Use as funções de `auth.js`. O listener `onAuthStateChange` cuida de sessão expirada.

### 2. Gerenciamento de Estado (Supabase)
- **O que saber:** `state.js` é o hub de dados. `loadState()` busca notas próprias + compartilhadas + análises + colunas do Supabase. CRUD via `upsertNote()`/`removeNote()`/`upsertAnalysis()`/`removeAnalysis()`/`upsertColumn()`/`removeColumn()`.
- **Migração:** No primeiro login, se há dados no localStorage e o DB está vazio, `migrateLocalStorage()` faz a transferência automática.
- **Compatibilidade:** `saveNotes()`/`saveAnalyses()` existem como no-ops para manter compatibilidade com código que os chama.
- **Shared notes:** `loadState()` busca `note_shares` com `user_id = current`, depois carrega as notas por ID. Marca `isShared: true` e força `status = 'compartilhadas'`. Se o criador concluiu (status em coluna `isDone`), marca `isSharedCompleted: true`.
- **Coluna Compartilhadas:** `ensureSharedColumn()` cria automaticamente a coluna "Compartilhadas" (id: `compartilhadas`, position: 0) quando há notas recebidas.
- **Regra:** Nunca manipule o Supabase diretamente fora de `state.js`. IDs são UUIDs (`crypto.randomUUID()`).

### 3. Rich Text Editor
- **O que saber:** Usa `document.execCommand()` (API legada mas funcional). O editor é um `contenteditable="true"` div.
- **Bug corrigido:** `applyTextColor('foreColor', 'initial')` agora aplica a cor padrão do tema em vez de `removeFormat` que removia toda formatação.
- **Regra:** Sempre usar `event.preventDefault()` no `onmousedown` dos botões da toolbar para manter a seleção ativa no editor.

### 4. Renderização Kanban
- **O que saber:** As colunas são geradas dinamicamente via `setupColumns()`. Cards são criados via DOM API (não innerHTML para segurança).
- **Drag & drop:** Desabilitado para notas compartilhadas (`card.draggable = false`). Drop handler verifica `isShared` e bloqueia com toast de aviso.
- **Regra:** Stats usam `data-stat` attributes em vez de IDs para evitar duplicatas entre desktop e mobile.

### 5. Modais
- **O que saber:** Modais usam classe `.show` para visibilidade (`display: flex`). No mobile ficam fullscreen; modais pequenos (export, resize) preservam design compacto com bordas arredondadas.
- **Modais de amigos:** `#friendsModal` (busca, pendentes, lista), `#shareModal` (picker de amigos para compartilhar nota).
- **Botões condicionais:** Ao visualizar nota compartilhada concluída, botões de editar e compartilhar são escondidos.
- **Regra:** Sempre use `classList.add('show')` / `classList.remove('show')`.

### 6. Temas e Dark Mode
- **O que saber:** 6 temas + dark mode. Variáveis CSS controlam tudo. Temas usam `--bg-light`/`--bg-dark` que podem ser gradientes ou cores sólidas.
- **Regra:** Ao testar dark mode + tema, verificar se ambos interagem corretamente. Dark mode e tema são aplicados antes do render no `<body>` (inline script em `index.html` e `login.html`).

### 7. Export/Import
- **O que saber:** PDF usa jsPDF + html2canvas com lógica de slicing para páginas grandes. JSON export/import manipula arrays de notas/análises. IDs são UUIDs na importação (`crypto.randomUUID()`). Import usa `bulkInsertNotes()`/`bulkInsertAnalyses()` para gravar no Supabase.
- **Regra:** Import files usam `input type="file"` global (fora de containers desktop-only) para funcionar em mobile.

### 8. Análises com Blocos
- **O que saber:** Cada análise tem N blocos rearranjaveis via drag & drop. Blocos têm side notes (anotações laterais). A toolbar de formatação é gerada por bloco.
- **Regra:** `addAnalysisBlock()` aceita content, id e sideNote. A reordenação usa `dragstart/dragover/dragend` no container. Os onclick dos cards usam aspas (`'${analysis.id}'`) porque IDs são UUIDs (strings).

### 9. Responsividade Mobile
- **O que saber:** Breakpoints em 768px (mobile), 1024px (tablet), 380px (small mobile). Mobile usa FAB, collapsibles para stats/filtros, ações rápidas no topo.
- **Pull-to-refresh:** `setupPullToRefresh()` em `app.js` usa touch events. Puxa para baixo no topo da página → recarrega notas do Supabase (inclui compartilhadas). Mostra indicador animado.
- **Regra:** Touch targets mínimo 44px. Toolbars têm scroll horizontal no mobile. Use `dvh` para viewport dinâmico em browsers modernos. O perfil do usuário no mobile esconde o nome e mostra só avatar + botão logout.

### 10. Push Notifications & Lembretes
- **O que saber:** `push.js` gerencia subscription Web Push. `sw.js` (Service Worker v2) recebe push e exibe notificação nativa. `check-reminders.mjs` (Netlify Scheduled Function) roda a cada hora (`0 * * * *`), busca notas com `reminder_at` no passado, envia push via `web-push` e limpa o lembrete.
- **Lembretes in-app:** `checkReminders()` em `app.js` verifica a cada 30s. Usa `Set` local (`shownReminders`) para não repetir notificações já exibidas. Permite snooze (5/15/30/60 min) ou dispensar.
- **Regra:** O client **não** limpa `reminder_at` do DB ao exibir — apenas a Netlify function faz isso após enviar push. Isso evita que o cron perca lembretes.

### 11. Sistema de Amizades & Compartilhamento
- **O que saber:** `friends.js` é o módulo completo. Busca por email (`profiles`), envia/aceita/rejeita pedidos (`friendships`), compartilha notas (`note_shares`).
- **Fluxo de amizade:** Buscar por email → Enviar solicitação → Destinatário aceita/rejeita → Amigos podem compartilhar notas.
- **Queries separadas:** `loadFriends()` e `loadPendingRequests()` usam queries separadas (friendships → profiles por IDs) em vez de JOINs, porque PostgREST não resolve FK para `auth.users`.
- **Perfil automático:** `ensureProfile()` cria/atualiza perfil na tabela `profiles` a cada login. Trigger SQL também cria perfil no signup.

### 12. Comportamento de Notas Compartilhadas
- **Coluna "Compartilhadas":** Criada automaticamente (position 0) quando o destinatário tem notas recebidas. ID fixo: `compartilhadas`.
- **Nota recebida (destinatário):**
  - Sempre fica na coluna "Compartilhadas" — não pode arrastar nem mover
  - Botão ✔️ de concluir não aparece no card
  - Se o criador concluiu: aparece com estilo `completed` (riscada/opaca), edição bloqueada, botões editar/compartilhar escondidos no modal
  - Excluir = remove apenas o vínculo (`note_shares`), nota original permanece para o criador
- **Nota própria (criador):** Funciona normalmente — move, conclui, edita. A nota continua visível para ele independente do que o destinatário faz.

## Segurança

### Row Level Security (RLS)
- **Todas as tabelas** têm RLS habilitado (`notes`, `analyses`, `columns`, `profiles`, `friendships`, `note_shares`, `push_subscriptions`)
- **Políticas granulares:** SELECT, INSERT, UPDATE, DELETE — cada uma verifica `auth.uid() = user_id`
- **ON DELETE CASCADE:** Se o usuário deletar sua conta, todos os dados são removidos automaticamente
- **Notas compartilhadas:** Política adicional em `notes` permite SELECT/UPDATE se o `note_id` está em `note_shares` do usuário
- **Perfis públicos:** `profiles` tem SELECT aberto para autenticados (necessário para busca de amigos)
- **Friendships:** Qualquer participante pode ler/deletar; só requester insere; só addressee aceita

### Headers HTTP (Netlify)
- `X-Frame-Options: DENY` — previne clickjacking
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — restringe APIs sensíveis
- `X-XSS-Protection: 1; mode=block`
- `Service-Worker-Allowed: /` — header específico para `sw.js`

### Chaves e Credenciais
- A **anon key** no `supabase.js` é pública por design. A proteção real vem das políticas RLS no servidor
- **Nunca** use a `service_role` key no frontend
- **VAPID keys** para Web Push devem estar em variáveis de ambiente do Netlify (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`)

## Convenções de Código

1. **ES Modules:** Todos os JS usam `import`/`export`. O HTML carrega `app.js` com `type="module"`.
2. **Window globals:** Funções chamadas via `onclick` no HTML são registradas em `window.*` no `app.js`. `friends.js` usa `registerFriendsGlobals()`.
3. **CSS organizado por responsabilidade:** Cada arquivo CSS tem um propósito claro.
4. **Sem framework de build:** Nenhum bundler, transpiler. Supabase é carregado via CDN ESM. `package.json` existe apenas para a Netlify function (`web-push`).
5. **Supabase como única persistência:** Dados salvos no PostgreSQL via RLS. localStorage usado apenas para preferências de tema.
6. **UUIDs como identificadores:** Notas e análises usam `crypto.randomUUID()`. Blocos internos de análise ainda usam `Date.now()`.
7. **Async/await:** Inicialização e CRUD são assíncronos. `app.js` usa `async DOMContentLoaded`.
8. **Toast feedback:** Todas as operações de usuário mostram toast via `showToast()` com XSS-safe `escapeHtml()`.
9. **Queries separadas vs JOINs:** Para tabelas com FK em `auth.users`, usar queries separadas (buscar IDs → buscar `profiles` por IDs) porque PostgREST não resolve JOINs com `auth.users`.

## Limitações Conhecidas

- `document.execCommand()` está deprecated mas sem substituto real para rich text inline.
- Imagens são armazenadas como base64 no campo `content` do Supabase (texto). Para arquivos grandes, considerar Supabase Storage.
- Sem teste automatizado (candidato para adição futura).
- Side notes dos blocos de análise são armazenados no JSONB (campo `blocks`), não em tabela separada.
- Notas compartilhadas não atualizam em tempo real — destinatário precisa fazer pull-to-refresh ou recarregar a página.
- O status `compartilhadas` é forçado no client (override em `loadState`), não no banco. A nota real mantém o status do criador no DB.

## Histórico de Versões

| Commit    | Descrição                                                  |
| --------- | ---------------------------------------------------------- |
| `52f74b1` | Notas compartilhadas concluídas ficam read-only            |
| `bf34835` | Notas compartilhadas fixas na coluna Compartilhadas        |
| `cf3ef26` | Pull-to-refresh no mobile                                  |
| `cb00837` | Fix friendships 400 — queries separadas em vez de JOINs    |
| `002a770` | Sistema de amigos e compartilhamento de notas              |
| `25d3cc8` | Fix cron 1h, feedback erro upsert, SW v2                   |
| `9247c33` | Fix push externo — não limpar reminder_at no client        |
| `7133ced` | Push.js com suporte Median nativo + toasts debug           |
| `16e361b` | Snooze de lembretes + debug push subscription              |
| `85da43c` | Netlify Scheduled Function para push reminders             |
| `76ffe99` | Push notifications reais (Web Push + SW)                   |
| `10f1f58` | Fix fallback OAuth redirect + session listener             |
