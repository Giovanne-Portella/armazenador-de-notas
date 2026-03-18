/* ============================================
   SUPABASE — Client de conexão com o banco
   ============================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ Substitua pelos valores do seu projeto Supabase
export const SUPABASE_URL = 'https://qzkhnxypyouwpvppcmlp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6a2hueHlweW91d3B2cHBjbWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzA4NTAsImV4cCI6MjA4OTM0Njg1MH0.0wSap36_Yw4ZNfRY5EKCZlXhMMxfzaYb1DzqKFJn3JQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
