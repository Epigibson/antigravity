# 🚀 Nexus Control Center

> **Elimina la fricción del context switching.** Un solo comando para cambiar toda tu identidad de desarrollo — GitHub, AWS, Supabase, Vercel, MongoDB, y cada sesión CLI — instantáneamente.

## El Problema

Los desarrolladores que trabajan en múltiples proyectos pierden **horas por semana** iniciando y cerrando sesión en CLI tools:

```
gh auth switch → aws sso login → supabase link → vercel switch → mongosh --host ...
```

Cada proyecto tiene diferentes cuentas de GitHub, perfiles de AWS, orgs de Supabase, credenciales de bases de datos y API keys. **Nexus lo arregla.**

## La Solución

```bash
# Un comando. Todos los CLIs. Todas las credenciales. Listo.
nexus switch my-saas-app --env production
```

Este comando:
- ✅ Cambia tu cuenta de **GitHub** CLI
- ✅ Activa el perfil correcto de **AWS**
- ✅ Enlaza el proyecto correcto de **Supabase**
- ✅ Cambia el scope de **Vercel**
- ✅ Configura las conexiones de **MongoDB**
- ✅ Inyecta todas las **variables de entorno**
- ✅ Hace checkout a la **rama de Git** correcta
- ✅ Registra todo en un **audit trail inmutable**

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│              Nexus CLI (Go)                    │
│  ┌──────────────────────────────────────────────┐    │
│  │          Skills Orchestrator                 │    │
│  │  ┌──────┐ ┌──────┐ ┌───────┐ ┌──────┐      │    │
│  │  │ ENV  │ │ Git  │ │  CLI  │ │Audit │      │    │
│  │  │ Inj  │ │State │ │Switch │ │ Log  │      │    │
│  │  └──┬───┘ └──┬───┘ └──┬────┘ └──┬───┘      │    │
│  └─────┼────────┼────────┼─────────┼───────────┘    │
│        ▼        ▼        ▼         ▼                 │
│  ┌──────────────────────────────────────────────┐    │
│  │      CLI Profile Adapters                    │    │
│  │  gh · aws · supabase · vercel · mongosh      │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         │                              ▲
         ▼                              │
┌────────────────────┐    ┌─────────────────────────┐
│  FastAPI Backend   │◄──►│  Dashboard (Next.js)    │
│  (:8000)           │    │  (:3000)                │
│  · JWT Auth        │    │  · Real-time stats      │
│  · REST API v1     │    │  · Project management   │
│  · Pydantic v2     │    │  · Audit log viewer     │
│  · SQLite/PgSQL    │    │  · CLI profile editor   │
└────────────────────┘    └─────────────────────────┘
```

## Instalación del CLI

### macOS / Linux (Recomendado)

La forma más rápida y sin fricción para auto-instalar, compilar e inyectar configuraciones en tu entorno actual:

```bash
curl -sSL https://raw.githubusercontent.com/Epigibson/Nexus/master/install.sh | bash
```

*¿Quieres desinstalarlo?* Puedes correr el desinstalador completo con:
`curl -sSL https://raw.githubusercontent.com/Epigibson/Nexus/master/uninstall.sh | bash`

### Windows (PowerShell)

Instalación rápida en un solo comando (descarga el binario oficial precompilado):

```powershell
irm https://raw.githubusercontent.com/Epigibson/Nexus/master/install.ps1 | iex
```

*Nota: Una vez instalado, reinicia tu terminal de PowerShell para que se recargue el PATH y verifica la instalación ejecutando `nexus version`.*

### Compilación Manual (Avanzado)

```bash
# 1. Descargar y compilar
git clone https://github.com/Epigibson/Nexus.git
cd Nexus/core
go build -o nexus ./cmd/nexus

# 2. Instalar globalmente
sudo mv nexus /usr/local/bin/nexus

# 3. Activar integraciones y verificar
nexus setup-shell
nexus version
# → Nexus v0.1.0
```

## Quick Start

### 1. Crear cuenta en el Dashboard

Regístrate en [nexusproject.pro](https://nexusproject.pro) y crea un proyecto con sus entornos (development, staging, production).

### 2. Generar API Key

Ve a **Configuración → API Keys → Generar Nueva Key** y copia la key (empieza con `ag_live_...`).

### 3. Conectar el CLI

```bash
# Autenticarte con tu API key
nexus login
# → Paste your API key: ag_live_xxxxxxxxxx...
# → ✅ Authenticated as tu-nombre (tu@email.com)

# Ver tus proyectos
nexus sync

# Ver estado de conexión
nexus status
```

### 4. ¡Hacer switch!

```bash
# Cambiar todo tu contexto de desarrollo
nexus switch mi-proyecto --env production

# → ✅ gh → epigibson
# → ✅ aws → prod-profile  
# → ✅ supabase → linked
# → ✅ env vars → 4 variables set
# → ✅ Context switch complete!
```

### 5. Desconectar (opcional)

```bash
nexus logout
```

## Stack Tecnológico

| Componente | Tecnología | Estado |
|-----------|-----------|--------|
| Core CLI & Orchestrator | Go 1.26 (Cobra CLI) | ✅ |
| Dashboard | Next.js 16 + Tailwind v4 + shadcn/ui | ✅ |
| Backend API | FastAPI + Pydantic v2 + SQLAlchemy 2.0 | ✅ |
| Payments | Stripe Checkout + Customer Portal | ✅ |
| Dashboard ↔ API | JWT Auth + REST fetch client | ✅ |
| Documentation | Mintlify (theme: palm) | ✅ |
| Database | PostgreSQL (Supabase) | ✅ |
| Encryption | AES-256-GCM + Argon2id | ✅ |

### Documentación (Mintlify)
```bash
cd docs/
npx mintlify@latest dev
# → http://localhost:3333
```

## Estructura del Proyecto

```
nexus/
├── .agents/               # AI agent skills, workflows & context
│   ├── context/           #   └── architecture.md (documentación técnica)
│   └── workflows/         #   └── add-cli-profiler.md
│
├── core/                  # Go CLI & Orchestrator (Arquitectura Hexagonal)
│   ├── cmd/main.go        #   Entrypoint
│   └── internal/
│       ├── domain/        #   Entidades: Project, Skill, CLIProfile, ScriptHook
│       ├── port/          #   Interfaces: CLIProfiler, ConfigReader
│       ├── service/       #   Orchestrator: skills + hooks pre/post
│       └── adapter/       #   Implementaciones: CLI, Config, Audit
│           ├── cli/       #     Comandos Cobra (init, switch, list)
│           ├── config/    #     YAML reader
│           ├── executor/  #     CLI profilers (gh, aws, supabase, vercel, mongo)
│           └── audit/     #     JSONL audit logger
│
├── api/                   # FastAPI Backend
│   ├── app/
│   │   ├── main.py        #   FastAPI app + CORS + lifecycle (seed + bootstrap)
│   │   ├── config.py      #   Pydantic BaseSettings (plan limits, Stripe keys)
│   │   ├── database.py    #   SQLAlchemy async + auto-migrate
│   │   ├── models/        #   ORM models (9 tablas)
│   │   ├── schemas/       #   Pydantic v2 request/response
│   │   ├── services/      #   Lógica de negocio
│   │   │   ├── auth_service.py        # JWT + bcrypt
│   │   │   ├── project_service.py     # CRUD projects
│   │   │   ├── stats_service.py       # Dashboard aggregations
│   │   │   ├── plan_enforcement.py    # Límites Free/Premium/Enterprise
│   │   │   ├── seed_skills.py         # Seed 12 skills al startup
│   │   │   └── admin_bootstrap.py     # Bootstrap admin enterprise
│   │   ├── routers/       #   Endpoints REST (8 routers, 30+ endpoints)
│   │   │   ├── auth.py          # /auth (6 endpoints)
│   │   │   ├── projects.py      # /projects (9 endpoints)
│   │   │   ├── skills.py        # /skills (3 endpoints)
│   │   │   ├── teams.py         # /teams (4 endpoints)
│   │   │   ├── billing.py       # /billing (5 endpoints)
│   │   │   ├── audit.py         # /audit (1 endpoint)
│   │   │   └── dashboard.py     # /dashboard (3 endpoints)
│   │   └── middleware/    #   JWT auth dependency
│   ├── seed.py            #   Datos de demo
│   └── requirements.txt
│
├── dashboard/             # Next.js 16 Web Dashboard
│   └── src/
│       ├── app/
│       │   ├── login/           #   Página de autenticación
│       │   └── dashboard/       #   Layout + páginas:
│       │       ├── page.tsx     #     Overview (stats, plan badge)
│       │       ├── projects/    #     Proyectos + detalle [slug]
│       │       ├── skills/      #     Catálogo de skills + toggle
│       │       ├── team/        #     Gestión de equipo
│       │       ├── audit/       #     Registro de auditoría
│       │       ├── billing/     #     Planes + pagos Stripe
│       │       └── settings/    #     Configuración + API keys
│       ├── components/    #   shadcn/ui + custom components
│       └── lib/
│           ├── api.ts     #   Cliente HTTP tipado (25+ métodos)
│           └── auth-context.tsx  # JWT AuthProvider
│
├── database/              # Schema SQL & Migrations
│   └── migrations/        #   001_initial_schema.sql
│
├── configs/               # Configuraciones de ejemplo
├── docs/                  # Documentación técnica (Mintlify)
└── nexus.yaml             # Configuración de ejemplo raíz
```

## API Endpoints

Todos los endpoints están bajo `/api/v1/` y documentados en Swagger UI (`/docs`).

| Tag | Endpoints | Auth |
|-----|-----------|------|
| **Auth** | `POST /register`, `POST /login`, `GET /me`, `PUT /me`, API Keys CRUD | Público / Bearer |
| **Projects** | CRUD + environments + hooks (9 endpoints) | Bearer |
| **Skills** | Catálogo + toggle per-project (3 endpoints) | Bearer |
| **Teams** | Listar, invitar, cambiar rol, eliminar (4 endpoints) | Bearer |
| **Billing** | Plan limits, Stripe checkout/portal, subscriptions (5 endpoints) | Bearer |
| **Audit** | Log filtrable + export (1 endpoint) | Bearer |
| **Dashboard** | Stats, actividad, recientes (3 endpoints) | Bearer |
| **Health** | 2 health checks | Público |

## Licencia

MIT © Nexus Dev
