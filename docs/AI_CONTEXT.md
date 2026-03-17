# Contexto de IA — Armazenador de Notas

## Visão Geral do Projeto

Aplicação web client-side (sem backend) para gerenciamento de notas e análises em formato Kanban. Desenvolvida em HTML5, CSS3 e JavaScript puro (ES Modules). Dados persistidos via `localStorage`.

## Stack Técnica

| Camada       | Tecnologia                              |
| ------------ | --------------------------------------- |
| Linguagem    | JavaScript ES2020+ (ES Modules)         |
| Markup       | HTML5 semântico                         |
| Estilo       | CSS3 com Custom Properties (variáveis)  |
| Persistência | localStorage (JSON)                     |
| PDF          | jsPDF 2.5.1 + html2canvas 1.4.1        |
| Deploy       | Arquivo estático (sem build step)       |

## Arquitetura Modular

```
index.html          ← HTML estrutural limpo (sem CSS/JS inline)
├── css/
│   ├── variables.css   ← Variáveis CSS e temas (cores, gradientes)
│   ├── base.css        ← Reset, tipografia, botões, animações
│   ├── layout.css      ← Header, controles, colunas Kanban, stats
│   ├── components.css  ← Cards de nota, paletas de cor, análises
│   ├── editor.css      ← Toolbar rich text, blocos, PDF export
│   ├── modal.css       ← Modal base e variantes
│   └── responsive.css  ← Breakpoints mobile (768px), tablet, small
└── js/
    ├── app.js          ← Entry point, bindings globais, inicialização
    ├── state.js        ← Estado centralizado (notes, analyses, localStorage)
    ├── notes.js        ← CRUD de notas, visualização, compartilhamento
    ├── editor.js       ← Rich text (formatação, cores, imagens, resize)
    ├── render.js       ← Renderização de colunas, stats, filtros
    ├── theme.js        ← Dark mode e seleção de temas
    ├── export.js       ← Exportação PDF/JSON de notas e análises
    ├── analysis.js     ← CRUD de análises, blocos, side notes
    └── utils.js        ← Constantes, paleta de cores, helpers
```

## Modelo de Dados

### Nota
```json
{
    "id": 1710000000000,
    "title": "Título da nota",
    "content": "<p>Conteúdo HTML rico</p>",
    "group": "Nome do grupo",
    "color": "blue",
    "status": "to-do",
    "createdAt": "2026-03-17T00:00:00.000Z"
}
```

**Cores disponíveis:** `blue`, `green`, `red`, `yellow`, `orange`, `purple`, `pink`, `cyan`, `lime`, `indigo`, `gray`

**Status (colunas Kanban):** `notes`, `to-do`, `in-progress`, `impediment`, `agenda`, `completed`

### Análise
```json
{
    "id": 1710000000000,
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

## Skills da IA para este Projeto

### 1. Gerenciamento de Estado
- **O que saber:** Todo estado fica em `state.js` como objeto singleton. `loadState()` lê do localStorage, `saveNotes()`/`saveAnalyses()` persistem.
- **Regra:** Nunca manipule localStorage diretamente fora de `state.js`.

### 2. Rich Text Editor
- **O que saber:** Usa `document.execCommand()` (API legada mas funcional). O editor é um `contenteditable="true"` div.
- **Bug corrigido:** `applyTextColor('foreColor', 'initial')` agora aplica a cor padrão do tema em vez de `removeFormat` que removia toda formatação.
- **Regra:** Sempre usar `event.preventDefault()` no `onmousedown` dos botões da toolbar para manter a seleção ativa no editor.

### 3. Renderização Kanban
- **O que saber:** As colunas são geradas dinamicamente via `setupColumns()`. Cards são criados via DOM API (não innerHTML para segurança).
- **Regra:** Stats usam `data-stat` attributes em vez de IDs para evitar duplicatas entre desktop e mobile.

### 4. Modais
- **O que saber:** Modais usam classe `.show` para visibilidade (`display: flex`). No mobile ficam fullscreen; modais pequenos (export, resize) preservam design compacto com bordas arredondadas.
- **Regra:** Sempre use `classList.add('show')` / `classList.remove('show')`.

### 5. Temas e Dark Mode
- **O que saber:** 6 temas + dark mode. Variáveis CSS controlam tudo. Temas usam `--bg-light`/`--bg-dark` que podem ser gradientes ou cores sólidas.
- **Regra:** Ao testar dark mode + tema, verificar se ambos interagem corretamente.

### 6. Export/Import
- **O que saber:** PDF usa jsPDF + html2canvas com lógica de slicing para páginas grandes. JSON export/import manipula arrays de notas/análises. IDs são resolvidos para evitar conflitos na importação.
- **Regra:** Import files usam `input type="file"` global (fora de containers desktop-only) para funcionar em mobile.

### 7. Análises com Blocos
- **O que saber:** Cada análise tem N blocos rearranjaveis via drag & drop. Blocos têm side notes (anotações laterais). A toolbar de formatação é gerada por bloco.
- **Regra:** `addAnalysisBlock()` aceita content, id e sideNote. A reordenação usa `dragstart/dragover/dragend` no container.

### 8. Responsividade Mobile
- **O que saber:** Breakpoints em 768px (mobile), 1024px (tablet), 380px (small mobile). Mobile usa FAB, collapsibles para stats/filtros, ações rápidas no topo.
- **Regra:** Touch targets mínimo 44px. Toolbars têm scroll horizontal no mobile. Use `dvh` para viewport dinâmico em browsers modernos.

## Convenções de Código

1. **ES Modules:** Todos os JS usam `import`/`export`. O HTML carrega `app.js` com `type="module"`.
2. **Window globals:** Funções chamadas via `onclick` no HTML são registradas em `window.*` no `app.js`.
3. **CSS organizado por responsabilidade:** Cada arquivo CSS tem um propósito claro.
4. **Sem framework de build:** Nenhum bundler, transpiler ou npm. Funciona diretamente em browsers modernos.
5. **LocalStorage como única persistência:** Sem API backend, sem banco de dados.

## Limitações Conhecidas

- `document.execCommand()` está deprecated mas sem substituto real para rich text inline.
- Imagens são armazenadas como base64 no localStorage (limite de ~5-10MB por origin).
- Sem autenticação/autorização — dados locais somente.
- Sem teste automatizado (candidato para adição futura).
