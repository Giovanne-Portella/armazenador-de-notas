# 🔧 Configuração do Supabase — Guia Completo

## 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `armazenador-de-notas` (ou o nome que preferir)
   - **Database Password**: crie uma senha forte (guarde-a!)
   - **Region**: escolha a mais próxima (ex: `South America (São Paulo)`)
4. Clique em **"Create new project"** e aguarde

---

## 2. Configurar Autenticação com Google

### 2.1 No Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ou use um existente)
3. Vá em **APIs & Services → Credentials**
4. Clique em **"Create Credentials" → "OAuth client ID"**
5. Se necessário, configure a **tela de consentimento OAuth** primeiro:
   - User Type: **Externo**
   - Nome do app: `Tarefas & Análises`
   - Email de suporte: seu email
   - Domínios autorizados: `supabase.co`
   - Salve e continue
6. Crie o **OAuth Client ID**:
   - Tipo: **Web application**
   - Nome: `Supabase Auth`
   - **Authorized redirect URIs**: adicione a URL de callback do Supabase:
     ```
     https://SEU_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     (Encontre o `PROJECT_REF` em: Supabase Dashboard → Settings → General)
7. Copie o **Client ID** e **Client Secret**

### 2.2 No Supabase Dashboard

1. Vá em **Authentication → Providers → Google**
2. Habilite o provider Google
3. Cole o **Client ID** e **Client Secret** do Google
4. Salve

### 2.3 Configurar URLs de Redirect

1. No Supabase Dashboard, vá em **Authentication → URL Configuration**
2. **Site URL**: `https://salvar-notas.netlify.app`
3. **Redirect URLs** — adicione todas:
   ```
   https://salvar-notas.netlify.app
   https://salvar-notas.netlify.app/
   https://salvar-notas.netlify.app/index.html
   http://localhost:5500
   http://localhost:5500/
   http://127.0.0.1:5500
   http://127.0.0.1:5500/
   ```
   (Ajuste as portas de localhost conforme seu servidor de desenvolvimento)

---

## 3. Criar Tabelas e Políticas RLS

### 3.1 Tabelas Base (notes, analyses, columns)

Vá em **SQL Editor** no Supabase Dashboard e execute o script abaixo **em uma única execução**:

```sql
-- ============================================
-- TABELA: notes
-- ============================================
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    color TEXT DEFAULT 'gray',
    status TEXT DEFAULT 'to-do',
    reminder_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: analyses
-- ============================================
CREATE TABLE public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    blocks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABELA: columns (Kanban customizável)
-- ============================================
CREATE TABLE public.columns (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    is_done BOOLEAN DEFAULT false,
    PRIMARY KEY (id, user_id)
);

-- ============================================
-- TABELA: push_subscriptions (Web Push)
-- ============================================
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ÍNDICES (performance)
-- ============================================
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_status ON public.notes(user_id, status);
CREATE INDEX idx_notes_reminder ON public.notes(reminder_at) WHERE reminder_at IS NOT NULL;
CREATE INDEX idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX idx_columns_user_id ON public.columns(user_id);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- ============================================
-- TRIGGER: auto-atualiza updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_notes_updated
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_analyses_updated
    BEFORE UPDATE ON public.analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuário só acessa seus próprios dados
-- ============================================

-- Habilitar RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- NOTES: Políticas por operação
CREATE POLICY "Usuários veem apenas suas notas"
    ON public.notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários criam apenas suas notas"
    ON public.notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários editam apenas suas notas"
    ON public.notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários deletam apenas suas notas"
    ON public.notes FOR DELETE
    USING (auth.uid() = user_id);

-- ANALYSES: Políticas por operação
CREATE POLICY "Usuários veem apenas suas análises"
    ON public.analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários criam apenas suas análises"
    ON public.analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários editam apenas suas análises"
    ON public.analyses FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários deletam apenas suas análises"
    ON public.analyses FOR DELETE
    USING (auth.uid() = user_id);

-- COLUMNS: Políticas por operação
CREATE POLICY "Columns: leitura própria" ON public.columns
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Columns: inserir própria" ON public.columns
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Columns: atualizar própria" ON public.columns
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Columns: deletar própria" ON public.columns
    FOR DELETE USING (auth.uid() = user_id);

-- PUSH_SUBSCRIPTIONS: Políticas
CREATE POLICY "Push: leitura própria" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Push: inserir própria" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Push: deletar própria" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);
```

### 3.2 Tabelas de Amizade e Compartilhamento

Para habilitar o sistema de amigos e compartilhamento de notas, execute o script em `docs/FRIENDS_MIGRATION.sql`. Ele cria:

- **`profiles`** — Espelho de `auth.users` para busca por email + trigger automático
- **`friendships`** — Pedidos de amizade (pending/accepted) com UNIQUE constraint
- **`note_shares`** — Vínculo nota↔destinatário com PK composta
- **Políticas RLS** específicas para cada tabela
- **Política adicional em `notes`** para permitir leitura/edição de notas compartilhadas

> ⚠️ Se já existem políticas SELECT/UPDATE em `notes`, pode ser necessário dropar as antigas primeiro.

---

## 4. Configurar o Projeto

### 4.1 Obter Credenciais

No Supabase Dashboard, vá em **Settings → API** e copie:
- **Project URL** (ex: `https://abcdefgh.supabase.co`)
- **anon public key** (a chave `anon`, não a `service_role`!)

### 4.2 Atualizar o Código

Edite o arquivo `js/supabase.js` e substitua os placeholders:

```js
const SUPABASE_URL = 'https://SEU-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...SUA_ANON_KEY_AQUI';
```

> ⚠️ **IMPORTANTE**: A `anon key` é uma chave pública. A segurança dos dados é garantida pelas **políticas RLS**, não pela chave. Nunca use a `service_role key` no frontend.

---

## 5. Deploy no Netlify

O deploy via GitHub é automático. Basta fazer push:

```bash
git add .
git commit -m "feat: integração Supabase com auth Google e banco de dados"
git push
```

O Netlify detectará as mudanças e fará o deploy. O arquivo `_headers` na raiz
configura automaticamente headers de segurança (X-Frame-Options, X-Content-Type-Options, etc.)

---

## 6. Verificação

Após o deploy:

1. Acesse `https://salvar-notas.netlify.app/login.html`
2. Clique em "Entrar com Google"
3. Autorize o app no Google
4. Você será redirecionado ao app com sua conta Google
5. Notas existentes no localStorage serão migradas automaticamente na primeira vez

### Checklist de segurança:
- [x] RLS habilitado em todas as tabelas (notes, analyses, columns, profiles, friendships, note_shares, push_subscriptions)
- [x] Políticas granulares (SELECT, INSERT, UPDATE, DELETE) por usuário
- [x] `ON DELETE CASCADE` — dados são removidos se o usuário deletar a conta
- [x] Índices para performance de queries por user_id, status, reminder_at
- [x] Headers de segurança HTTP via Netlify (`_headers`)
- [x] Chave anon (pública) no frontend — segurança via RLS no backend
- [x] Trigger automático para updated_at
- [x] Trigger automático para criação de perfil (profiles) no signup
- [x] Web Push via VAPID keys (variáveis de ambiente no Netlify)
- [x] Notas compartilhadas: policies adicionais em notes para SELECT/UPDATE via note_shares

---

## Referências

- [Supabase Auth — Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Netlify Headers](https://docs.netlify.com/routing/headers/)
