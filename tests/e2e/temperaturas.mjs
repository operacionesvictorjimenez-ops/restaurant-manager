// Recorrido de la Fase 1 en navegador: node tests/e2e/temperaturas.mjs [carpetaCapturas]
// Requiere la app en http://localhost:3000 y los datos de npm run db:reset.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];
const browser = await chromium.launch();
const step = (s) => console.log("✓", s);

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
const key = (page, d) => page.locator(`button:text-is("${d}")`).first().click();
async function type(page, text) {
  for (const ch of text) await key(page, ch);
}

// ---------- Tablet de Móstoles
const tablet = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, locale: "es-ES", acceptDownloads: true })).newPage();
const shot = (p, n) => shots && p.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
await login(tablet, "admin@demo.local", "Admin-Demo-2026");
await tablet.goto(`${BASE}/admin/restaurantes`);
await tablet.click("tr:has-text('MOSTOLES') >> text=Abrir");
await tablet.check("#confirm");
await tablet.click("text=Usar este dispositivo como tablet del local");
await tablet.waitForURL("**/bloqueo");
await type(tablet, "1234");
await tablet.click("button:text-is('Entrar')");
await tablet.waitForURL("**/r/mostoles");
await tablet.getByRole("heading", { name: "Cámaras" }).waitFor();
assert.equal(await tablet.locator("section:has(h2:text-is('Cámaras')) a[href*='/temperaturas/']").count(), 7, "7 cámaras en el inicio");
await shot(tablet, "10-inicio-mostoles");
step("tablet de Móstoles: inicio con sus 7 cámaras");

// Ronda de control
await tablet.goto(`${BASE}/r/mostoles/temperaturas`);
await shot(tablet, "11-temperaturas");
await tablet.click("a:has-text('CR-1')");
await tablet.getByRole("heading", { name: /CR-1/ }).waitFor();
await type(tablet, "2,4");
await tablet.click("button:has-text('Guardar')");
await tablet.getByText("Guardado · CR-1: 2,4 °C").waitFor();
step("CR-1 a 2,4 °C guardada y pasa a la siguiente cámara");

// Fuera de rango
const heading = await tablet.getByRole("heading", { level: 1 }).textContent();
assert.match(heading, /CR-2/);
await type(tablet, "7,5");
await tablet.getByText("Fuera de rango (0,0 a 4,0 °C)").waitFor();
await tablet.click("button:has-text('Continuar')");
await tablet.getByText("7,5 °C está fuera de rango").waitFor();
await shot(tablet, "12-accion-correctora");
await tablet.click("button:has-text('Guardar e informar')");
await tablet.getByText("Elige la acción correctora").waitFor();
await tablet.click("button:has-text('Puerta mal cerrada')");
await tablet.click("button:has-text('Guardar e informar')");
await tablet.getByText("CR-2: 7,5 °C · incidencia abierta").waitFor();
step("CR-2 a 7,5 °C exige acción correctora y abre incidencia");

// Congelación: el signo menos viene puesto
assert.match(await tablet.getByRole("heading", { level: 1 }).textContent(), /CR-3/);
await tablet.goto(`${BASE}/r/mostoles/temperaturas`);
await tablet.click("a:has-text('CF-1')");
await type(tablet, "19,5");
await tablet.getByText("−19,5").waitFor();
await shot(tablet, "13-teclado-congelacion");
await tablet.click("button:has-text('Guardar')");
await tablet.getByText("CF-1: −19,5 °C").waitFor();
step("congelación: −19,5 °C con el signo puesto por defecto");

// Sin conexión justo al guardar
await tablet.goto(`${BASE}/r/mostoles/temperaturas`);
await tablet.click("a:has-text('CR-4')");
await type(tablet, "3");
await tablet.context().setOffline(true);
await tablet.click("button:has-text('Guardar')");
await tablet.getByText("guardada en la tablet", { exact: false }).first().waitFor();
await tablet.getByText("pendiente de enviar", { exact: false }).waitFor();
step("sin conexión: la lectura queda guardada en la tablet");
await tablet.context().setOffline(false);
await tablet.evaluate(() => window.dispatchEvent(new Event("online")));
await tablet.getByText("pendiente de enviar", { exact: false }).waitFor({ state: "detached", timeout: 15000 });
await tablet.goto(`${BASE}/r/mostoles/temperaturas`);
await tablet.locator("a:has-text('CR-4')").getByText("3,0°").waitFor();
step("al volver la conexión se envía sola y aparece en CR-4");

// Incidencias e inicio
await tablet.goto(`${BASE}/r/mostoles`);
await tablet.getByText("1 abiertas").waitFor();
await tablet.goto(`${BASE}/r/mostoles/incidencias`);
await tablet.getByText("Cámara de refrigeración 2 a 7,5 °C").waitFor();
assert.equal(await tablet.locator("text=Cerrar incidencia").count(), 0);
step("la tablet ve la incidencia pero no puede cerrarla");

// Histórico, informe y Excel
await tablet.goto(`${BASE}/r/mostoles/temperaturas/historial`);
assert.ok((await tablet.locator("svg[aria-label^='Gráfica']").count()) >= 7);
await shot(tablet, "14-historico");
const [dl] = await Promise.all([tablet.waitForEvent("download"), tablet.click("text=Excel (CSV)")]);
const csv = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
assert.match(csv, /^﻿Restaurante;Fecha;Hora;Cámara/);
assert.match(csv, /CR-2;Cámara de refrigeración 2;Refrigeración;7,5;0,0 a 4,0 °C;Fuera de rango;Puerta mal cerrada/);
step(`Excel: ${csv.trim().split("\n").length - 1} lecturas exportadas`);
await tablet.goto(`${BASE}/r/mostoles/temperaturas/informe`);
await tablet.getByText("Registro de control de temperaturas").waitFor();
await tablet.getByText("Temperatura recuperada a 3,4 °C", { exact: false }).waitFor();
await shot(tablet, "15-informe");
await tablet.emulateMedia({ media: "print" });
if (shots) await tablet.pdf({ path: `${shots}/informe-mostoles.pdf`, format: "A4", printBackground: true });
assert.equal(await tablet.locator("nav[aria-label=Principal]").isVisible(), false, "el menú no se imprime");
await tablet.emulateMedia({ media: "screen" });
step("informe imprimible (PDF) con incidencias y firma");

// ---------- Encargada cierra la incidencia
const mgr = await (await browser.newContext({ viewport: { width: 820, height: 1180 }, locale: "es-ES" })).newPage();
await login(mgr, "encargada@demo.local", "Encargada-Demo-2026");
await mgr.goto(`${BASE}/r/mostoles/incidencias`);
await mgr.fill("input[name=resolution]", "Puerta ajustada. Recuperada a 3,2 °C");
await mgr.click("text=Cerrar incidencia");
await mgr.getByText("No hay incidencias abiertas.").waitFor();
step("la encargada cierra la incidencia");

// ---------- Restaurante nuevo con las 7 + 4 por defecto
await mgr.context().clearCookies();
await login(mgr, "admin@demo.local", "Admin-Demo-2026");
await mgr.goto(`${BASE}/admin/restaurantes`);
assert.equal(await mgr.inputValue("#new-cr"), "7");
assert.equal(await mgr.inputValue("#new-cf"), "4");
await mgr.fill("#new-code", "ALCORCON");
await mgr.fill("#new-name", "Alcorcón");
await mgr.fill("#new-pin", "2468");
await mgr.click("text=Crear restaurante");
await mgr.waitForURL(/\/admin\/restaurantes\/[0-9a-f-]{36}$/);
await mgr.click("text=Cámaras y horario de controles");
await mgr.getByText("11 cámaras activas").waitFor();
await shot(mgr, "16-admin-camaras");
step("restaurante nuevo: se crean 7 de refrigeración y 4 de congelación");

// Cambiar rango y horario
await mgr.fill("#times", "08:30, 13:00, 20:00");
await mgr.click("text=Guardar horario");
await mgr.getByText("Horario guardado: 08:30, 13:00, 20:00.").waitFor();
step("horario de controles configurable");

// ---------- Móvil sin desbordamiento
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES" })).newPage();
await login(phone, "encargada@demo.local", "Encargada-Demo-2026");
for (const path of ["/r/mostoles", "/r/mostoles/temperaturas", "/r/mostoles/temperaturas/historial"]) {
  await phone.goto(`${BASE}${path}`);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `desborda ${path}`);
}
if (shots) await phone.screenshot({ path: `${shots}/17-movil-temperaturas.png`, fullPage: true });
step("móvil sin desbordamiento en inicio, temperaturas e histórico");

await browser.close();
console.log("\nFase 1: recorrido completo OK");
