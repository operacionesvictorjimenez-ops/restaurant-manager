"use client";
import { createContext, startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { FormMessage } from "@/components/ui";

type State = { error?: string; ok?: string } | null;

export const PendingContext = createContext<boolean | null>(null);

/**
 * Formulario con mensaje de resultado. Se envía con onSubmit para que, si hay
 * un error, no se borre lo que la persona ya había escrito.
 */
export function ActionForm({
  action,
  children,
  className = "grid gap-4",
}: {
  action: (prev: State, fd: FormData) => Promise<State>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>
        {children}
        <FormMessage state={state} />
      </PendingContext.Provider>
    </form>
  );
}
