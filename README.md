# RESTAURANT MANAGER

Plataforma de gestión operativa para los restaurantes del grupo: temperaturas, etiquetas de caducidad, recetario, formación y administración.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind) · Supabase (PostgreSQL con RLS, Auth).

## Modelo de acceso

| Quién | Cómo entra | Qué ve |
|---|---|---|
| Administrador general | Email + contraseña | Todos los restaurantes y la administración |
| Encargado | Email + contraseña | Solo los restaurantes asignados |
| Tablet del local | Cuenta propia del restaurante + **PIN único del local** (4–6 cifras) | Solo su restaurante |

- La tablet se registra una vez desde *Administración → Restaurantes → ficha → "Usar este dispositivo como tablet del local"*.
- Tras 5 PIN incorrectos la tablet queda bloqueada 5 minutos. Cambiar el PIN la desbloquea.
- Vuelve a pedir el PIN tras X minutos sin uso (configurable por restaurante, 5 por defecto).
- El aislamiento entre restaurantes lo aplica la base de datos (RLS), no la interfaz.
- Todo cambio en restaurantes, cuentas, asignaciones y PIN queda en `audit_log`, que no se puede modificar desde la API.

## Desarrollo local

Requisitos: Node 20+, Docker.

```bash
npm install
cp .env.example .env.local      # rellena con los valores de `npx supabase status`
npm run db:start                # Supabase local (BD + Auth + API)
npm run db:reset                # aplica migraciones y crea datos de prueba
npm run dev
```

Datos de prueba (`npm run db:reset`):

- Admin: `admin@demo.local` / `Admin-Demo-2026`
- Encargada (Centro y Puerto): `encargada@demo.local` / `Encargada-Demo-2026`
- PIN de los locales de prueba: `1234`

## Pruebas

```bash
npm test                               # unitarias + aislamiento entre restaurantes (necesita Supabase local)
npm run build && npm start             # en otra terminal:
node tests/e2e/smoke.mjs               # recorrido completo en navegador (Playwright)
```

## Producción

1. Crear proyecto Supabase en región UE (plan Pro para copias diarias).
2. `npx supabase link --project-ref <ref>` y `npx supabase db push`.
3. Variables en Vercel: ver `.env.example`. `RM_UNLOCK_SECRET` debe ser una cadena aleatoria de 32+ caracteres.
4. Crear el primer administrador: `node scripts/create-admin.mjs "Nombre" email "contraseña"`.

## Estructura

```
app/
  login/              acceso de responsables
  bloqueo/            PIN del local (tablet)
  restaurantes/       selector de restaurante
  r/[slug]/           panel del restaurante y módulos
  admin/              restaurantes, encargados, actividad
components/           UI común (botones grandes, barra lateral, formularios)
lib/                  clientes Supabase, sesión, firma de desbloqueo
supabase/migrations/  esquema, RLS, funciones y auditoría
scripts/              datos de prueba y alta del primer administrador
tests/                pruebas unitarias, de acceso y e2e
```

## Fases

- [x] **Fase 0** · Cimientos: restaurantes, encargados, PIN del local, RLS, auditoría
- [ ] **Fase 1** · Temperaturas e incidencias
- [ ] Fase 2 · Etiquetas de caducidad
- [ ] Fase 3 · Recetario y escandallos
- [ ] Fase 4 · Formación
- [ ] Fase 5 · Administración avanzada e informes
- [ ] Fase 6 · Sensores automáticos y despliegue a todos los locales
