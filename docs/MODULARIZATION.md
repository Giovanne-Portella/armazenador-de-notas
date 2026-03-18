# Modularização & Próximos Passos — Armazenador de Notas

## Resumo da Refatoração Realizada

### De → Para

| Antes (Monolito)                         | Depois (Modular)                            |
| ---------------------------------------- | ------------------------------------------- |
| 1 arquivo `index.html` com ~3128 linhas  | 1 HTML limpo + 8 CSS + 13 JS = 22 arquivos |
| CSS embutido no `<style>` (~1380 linhas) | 8 arquivos CSS organizados por função       |
| JS embutido no `<script>` (~1100 linhas) | 13 módulos ES Module com imports/exports    |
| Funções globais no escopo window         | Módulos com exports explícitos              |
| IDs duplicados (stats desktop/mobile)    | `data-stat` attributes sem duplicatas       |
| localStorage como persistência           | Supabase PostgreSQL + RLS                   |

### Estrutura Final

```
armazenador-de-notas/
├── index.html              ← HTML estrutural (~350 linhas)
├── login.html              ← Página de login Google OAuth
├── _headers                ← Headers de segurança HTTP (Netlify)
├── netlify.toml            ← Config build, functions, cron
├── sw.js                   ← Service Worker (push + cache v2)
├── package.json            ← Deps: web-push, @supabase/supabase-js
├── css/
│   ├── variables.css       ← Variáveis e temas de cor
│   ├── base.css            ← Reset, tipografia, botões
│   ├── layout.css          ← Header, colunas, stats, controles
│   ├── components.css      ← Cards, paletas, análises, amigos, pull-refresh
│   ├── editor.css          ← Toolbar, rich editor, blocos
│   ├── modal.css           ← Modal base e z-index
│   ├── login.css           ← Login page (glassmorphism)
│   └── responsive.css      ← Mobile, tablet, small breakpoints
├── js/
│   ├── supabase.js         ← Client Supabase (URL + anon key)
│   ├── auth.js             ← Google OAuth login/logout, session
│   ├── app.js              ← Entry point, init, pull-to-refresh
│   ├── state.js            ← Estado centralizado + CRUD Supabase + shared notes
│   ├── notes.js            ← CRUD de notas (UUID), visualização
│   ├── editor.js           ← Rich text formatting
│   ├── render.js           ← Renderização Kanban, drag & drop
│   ├── theme.js            ← Dark mode e temas
│   ├── export.js           ← Export/Import PDF e JSON
│   ├── analysis.js         ← CRUD de análises e blocos
│   ├── friends.js          ← Amizades, compartilhamento, modais
│   ├── push.js             ← Web Push subscription e permissão
│   └── utils.js            ← Constantes e helpers
├── netlify/
│   └── functions/
│       └── check-reminders.mjs  ← Scheduled function (cron 1h)
└── docs/
    ├── AI_CONTEXT.md        ← Contexto para assistentes IA
    ├── SUPABASE_SETUP.md    ← Guia de configuração Supabase
    ├── MODULARIZATION.md    ← Este documento
    └── FRIENDS_MIGRATION.sql← SQL migração (profiles, friendships, shares)
```

### Bugs Corrigidos

| # | Bug                                             | Correção                                                         |
|---|-------------------------------------------------|------------------------------------------------------------------|
| 1 | `applyTextColor('initial')` usava `removeFormat` removendo toda formatação | Agora aplica foreColor com `#000000` ou `#ffffff` conforme o tema |
| 2 | IDs duplicados nos stats desktop/mobile          | Substituído por `data-stat` attributes com `querySelectorAll`    |
| 3 | Import JSON não funcionava no mobile             | `<input id="importFile">` movido para fora do container `desktop-only` |
| 4 | CSS duplicado para dark-mode note-card colors    | Unificado em `components.css` sem duplicatas                      |
| 5 | Push notifications não salvavam no DB            | `checkReminders()` parou de limpar `reminder_at` do DB           |
| 6 | Cron Netlify rodava a cada minuto                | Alterado de `* * * * *` para `0 * * * *` (cada hora)            |
| 7 | Friendships 400 Bad Request (PostgREST JOIN)     | Substituído JOINs por queries separadas (friendships → profiles) |
| 8 | Notas compartilhadas sumiam ao mover             | Forçar status `compartilhadas` para destinatário                  |

### Funcionalidades Adicionadas

| # | Feature                                   | Módulo(s)                    | Commit    |
|---|-------------------------------------------|------------------------------|-----------|
| 1 | Colunas Kanban customizáveis              | `state.js`, `render.js`, `app.js` | —    |
| 2 | Lembretes com push notification nativa    | `push.js`, `sw.js`, `check-reminders.mjs` | `76ffe99` |
| 3 | Snooze de lembretes (5/15/30/60 min)      | `app.js`                     | `16e361b` |
| 4 | Sistema de amigos (busca, add, aceitar)   | `friends.js`                 | `002a770` |
| 5 | Compartilhamento de notas com amigos      | `friends.js`, `state.js`     | `002a770` |
| 6 | Coluna "Compartilhadas" auto-criada       | `state.js`                   | `bf34835` |
| 7 | Notas compartilhadas read-only quando concluídas | `notes.js`, `render.js`, `state.js` | `52f74b1` |
| 8 | Excluir nota compartilhada = desvincular  | `notes.js`                   | `52f74b1` |
| 9 | Pull-to-refresh no mobile                 | `app.js`, `components.css`   | `cf3ef26` |
| 10| Toast de feedback com escapeHtml (XSS-safe) | `utils.js`                 | —         |
| 11| Suporte Median.co OAuth fallback          | `auth.js`                    | `10f1f58` |

### Melhorias de Responsividade Mobile

- **Touch targets:** Mínimo 44px para todos os botões e interativos
- **Modais:** Fullscreen em mobile com `100dvh`; modais pequenos (export, resize) mantêm design compacto
- **Toolbar:** Scroll horizontal com `-webkit-overflow-scrolling: touch`
- **FAB:** Botão flutuante para criar nota com feedback tátil (`transform: scale`)
- **Collapsibles:** Stats e filtros em seções expansíveis no mobile
- **Breakpoint adicional:** 380px para telas muito pequenas
- **Botões ações no mobile:** `:active` em vez de `:hover` para touch

---

## Próximos Passos

### Prioridade Alta

1. **Testes End-to-End**
   - Implementar testes com Playwright ou Cypress
   - Cobrir: CRUD de notas, drag & drop, import/export, dark mode, friends, sharing
   - Garantir que refatoração não quebrou funcionalidades

2. **PWA (Progressive Web App)**
   - Adicionar `manifest.json` com ícones e splash
   - Expandir Service Worker para cache offline de assets
   - Permitir instalação como app nativo no mobile

3. **Migrar document.execCommand()**
   - Substituir por [Input Events Level 2](https://www.w3.org/TR/input-events-2/) ou lib como TipTap/ProseMirror
   - `document.execCommand()` está deprecated e comportamento varia entre browsers

### Prioridade Média

4. **Realtime para notas compartilhadas**
   - Usar Supabase Realtime (websocket) para atualização instantânea
   - Atualmente depende de pull-to-refresh manual

5. **Pesquisa Avançada**
   - Busca full-text dentro do conteúdo HTML das notas
   - Filtros combinados (grupo + status + keyword)
   - Ordenação por data, título, grupo

6. **Undo/Redo Global**
   - Stack de ações para desfazer operações (delete, move, edit)
   - Atalhos de teclado (Ctrl+Z, Ctrl+Y)

7. **Acessibilidade (a11y)**
   - ARIA labels em todos os botões com emoji
   - Navegação por teclado nos cards e modais
   - Focus trap nos modais abertos
   - Suporte a screen readers

### Prioridade Baixa

8. **Supabase Storage para imagens**
   - Migrar imagens de base64 inline para Supabase Storage
   - Reduz tamanho do campo `content` e melhora performance

9. **Markdown Support**
   - Toggle entre rich text e Markdown nos editores
   - Preview de Markdown em tempo real

10. **Tags e Labels**
    - Sistema de tags além de grupos
    - Autocompletar de tags existentes
    - Filtro por múltiplas tags

11. **Dashboard de Produtividade**
    - Gráficos de notas criadas/completadas por período
    - Métricas de tempo médio em cada coluna
    - Heatmap de atividade

12. **Tema customizável**
    - Color picker para criar temas personalizados
    - Salvar tema custom no localStorage

---

## Guia de Contribuição

### Adicionar novo módulo JS
1. Criar `js/novo-modulo.js` com exports
2. Importar em `js/app.js`
3. Registrar funções necessárias em `window.*` para uso em HTML onclick (ou usar `registerXGlobals()`)
4. Documentar em `docs/AI_CONTEXT.md`

### Adicionar novo CSS
1. Criar `css/novo-estilo.css`
2. Linkar em `index.html` na ordem correta (variáveis → base → específico → responsive)

### Adicionar nova tabela Supabase
1. Criar SQL de migração em `docs/FRIENDS_MIGRATION.sql` (ou novo arquivo)
2. Incluir RLS policies + índices + cascade
3. Atualizar `docs/SUPABASE_SETUP.md` e `docs/AI_CONTEXT.md`
4. Criar funções CRUD em `state.js` ou módulo específico

### Convenções
- Funções públicas: `export function nomeFuncao()`
- Estado: sempre via `state.js`
- Persistência: CRUD via funções exportadas de `state.js` (`upsertNote`, `removeNote`, etc.)
- HTML dinâmico: prefira DOM API sobre innerHTML quando possível (segurança)
- Queries PostgREST: usar queries separadas para FK em `auth.users` (não resolve JOIN)
- Feedback: sempre usar `showToast()` para informar o usuário
