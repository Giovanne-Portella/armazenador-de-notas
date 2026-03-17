# Contexto de IA — Armazenador de Notas

## Visão Geral do Projeto

Aplicação web para gerenciamento de notas e análises em formato Kanban. Desenvolvida em HTML5, CSS3 e JavaScript puro (ES Modules). Autenticação via Google OAuth (Supabase Auth). Dados persistidos no PostgreSQL via Supabase com Row Level Security (RLS). Hospedada no Netlify via deploy automático do GitHub.

**URL de produção:** `https://salvar-notas.netlify.app`

## Stack Técnica

| Camada         | Tecnologia                                         |
| -------------- | -------------------------------------------------- |
| Linguagem      | JavaScript ES2020+ (ES Modules)                    |
| Markup         | HTML5 semântico                                    |
| Estilo         | CSS3 com Custom Properties (variáveis)             |
| Backend/DB     | Supabase (PostgreSQL + Auth + RLS)                 |
| Autenticação   | Google OAuth 2.0 via Supabase Auth                 |
| PDF            | jsPDF 2.5.1 + html2canvas 1.4.1                   |
| Deploy         | Netlify (auto-deploy via GitHub, sem build step)   |
| Segurança      | RLS por usuário, headers HTTP, CHECK constraints   |

## Arquitetura Modular

```
login.html          ← Página de login (Google OAuth)
index.html          ← App principal (protegido por auth)
_headers            ← Headers de segurança HTTP (Netlify)
├── css/
│   ├── variables.css   ← Variáveis CSS e temas (cores, gradientes)
│   ├── base.css        ← Reset, tipografia, botões, animações
│   ├── layout.css      ← Header, loading, perfil, colunas Kanban, stats
│   ├── components.css  ← Cards de nota, paletas de cor, análises
│   ├── editor.css      ← Toolbar rich text, blocos, PDF export
│   ├── modal.css       ← Modal base e variantes
│   ├── login.css       ← Página de login (glassmorphism, dark mode)
│   └── responsive.css  ← Breakpoints mobile (768px), tablet, small
├── js/
│   ├── supabase.js     ← Client Supabase (URL + anon key)
│   ├── auth.js         ← Google OAuth login/logout, session management
│   ├── app.js          ← Entry point, auth check, bindings, init
│   ├── state.js        ← Estado centralizado, CRUD Supabase, migração localStorage
│   ├── notes.js        ← CRUD de notas (UUID), visualização, compartilhamento
│   ├── editor.js       ← Rich text (formatação, cores, imagens, resize)
│   ├── render.js       ← Renderização de colunas, stats, filtros
│   ├── theme.js        ← Dark mode e seleção de temas
│   ├── export.js       ← Exportação PDF/JSON de notas e análises
│   ├── analysis.js     ← CRUD de análises (UUID), blocos, side notes
│   └── utils.js        ← Constantes, paleta de cores, helpers
└── docs/
    ├── AI_CONTEXT.md       ← Este arquivo
    ├── SUPABASE_SETUP.md   ← Guia completo de configuração Supabase
    └── MODULARIZATION.md   ← Histórico de modularização
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
| `status`     | TEXT         | Coluna Kanban (CHECK constraint)             |
| `created_at` | TIMESTAMPTZ  | Data de criação                              |
| `updated_at` | TIMESTAMPTZ  | Auto-atualizado via trigger                  |

**Cores disponíveis:** `blue`, `green`, `red`, `yellow`, `orange`, `purple`, `pink`, `cyan`, `lime`, `indigo`, `gray`

**Status (colunas Kanban):** `notes`, `to-do`, `in-progress`, `impediment`, `agenda`, `completed`

#### Tabela `analyses`
| Coluna       | Tipo         | Descrição                                    |
| ------------ | ------------ | -------------------------------------------- |
| `id`         | UUID (PK)    | Identificador único                          |
| `user_id`    | UUID (FK)    | Referência a `auth.users(id)` ON DELETE CASCADE |
| `title`      | TEXT         | Título da análise (obrigatório)              |
| `blocks`     | JSONB        | Array de blocos `[{id, content, sideNote}]`  |
| `created_at` | TIMESTAMPTZ  | Data de criação                              |
| `updated_at` | TIMESTAMPTZ  | Auto-atualizado via trigger                  |

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
    "createdAt": "2026-03-17T00:00:00.000Z"
}
```

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

> **Mapeamento DB → JS:** `group_name` → `group`, `created_at` → `createdAt`. Feito em `state.js` via `mapNoteFromDb()` / `mapAnalysisFromDb()`.

## Skills da IA para este Projeto

### 1. Autenticação & Sessão
- **O que saber:** Login via Google OAuth gerenciado pelo Supabase Auth. `auth.js` expõe `signInWithGoogle()`, `signOut()`, `requireAuth()`, `getSession()`.
- **Fluxo:** `login.html` verifica sessão → se logado, redireciona para `/`. `index.html` chama `requireAuth()` → se não logado, redireciona para `/login.html`.
- **Regra:** Nunca manipule sessão diretamente. Use as funções de `auth.js`. O listener `onAuthStateChange` cuida de sessão expirada.

### 2. Gerenciamento de Estado (Supabase)
- **O que saber:** `state.js` é o hub de dados. `loadState()` busca do Supabase, `upsertNote()`/`removeNote()`/`upsertAnalysis()`/`removeAnalysis()` fazem CRUD no banco.
- **Migração:** No primeiro login, se há dados no localStorage e o DB está vazio, `migrateLocalStorage()` faz a transferência automática.
- **Compatibilidade:** `saveNotes()`/`saveAnalyses()` existem como no-ops para manter compatibilidade com código que os chama.
- **Regra:** Nunca manipule o Supabase diretamente fora de `state.js`. IDs são UUIDs (`crypto.randomUUID()`).

### 3. Rich Text Editor
- **O que saber:** Usa `document.execCommand()` (API legada mas funcional). O editor é um `contenteditable="true"` div.
- **Bug corrigido:** `applyTextColor('foreColor', 'initial')` agora aplica a cor padrão do tema em vez de `removeFormat` que removia toda formatação.
- **Regra:** Sempre usar `event.preventDefault()` no `onmousedown` dos botões da toolbar para manter a seleção ativa no editor.

### 4. Renderização Kanban
- **O que saber:** As colunas são geradas dinamicamente via `setupColumns()`. Cards são criados via DOM API (não innerHTML para segurança).
- **Regra:** Stats usam `data-stat` attributes em vez de IDs para evitar duplicatas entre desktop e mobile.

### 5. Modais
- **O que saber:** Modais usam classe `.show` para visibilidade (`display: flex`). No mobile ficam fullscreen; modais pequenos (export, resize) preservam design compacto com bordas arredondadas.
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
- **Regra:** Touch targets mínimo 44px. Toolbars têm scroll horizontal no mobile. Use `dvh` para viewport dinâmico em browsers modernos. O perfil do usuário no mobile esconde o nome e mostra só avatar + botão logout.

## Segurança

### Row Level Security (RLS)
- **Todas as tabelas** têm RLS habilitado
- **Políticas granulares:** SELECT, INSERT, UPDATE, DELETE — cada uma verifica `auth.uid() = user_id`
- **ON DELETE CASCADE:** Se o usuário deletar sua conta, todos os dados são removidos automaticamente

### Headers HTTP (Netlify)
- `X-Frame-Options: DENY` — previne clickjacking
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — restringe APIs sensíveis
- `X-XSS-Protection: 1; mode=block`

### Chaves e Credenciais
- A **anon key** no `supabase.js` é pública por design. A proteção real vem das políticas RLS no servidor
- **Nunca** use a `service_role` key no frontend
- CHECK constraints validam valores de `status` no banco

## Convenções de Código

1. **ES Modules:** Todos os JS usam `import`/`export`. O HTML carrega `app.js` com `type="module"`.
2. **Window globals:** Funções chamadas via `onclick` no HTML são registradas em `window.*` no `app.js`.
3. **CSS organizado por responsabilidade:** Cada arquivo CSS tem um propósito claro.
4. **Sem framework de build:** Nenhum bundler, transpiler ou npm. Supabase é carregado via CDN ESM.
5. **Supabase como única persistência:** Dados salvos no PostgreSQL via RLS. localStorage usado apenas para preferências de tema.
6. **UUIDs como identificadores:** Notas e análises usam `crypto.randomUUID()`. Blocos internos de análise ainda usam `Date.now()`.
7. **Async/await:** Inicialização e CRUD são assíncronos. `app.js` usa `async DOMContentLoaded`.

## Limitações Conhecidas

- `document.execCommand()` está deprecated mas sem substituto real para rich text inline.
- Imagens são armazenadas como base64 no campo `content` do Supabase (texto). Para arquivos grandes, considerar Supabase Storage.
- Sem teste automatizado (candidato para adição futura).
- Side notes dos blocos de análise são armazenados no JSONB (campo `blocks`), não em tabela separada.
