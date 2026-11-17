"use client";
import { useContext } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { PendingContext } from "@/components/action-form";
import type { ComponentProps } from "react";

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const status = useFormStatus();
  const ctx = useContext(PendingContext);
  const pending = ctx ?? status.pending;
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? pendingText : children}
    </Button>
  );
}
