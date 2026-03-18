-- ============================================
-- MIGRATION: Tabela de Mapas Mentais
-- Executar no SQL Editor do Supabase
-- ============================================

-- Tabela principal de mapas mentais
CREATE TABLE mindmaps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT 'Novo Mapa Mental',
    nodes JSONB DEFAULT '[]'::jsonb,
    connections JSONB DEFAULT '[]'::jsonb,
    viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca por usuário
CREATE INDEX idx_mindmaps_user_id ON mindmaps(user_id);

-- Row Level Security
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuário só vê/edita seus próprios mapas
CREATE POLICY "Users manage own mindmaps"
    ON mindmaps FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_mindmaps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mindmaps_updated_at
    BEFORE UPDATE ON mindmaps
    FOR EACH ROW
    EXECUTE FUNCTION update_mindmaps_updated_at();
