#!/usr/bin/env node
// testar-navegador.js — abre páginas do Guia Flutter num Chromium headless (na VPS) e confere o editor.
//
//   timeout 600 node tools/testar-navegador.js pagina.html [outra.html…]
//   --dartpad N    clica em ▶ Rodar na caixa N (1, 2…) e espera o DartPad (precisa de internet)
//   --codigo ARQ   (com --dartpad) põe o conteúdo de ARQ no editor antes do Rodar
//   --fotos DIR    salva um print da página (e da caixa N, com --dartpad) em DIR
//   --largura PX   largura da janela (padrão 1100; use 390 para celular)
//   --escuro       tema escuro
//   --espera S     segundos esperando a compilação depois do "ready" (padrão 15)
//
// Sobe um servidor HTTP estático em 127.0.0.1 (porta livre; morre junto com o script).
// Em cada página: erro de JS/console/HTTP local = problema; cada .tryflutter montada;
// FlutSim.caixas[i].testar("inicial") não cumpre e ("solucao") cumpre nas missões.
// Código de saída: 0 = ok; 1 = problema; 2 = uso errado.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");

const RAIZ = path.join(__dirname, "..");
const PUP = process.env.PUPPETEER_DIR || path.join(os.homedir(), "rascunho/coord/cdp/node_modules/puppeteer-core");
const CHROMIUM = process.env.CHROMIUM || "/usr/bin/chromium";

const args = process.argv.slice(2);
let dartpad = 0, codigo = null, fotos = null, largura = 1100, escuro = false, esperaS = 15;
const paginas = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--dartpad") dartpad = parseInt(args[++i], 10);
  else if (a === "--codigo") codigo = fs.readFileSync(args[++i], "utf8");
  else if (a === "--fotos") fotos = args[++i];
  else if (a === "--largura") largura = parseInt(args[++i], 10);
  else if (a === "--escuro") escuro = true;
  else if (a === "--espera") esperaS = parseInt(args[++i], 10);
  else if (a.startsWith("-")) { console.error("opção desconhecida: " + a); process.exit(2); }
  else paginas.push(path.basename(a));
}
if (!paginas.length || (dartpad && !(dartpad > 0))) { console.error("uso: timeout 600 node tools/testar-navegador.js [--dartpad N] [--codigo arq.dart] [--fotos DIR] [--largura PX] [--escuro] pagina.html…"); process.exit(2); }
if (fotos) fs.mkdirSync(fotos, { recursive: true });

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".json": "application/json" };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = path.join(RAIZ, u === "/" ? "index.html" : u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.statusCode = 404; return r.end("404"); }
  r.setHeader("content-type", TIPOS[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(r);
});
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

srv.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const pup = require(PUP);
  const nav = await pup.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  let ruins = 0;
  try {
    for (const pag of paginas) {
      console.log("== " + pag);
      const probs = [];
      const p = await nav.newPage();
      await p.setViewport({ width: largura, height: 900 });
      if (escuro) await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
      p.on("pageerror", (e) => probs.push("erro de JS: " + e.message));
      p.on("console", (m) => { if (m.type() === "error" && !/dartpad|gstatic|google|favicon/i.test(m.location().url || "") && !/Failed to load resource/.test(m.text())) probs.push("console: " + m.text()); });
      p.on("response", (r) => { if (r.url().startsWith(base) && r.status() >= 400 && !/favicon\.ico$/.test(r.url())) probs.push("HTTP " + r.status() + ": " + r.url().slice(base.length)); });
      await p.goto(base + pag, { waitUntil: "load" });
      await p.waitForFunction(() => !document.querySelector(".tryflutter") || (window.FlutSim && window.FlutSim.caixas), { timeout: 10000 }).catch(() => probs.push("o flutsim.js não carregou"));
      const r = await p.evaluate(() => {
        const n = document.querySelectorAll(".tryflutter").length;
        const cx = (window.FlutSim && window.FlutSim.caixas) || [];
        return { n, montadas: cx.length, missoes: cx.map((c, i) => c.meta ? { i: i + 1, ini: c.testar("inicial").ok, sol: c.testar("solucao").ok } : null).filter(Boolean) };
      });
      if (r.montadas !== r.n) probs.push(r.n + " caixa(s), " + r.montadas + " montada(s)");
      r.missoes.forEach((m) => {
        if (m.ini) probs.push("caixa " + m.i + ": o inicial já cumpre a missão");
        if (!m.sol) probs.push("caixa " + m.i + ": a solução não cumpre a missão");
      });
      console.log("  " + r.montadas + " caixa(s) montada(s), " + r.missoes.length + " missão(ões)");
      if (fotos) await p.screenshot({ path: path.join(fotos, pag.replace(/\.html$/, "") + ".png"), fullPage: true });
      if (dartpad) {
        if (dartpad > r.montadas) probs.push("--dartpad " + dartpad + ": a página só tem " + r.montadas + " caixa(s)");
        else {
          const t0 = Date.now();
          await p.evaluate((i, cod) => { const c = window.FlutSim.caixas[i]; if (cod !== null) c.definir(cod); c.el.scrollIntoView(); c.rodar(); }, dartpad - 1, codigo);
          const ok = await p.waitForFunction((i) => window.FlutSim.caixas[i].prontoJa || /não respondeu/.test(window.FlutSim.caixas[i].el.textContent), { timeout: 40000 }, dartpad - 1).then(() => p.evaluate((i) => window.FlutSim.caixas[i].prontoJa, dartpad - 1)).catch(() => false);
          if (!ok) probs.push("caixa " + dartpad + ": o DartPad não respondeu");
          else {
            console.log("  caixa " + dartpad + ": DartPad pronto em " + ((Date.now() - t0) / 1000).toFixed(1) + " s; esperando a compilação…");
            await p.evaluate((i) => window.FlutSim.caixas[i].el.querySelector(".fs-tela").scrollIntoView({ block: "center" }), dartpad - 1);
            await espera(esperaS * 1000);
            const st = await p.evaluate((i) => window.FlutSim.caixas[i].el.querySelector(".sim-status").textContent, dartpad - 1);
            if (st) console.log("  status: " + st);
            if (fotos) {
              const el = await p.evaluateHandle((i) => window.FlutSim.caixas[i].el, dartpad - 1);
              await el.screenshot({ path: path.join(fotos, pag.replace(/\.html$/, "") + "-caixa" + dartpad + ".png") });
              // o DartPad sozinho (o print de um elemento maior que a janela pode sair com o iframe em branco)
              const tela = await p.evaluateHandle((i) => window.FlutSim.caixas[i].el.querySelector(".fs-tela"), dartpad - 1);
              await tela.screenshot({ path: path.join(fotos, pag.replace(/\.html$/, "") + "-caixa" + dartpad + "-dartpad.png") });
            }
          }
        }
      }
      await p.close();
      probs.forEach((x) => console.log("  PROBLEMA  " + x));
      console.log("  -> " + (probs.length ? probs.length + " problema(s)" : "ok"));
      if (probs.length) ruins++;
    }
  } finally {
    await nav.close();
    srv.close();
  }
  process.exitCode = ruins ? 1 : 0;
});
