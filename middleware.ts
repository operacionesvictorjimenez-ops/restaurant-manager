import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { UNLOCK_COOKIE, verifyUnlock } from "@/lib/unlock";

/**
 * Reglas de acceso:
 * - Sin sesión → /login
 * - Tablet del local (kiosk) sin PIN introducido → /bloqueo
 * - /admin solo para administrador general y encargados
 * Los permisos sobre datos los aplica la base de datos (RLS); esto solo dirige la navegación.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) return path === "/login" ? response : redirect("/login");

  const kind = user.app_metadata?.kind as string | undefined;

  if (kind === "kiosk") {
    const unlocked = await verifyUnlock(
      request.cookies.get(UNLOCK_COOKIE)?.value,
      user.id,
      process.env.RM_UNLOCK_SECRET!,
    );
    if (!unlocked) return path === "/bloqueo" ? response : redirect("/bloqueo");
    if (path === "/bloqueo" || path === "/login" || path.startsWith("/admin") || path.startsWith("/restaurantes"))
      return redirect("/");
    return response;
  }

  if (path === "/login" || path === "/bloqueo") return redirect("/");
  if (path.startsWith("/admin") && kind !== "admin" && kind !== "manager") return redirect("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
