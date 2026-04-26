-- 🛡️ Nexus Supabase RLS Policies
-- Execute this script in your Supabase SQL Editor.

-- Habilitar RLS en las tablas reales (esto bloquea por defecto TODO acceso directo desde el frontend)
-- Como tu frontend se comunica con FastAPI y FastAPI se conecta a Supabase como Admin (vía SQLAlchemy),
-- esto es perfecto porque evita que alguien use tu "anon key" para leer la base de datos por su cuenta.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- No agregamos políticas (CREATE POLICY).
-- Al no haber políticas, la regla por defecto es DENEGAR todo acceso a través de la API REST de Supabase.
-- Tu backend seguirá funcionando sin problemas porque SQLAlchemy usa la URL de Postgres (bypassea RLS).
