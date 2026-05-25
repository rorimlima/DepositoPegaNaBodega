-- =====================================================================
-- MIGRAÇÃO: Criar tabelas fechamentos_caixa e movimentacoes_caixa
-- Projeto: bodnmvheuayaruvjjsyq (RXfree)
-- Data: 2026-05-25
-- 
-- INSTRUÇÕES: Execute este SQL no Supabase Dashboard > SQL Editor
-- URL: https://supabase.com/dashboard/project/bodnmvheuayaruvjjsyq/sql
-- =====================================================================

-- ── 1. Tabela: fechamentos_caixa ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fechamentos_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data TEXT NOT NULL,
  operador_id UUID,
  status TEXT NOT NULL DEFAULT 'fechado',
  sistemico JSONB DEFAULT '{}',
  fisico JSONB DEFAULT '{}',
  totais JSONB DEFAULT '{}',
  justificativa TEXT,
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- ── 2. Tabela: movimentacoes_caixa ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID REFERENCES public.fechamentos_caixa(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('sangria', 'suprimento')),
  descricao TEXT DEFAULT '',
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- ── 3. Habilitar RLS (Row Level Security) ───────────────────────────
ALTER TABLE public.fechamentos_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

-- ── 4. Políticas de acesso: fechamentos_caixa ───────────────────────
CREATE POLICY "fc_select_anon" ON public.fechamentos_caixa
  FOR SELECT TO anon USING (true);

CREATE POLICY "fc_insert_anon" ON public.fechamentos_caixa
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "fc_update_anon" ON public.fechamentos_caixa
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "fc_delete_anon" ON public.fechamentos_caixa
  FOR DELETE TO anon USING (true);

-- ── 5. Políticas de acesso: movimentacoes_caixa ─────────────────────
CREATE POLICY "mc_select_anon" ON public.movimentacoes_caixa
  FOR SELECT TO anon USING (true);

CREATE POLICY "mc_insert_anon" ON public.movimentacoes_caixa
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "mc_update_anon" ON public.movimentacoes_caixa
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "mc_delete_anon" ON public.movimentacoes_caixa
  FOR DELETE TO anon USING (true);

-- ── 6. Índices para performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fechamentos_data ON public.fechamentos_caixa(data);
CREATE INDEX IF NOT EXISTS idx_fechamentos_operador ON public.fechamentos_caixa(operador_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_fechamento ON public.movimentacoes_caixa(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes_caixa(data);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON public.movimentacoes_caixa(tipo);

-- ── 7. Verificação ──────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
