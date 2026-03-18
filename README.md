# 📋 Armazenador de Notas

Aplicação web Kanban para gerenciamento de notas e análises com mapa mental interativo, compartilhamento entre amigos, push notifications e exportação PDF.

🔗 **Acesse agora:** [salvar-notas.netlify.app](https://salvar-notas.netlify.app)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)

---

## ✨ Funcionalidades

- **Kanban com colunas customizáveis** — Crie, edite, reordene e delete colunas livremente
- **Rich Text Editor** — Formatação de texto, cores, imagens com resize inline
- **6 temas + Dark Mode** — Glassmorphism, gradientes e personalização visual
- **Análises com blocos** — Documentos com blocos rearranjaveis e anotações laterais
- **Mapa Mental interativo** — Canvas SVG infinito com pan/zoom, nós, conexões bezier, vínculos com notas/análises e exportação PDF Full HD
- **Push Notifications** — Lembretes nativos com snooze (5/15/30/60 min)
- **Sistema de amigos** — Busca por email, envio/aceite de solicitações
- **Compartilhamento de notas** — Compartilhe notas com amigos para visualização colaborativa
- **Exportação PDF e JSON** — Relatórios formatados e backup/restore completo
- **Cache stale-while-revalidate** — sessionStorage com TTL 2min reduz requisições em navegação e reload
- **Pull-to-refresh** — Atualização de notas no mobile com gesto nativo
- **Responsivo** — Funciona em desktop, tablet e mobile (breakpoints 768px / 380px)
- **Login com Google** — Autenticação segura via OAuth 2.0

## 📸 Preview

| Desktop | Mobile |
|---------|--------|
| Kanban com drag & drop, stats e filtros | FAB, collapsibles, touch-friendly |

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript ES Modules |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS) |
| Autenticação | Google OAuth 2.0 via Supabase |
| Push | Web Push API + Service Worker |
| PDF (notas) | jsPDF + html2canvas |
| PDF (mapa mental) | jsPDF + SVG standalone (canvas 2x) |
| Deploy | Netlify (auto-deploy via GitHub) |

## 🚀 Como rodar localmente

### Pré-requisitos

- Um projeto no [Supabase](https://supabase.com) com Google OAuth configurado
- [Node.js](https://nodejs.org) (apenas para a Netlify Function de push)
- Um servidor HTTP local (Live Server, http-server, etc.)

### 1. Clone o repositório

```bash
git clone https://github.com/Giovanne-Portella/armazenador-de-notas.git
cd armazenador-de-notas
```

### 2. Configure o Supabase

Crie as tabelas executando os scripts SQL no Supabase Dashboard:

```bash
# Tabelas base (notes, analyses, columns, push_subscriptions)
# → Copie o SQL de docs/SUPABASE_SETUP.md e execute no SQL Editor

# Sistema de amigos (profiles, friendships, note_shares)  
# → Copie o SQL de docs/FRIENDS_MIGRATION.sql e execute no SQL Editor
```

### 3. Configure as credenciais

Edite `js/supabase.js` com suas credenciais do Supabase:

```js
const SUPABASE_URL = 'https://SEU-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key-aqui';
```

### 4. Configure o Google OAuth

1. Crie um OAuth Client ID no [Google Cloud Console](https://console.cloud.google.com)
2. Adicione a redirect URI do Supabase: `https://SEU-PROJECT.supabase.co/auth/v1/callback`
3. Cole o Client ID e Secret no Supabase Dashboard → Authentication → Providers → Google

> Guia completo em [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)

### 5. Instale dependências (para push notifications)

```bash
npm install
```

### 6. Inicie o servidor local

```bash
# Com VS Code Live Server, Python ou qualquer servidor HTTP:
npx serve .
# ou
python -m http.server 5500
```

Acesse `http://localhost:5500` e faça login com Google.

### 7. Deploy no Netlify (opcional)

```bash
# Faça push para o GitHub — o Netlify faz deploy automático
git push origin main
```

Configure as variáveis de ambiente no Netlify para push notifications:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📁 Estrutura do Projeto

```
├── index.html              ← App principal (Kanban)
├── mindmap.html            ← App de mapa mental (canvas SVG)
├── login.html              ← Login Google OAuth
├── sw.js                   ← Service Worker (push + cache)
├── css/                    ← 9 arquivos CSS organizados
│   ├── variables.css       ← Temas e variáveis
│   ├── mindmap.css         ← Estilos do mapa mental
│   ├── components.css      ← Cards, amigos, pull-refresh
│   └── responsive.css      ← Breakpoints mobile
├── js/                     ← 15 módulos ES Module
│   ├── app.js              ← Entry point e inicialização
│   ├── state.js            ← Estado + CRUD Supabase + SWR
│   ├── cache.js            ← Cache stale-while-revalidate (sessionStorage)
│   ├── mindmap.js          ← Motor do mapa mental (SVG, CRUD, PDF export)
│   ├── friends.js          ← Amizades e compartilhamento
│   ├── push.js             ← Web Push subscription
│   └── ...
├── netlify/functions/
│   └── check-reminders.mjs ← Cron (1h) para push reminders
└── docs/
    ├── AI_CONTEXT.md           ← Contexto completo para IA
    ├── SUPABASE_SETUP.md       ← Guia de configuração
    ├── MODULARIZATION.md       ← Histórico e roadmap
    ├── FRIENDS_MIGRATION.sql   ← SQL do sistema de amigos
    └── MINDMAP_MIGRATION.sql   ← SQL da tabela mindmaps
```

## 🔒 Segurança

- **Row Level Security (RLS)** em todas as 7 tabelas
- **Políticas granulares** por operação (SELECT, INSERT, UPDATE, DELETE)
- **Headers HTTP** de segurança (X-Frame-Options, CSP, etc.)
- **ON DELETE CASCADE** — dados removidos ao deletar conta
- **VAPID keys** em variáveis de ambiente (nunca no código)

## 📄 Licença

Este projeto é de uso pessoal. Sinta-se livre para estudar o código e se inspirar.

---

Feito por [Giovanne Portella](https://github.com/Giovanne-Portella)
