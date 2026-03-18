-- ============================================
-- MIGRATION: Documents + Document Shares
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================

-- 1. Tabela de documentos
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Sem título',
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Owner: acesso total
CREATE POLICY "Documents: owner full access" ON documents
    FOR ALL TO authenticated USING (user_id = auth.uid());

-- Compartilhados: leitura
CREATE POLICY "Documents: shared read" ON documents
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT document_id FROM document_shares WHERE shared_with_id = auth.uid())
    );

-- Compartilhados com edição: update
CREATE POLICY "Documents: shared edit" ON documents
    FOR UPDATE TO authenticated
    USING (
        id IN (SELECT document_id FROM document_shares WHERE shared_with_id = auth.uid() AND can_edit = true)
    );

-- 2. Tabela de compartilhamentos
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_shared ON document_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON document_shares(document_id);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Owner gerencia compartilhamentos
CREATE POLICY "Doc shares: owner manages" ON document_shares
    FOR ALL TO authenticated USING (owner_id = auth.uid());

-- Compartilhado pode ver seus shares
CREATE POLICY "Doc shares: shared can see" ON document_shares
    FOR SELECT TO authenticated USING (shared_with_id = auth.uid());

-- 3. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at();
