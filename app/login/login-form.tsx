"use client";
import { login } from "./actions";
import { Field, inputClass } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm() {
  return (
    <ActionForm action={login}>
      <Field label="Email">
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Contraseña">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <SubmitButton pendingText="Entrando…" className="w-full">Entrar</SubmitButton>
    </ActionForm>
  );
}
