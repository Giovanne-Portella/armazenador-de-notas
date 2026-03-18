-- ============================================
-- MIGRATION: Friends + Shared Notes
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================

-- 1. Tabela de perfis (espelho do auth.users para busca)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca por email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler perfis (necessário para busca de amigos)
CREATE POLICY "Profiles: leitura pública" ON profiles
    FOR SELECT TO authenticated USING (true);

-- Usuário só atualiza próprio perfil
CREATE POLICY "Profiles: atualizar próprio" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- Usuário pode inserir próprio perfil
CREATE POLICY "Profiles: inserir próprio" ON profiles
    FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 2. Trigger para criar perfil automaticamente no signup/login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger se já existir, depois recria
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Popular perfis para usuários existentes
INSERT INTO profiles (id, email, display_name, avatar_url)
SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', NULL)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de amizades
CREATE TABLE IF NOT EXISTS friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Leitura: pode ver amizades onde é participante
CREATE POLICY "Friendships: leitura própria" ON friendships
    FOR SELECT TO authenticated
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Inserção: só pode enviar solicitação como requester
CREATE POLICY "Friendships: enviar solicitação" ON friendships
    FOR INSERT TO authenticated
    WITH CHECK (requester_id = auth.uid());

-- Atualização: só addressee aceita
CREATE POLICY "Friendships: aceitar solicitação" ON friendships
    FOR UPDATE TO authenticated
    USING (addressee_id = auth.uid());

-- Deletar: qualquer participante pode remover amizade
CREATE POLICY "Friendships: remover" ON friendships
    FOR DELETE TO authenticated
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- 4. Tabela de compartilhamento de notas
CREATE TABLE IF NOT EXISTS note_shares (
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (note_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_note_shares_user ON note_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_note ON note_shares(note_id);

ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

-- Leitura: se é owner da nota OU destinatário do share
CREATE POLICY "Shares: leitura" ON note_shares
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR shared_by = auth.uid());

-- Inserção: só o dono da nota (shared_by) pode compartilhar
CREATE POLICY "Shares: compartilhar" ON note_shares
    FOR INSERT TO authenticated
    WITH CHECK (shared_by = auth.uid());

-- Deleção: dono ou destinatário pode remover compartilhamento
CREATE POLICY "Shares: remover" ON note_shares
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR shared_by = auth.uid());

-- 5. Permitir que amigos leiam/editem notas compartilhadas
-- Política adicional na tabela notes para shared notes
CREATE POLICY "Notes: leitura compartilhada" ON notes
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR id IN (SELECT note_id FROM note_shares WHERE user_id = auth.uid())
    );

CREATE POLICY "Notes: edição compartilhada" ON notes
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
        OR id IN (SELECT note_id FROM note_shares WHERE user_id = auth.uid())
    );

-- NOTA: Se já existem políticas SELECT/UPDATE em notes, pode ser necessário
-- dropar as antigas primeiro. Verifique no Supabase Dashboard > Authentication > Policies.
-- DROP POLICY IF EXISTS "nome_da_politica_antiga" ON notes;
