import { describe, expect, it } from "vitest";
import { signUnlock, verifyUnlock } from "@/lib/unlock";

const SECRET = "x".repeat(40);
const USER = "6f0c6c8e-2b7a-4c55-9d43-1d2b3c4d5e6f";

describe("cookie de desbloqueo por PIN", () => {
  it("acepta un token válido", async () => {
    const t = await signUnlock(USER, SECRET);
    expect(await verifyUnlock(t, USER, SECRET)).toBe(true);
  });
  it("rechaza un token de otro usuario", async () => {
    const t = await signUnlock(USER, SECRET);
    expect(await verifyUnlock(t, "otro-usuario", SECRET)).toBe(false);
  });
  it("rechaza un token caducado", async () => {
    const t = await signUnlock(USER, SECRET, 60, Date.now() - 120_000);
    expect(await verifyUnlock(t, USER, SECRET)).toBe(false);
  });
  it("rechaza un token manipulado", async () => {
    const t = await signUnlock(USER, SECRET);
    const [u, exp, sig] = t.split(".");
    expect(await verifyUnlock(`${u}.${Number(exp) + 9999}.${sig}`, USER, SECRET)).toBe(false);
  });
  it("rechaza tokens vacíos o mal formados", async () => {
    expect(await verifyUnlock(undefined, USER, SECRET)).toBe(false);
    expect(await verifyUnlock("basura", USER, SECRET)).toBe(false);
  });
  it("exige un secreto largo", async () => {
    await expect(signUnlock(USER, "corto")).rejects.toThrow();
  });
});
