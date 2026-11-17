import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave de servicio. Ignora RLS: úsalo solo para operaciones
 * de Auth (crear usuarios, contraseñas) y siempre después de comprobar permisos.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
