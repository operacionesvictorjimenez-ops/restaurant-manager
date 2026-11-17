// Crea el primer administrador general en un proyecto nuevo de Supabase.
// Uso: node scripts/create-admin.mjs "Nombre Apellido" email@empresa.com "ContraseñaSegura"
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env.mjs";

loadEnv();
const [fullName, email, password] = process.argv.slice(2);
if (!fullName || !email || !password || password.length < 10) {
  console.error('Uso: node scripts/create-admin.mjs "Nombre" email contraseña(10+ caracteres)');
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: orgs } = await admin.from("organizations").select("id").limit(1);
if (!orgs?.length) {
  const { error } = await admin.from("organizations").insert({ name: "Grupo de restaurantes" });
  if (error) throw error;
}
const { data, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, app_metadata: { kind: "admin" },
});
if (error) throw error;
const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, full_name: fullName, kind: "admin" });
if (pErr) throw pErr;
console.log(`Administrador creado: ${email}`);
