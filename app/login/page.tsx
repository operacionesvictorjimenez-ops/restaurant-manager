import { LoginForm } from "./login-form";

export const metadata = { title: "Acceso · Restaurant Manager" };

export default function LoginPage() {
  return (
    <main className="grid min-h-full place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-accent font-display text-xl font-extrabold text-white">RM</div>
          <div>
            <p className="font-display text-2xl font-extrabold leading-none tracking-wide">RESTAURANT MANAGER</p>
            <p className="text-sm text-muted">Acceso para administración y encargados</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <LoginForm />
        </div>
        <p className="text-center text-sm text-muted">
          ¿Eres del equipo de cocina? Usa la tablet del restaurante e introduce el PIN del local.
        </p>
      </div>
    </main>
  );
}
