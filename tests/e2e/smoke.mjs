// Recorrido completo en navegador: node tests/e2e/smoke.mjs [carpetaCapturas]
// Requiere la app en http://localhost:3000 y los datos de npm run db:reset.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, locale: "es-ES" });
const page = await ctx.newPage();
const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const step = (s) => console.log("✓", s);

// 1. Sin sesión → login
await page.goto(BASE);
await page.waitForURL("**/login");
await shot("01-login");
step("sin sesión redirige a /login");

// 2. Contraseña mala
await page.fill("#email", "admin@demo.local");
await page.fill("#password", "mala-contraseña");
await page.click("button[type=submit]");
await page.getByText("Email o contraseña incorrectos").waitFor();
step("contraseña incorrecta muestra error");

// 3. Admin entra y ve los 3 locales
await page.fill("#password", "Admin-Demo-2026");
await page.click("button[type=submit]");
await page.waitForURL("**/restaurantes");
for (const n of ["Restaurante Centro", "Restaurante Puerto", "Restaurante Playa"]) await page.getByText(n).first().waitFor();
await shot("02-selector-admin");
step("admin ve los 3 restaurantes");

// 4. Admin crea restaurante nuevo
await page.goto(`${BASE}/admin/restaurantes`);
await page.fill("#new-code", "NORTE");
await page.fill("#new-name", "Restaurante Norte");
await page.fill("#new-pin", "4321");
await page.click("text=Crear restaurante");
await page.waitForURL(/\/admin\/restaurantes\/[0-9a-f-]{36}$/);
await page.getByText("Configurado").first().waitFor();
await shot("03-ficha-restaurante");
step("admin crea Restaurante Norte con PIN");

// 5. Registrar este navegador como tablet del local Norte
await page.check("#confirm");
await page.click("text=Usar este dispositivo como tablet del local");
await page.waitForURL("**/bloqueo");
await page.getByRole("heading", { name: "Restaurante Norte" }).waitFor();
await shot("04-bloqueo-pin");
step("dispositivo registrado como tablet: pide PIN");

// 6. PIN incorrecto y luego correcto
for (const d of "1111") await page.click(`button:text-is("${d}")`);
await page.click("button:text-is('Entrar')");
await page.getByText("PIN incorrecto. Te quedan 4 intentos.").waitFor();
step("PIN incorrecto avisa de intentos restantes");
for (const d of "4321") await page.click(`button:text-is("${d}")`);
await page.click("button:text-is('Entrar')");
await page.waitForURL("**/r/restaurante-norte");
await page.getByText("Registrar temperaturas").waitFor();
await shot("05-panel-tablet");
step("PIN correcto abre el panel del local");

// 7. La tablet no puede entrar a administración ni a otro local
await page.goto(`${BASE}/admin/restaurantes`);
await page.waitForURL("**/r/restaurante-norte");
const other = await page.goto(`${BASE}/r/restaurante-centro`);
assert.equal(other.status(), 404);
step("la tablet no accede a admin ni a otros locales");

// 8. Bloquear vuelve a pedir PIN
await page.goto(`${BASE}/r/restaurante-norte`);
await page.click("text=Bloquear");
await page.waitForURL("**/bloqueo");
step("botón Bloquear vuelve a pedir el PIN");

// 9. Encargada: solo sus locales
const ctx2 = await browser.newContext({ viewport: { width: 820, height: 1180 }, locale: "es-ES" });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/login`);
await p2.fill("#email", "encargada@demo.local");
await p2.fill("#password", "Encargada-Demo-2026");
await p2.click("button[type=submit]");
await p2.waitForURL("**/restaurantes");
await p2.getByText("Restaurante Centro").waitFor();
assert.equal(await p2.getByText("Restaurante Playa").count(), 0);
const forbidden = await p2.goto(`${BASE}/r/restaurante-playa`);
assert.equal(forbidden.status(), 404);
await p2.goto(`${BASE}/admin/encargados`);
await p2.waitForURL("**/restaurantes");
step("encargada solo ve Centro y Puerto; no entra a Playa ni a Encargados");

// 10. Móvil
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES" });
const p3 = await ctx3.newPage();
await p3.goto(`${BASE}/login`);
await p3.fill("#email", "admin@demo.local");
await p3.fill("#password", "Admin-Demo-2026");
await p3.click("button[type=submit]");
await p3.waitForURL("**/restaurantes");
await p3.goto(`${BASE}/r/restaurante-centro`);
const overflow = await p3.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
assert.equal(overflow, false, "la página no debe desbordar en móvil");
if (shots) await p3.screenshot({ path: `${shots}/06-movil.png`, fullPage: true });
step("móvil sin desbordamiento horizontal");

// 11. Histórico
await page.context().clearCookies();
await p3.goto(`${BASE}/admin/actividad`);
await p3.getByText("Restaurante creado").first().waitFor();
await p3.getByText("Tablet bloqueada", { exact: false }).count();
step("histórico de actividad registra los cambios");

await browser.close();
console.log("\nRecorrido completo OK");
