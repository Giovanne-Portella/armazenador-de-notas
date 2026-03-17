# Modularização & Próximos Passos — Armazenador de Notas

## Resumo da Refatoração Realizada

### De → Para

| Antes (Monolito)                         | Depois (Modular)                           |
| ---------------------------------------- | ------------------------------------------ |
| 1 arquivo `index.html` com ~3128 linhas  | 1 HTML limpo + 7 CSS + 9 JS = 17 arquivos |
| CSS embutido no `<style>` (~1380 linhas) | 7 arquivos CSS organizados por função      |
| JS embutido no `<script>` (~1100 linhas) | 9 módulos ES Module com imports/exports    |
| Funções globais no escopo window         | Módulos com exports explícitos             |
| IDs duplicados (stats desktop/mobile)    | `data-stat` attributes sem duplicatas      |

### Estrutura Final

```
armazenador-de-notas/
├── index.html              ← HTML estrutural (~280 linhas)
├── index.html.bak          ← Backup do monolito original
├── favicon.png
├── css/
│   ├── variables.css       ← Variáveis e temas de cor
│   ├── base.css            ← Reset, tipografia, botões
│   ├── layout.css          ← Header, colunas, stats, controles
│   ├── components.css      ← Cards, paletas, análises
│   ├── editor.css          ← Toolbar, rich editor, blocos
│   ├── modal.css           ← Modal base e z-index
│   └── responsive.css      ← Mobile, tablet, small breakpoints
├── js/
│   ├── app.js              ← Entry point e inicialização
│   ├── state.js            ← Estado centralizado + localStorage
│   ├── notes.js            ← CRUD de notas
│   ├── editor.js           ← Rich text formatting
│   ├── render.js           ← Renderização Kanban
│   ├── theme.js            ← Dark mode e temas
│   ├── export.js           ← Export/Import PDF e JSON
│   ├── analysis.js         ← CRUD de análises e blocos
│   └── utils.js            ← Constantes e helpers
└── docs/
    ├── AI_CONTEXT.md       ← Contexto para assistentes IA
    └── MODULARIZATION.md   ← Este documento
```

### Bugs Corrigidos

| # | Bug                                             | Correção                                                         |
|---|-------------------------------------------------|------------------------------------------------------------------|
| 1 | `applyTextColor('initial')` usava `removeFormat` removendo toda formatação | Agora aplica foreColor com `#000000` ou `#ffffff` conforme o tema |
| 2 | IDs duplicados nos stats desktop/mobile          | Substituído por `data-stat` attributes com `querySelectorAll`    |
| 3 | Import JSON não funcionava no mobile             | `<input id="importFile">` movido para fora do container `desktop-only` |
| 4 | CSS duplicado para dark-mode note-card colors    | Unificado em `components.css` sem duplicatas                      |

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
   - Cobrir: CRUD de notas, drag & drop, import/export, dark mode
   - Garantir que refatoração não quebrou funcionalidades

2. **PWA (Progressive Web App)**
   - Adicionar `manifest.json` com ícones e splash
   - Implementar Service Worker para cache offline
   - Permitir instalação como app nativo no mobile

3. **Migrar document.execCommand()**
   - Substituir por [Input Events Level 2](https://www.w3.org/TR/input-events-2/) ou lib como TipTap/ProseMirror
   - `document.execCommand()` está deprecated e comportamento varia entre browsers

### Prioridade Média

4. **Sincronização de Dados**
   - Opção de sync via Firebase/Supabase (mantendo offline-first)
   - Conflict resolution para multi-device
   - Export automático periódico (JSON backup)

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

8. **Limitar Armazenamento de Imagens**
   - Comprimir imagens antes de armazenar (canvas resize)
   - Alerta quando localStorage está perto do limite
   - Opção de armazenar imagens externamente (link URL)

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
3. Registrar funções necessárias em `window.*` para uso em HTML onclick
4. Documentar em `docs/AI_CONTEXT.md`

### Adicionar novo CSS
1. Criar `css/novo-estilo.css`
2. Linkar em `index.html` na ordem correta (variáveis → base → específico → responsive)

### Convencões
- Funções públicas: `export function nomeFuncao()`
- Estado: sempre via `state.js`
- Persistência: sempre via `saveNotes()` / `saveAnalyses()`
- HTML dinâmico: prefira DOM API sobre innerHTML quando possível (segurança)
