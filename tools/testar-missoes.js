#!/usr/bin/env node
// testar-missoes.js — confere as páginas do Guia Flutter antes do commit.
//
//   timeout 900 node tools/testar-missoes.js pagina.html [outra.html…]
//   timeout 3600 node tools/testar-missoes.js --todas        (todas as .html da raiz)
//   --sem-analise   não roda o "dart analyze" (só as conferências rápidas)
//   --lints         mostra também as dicas (INFO) do analisador, como aviso
//   -q / --quieto   mostra só FALHA e aviso (e o resumo)
//
// Para cada página:
//   - cada caixa .tryflutter: contrato (um pre.script com data-file="main.dart", metas
//     conhecidas, regex válidas), missão com pre.solucao, o código INICIAL NÃO cumpre a
//     meta e a SOLUÇÃO cumpre — com as MESMAS funções do editor (assets/flutsim.js);
//   - o código de cada caixa (inicial e solução) e de cada pre.file com "void main" e
//     "import 'package:flutter" passa pelo analisador do Flutter real da VPS
//     (dart analyze num projeto modelo): ERROR = FALHA, WARNING = aviso;
//   - imports: só os pacotes que o DartPad aceita (FlutSim.PACOTES_DARTPAD; o modelo ganha
//     esses pacotes com "flutter pub add") e nada de dart:io/ffi/isolate/mirrors;
//   - data-foto (com data-foto-alt) e as <img> locais: o arquivo existe;
//   - todo <pre>: "<" e "&" escapados (&lt; &amp;);
//   - links internos só para páginas da NIVEIS (aviso); nada da máquina real (FALHA).
// Código de saída: 0 = tudo ok; 1 = alguma FALHA; 2 = uso errado / página inexistente.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const FlutSim = require("../assets/flutsim.js");

const RAIZ = path.join(__dirname, "..");
const FLUTTER_BIN = process.env.FLUTTER_BIN || path.join(os.homedir(), "flutter-sdk/flutter/bin");
const MODELO = process.env.FLUTTER_MODELO || path.join(os.homedir(), ".cache/guia-flutter/modelo");

/* ------------------------------------------------------------------ args */
const args = process.argv.slice(2);
let quieto = false, todas = false, analise = true, lints = false;
const paginas = [];
for (const a of args) {
  if (a === "-q" || a === "--quieto") quieto = true;
  else if (a === "--todas") todas = true;
  else if (a === "--sem-analise") analise = false;
  else if (a === "--lints") lints = true;
  else if (a === "--nativo") { /* compatibilidade com o atalho "testar --nativo": a análise já é nativa */ }
  else if (a === "-h" || a === "--help") uso(0);
  else if (a.startsWith("-")) { console.error("opção desconhecida: " + a); uso(2); }
  else paginas.push(a);
}
function uso(cod) {
  console.error("uso: timeout 900 node tools/testar-missoes.js [--sem-analise] [--lints] [-q] pagina.html [outra.html…]\n" +
    "     timeout 3600 node tools/testar-missoes.js [-q] --todas");
  process.exit(cod);
}
if (todas) fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)).sort().forEach((f) => paginas.push(f));
if (!paginas.length) uso(2);

/* ------------------------------------------------------------- utilidades */
const decodificar = FlutSim.decodificarEntidades;
function atributos(s) {
  const r = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(s))) r[m[1].toLowerCase()] = decodificar(m[2] ?? m[3] ?? m[4] ?? "");
  return r;
}
function classes(at) { return (at["class"] || "").split(/\s+/).filter(Boolean); }
function trecho(s, i, n = 30) { return JSON.stringify(s.slice(Math.max(0, i - n), i + n).replace(/\s+/g, " ")); }
// o texto que o navegador (e o flutsim) enxerga dentro de um <pre>
function textoPre(cru) {
  const t = decodificar(cru.replace(/<[^>]*>/g, "")).replace(/^\n/, ""); // o parser de HTML come o 1º \n
  return FlutSim.limparPre(t);
}
const ENT_OK = new Set(["lt", "gt", "amp", "quot", "apos", "nbsp", "middot", "rarr", "larr", "uarr", "darr", "harr", "hellip", "mdash", "ndash", "laquo", "raquo", "copy", "deg", "times", "divide", "sect", "bull", "check", "ordm", "ordf", "lsquo", "rsquo", "ldquo", "rdquo", "shy", "zwj", "ne", "le", "ge", "euro"]);
function paginasNiveis() {
  try {
    const js = fs.readFileSync(path.join(RAIZ, "assets/site.js"), "utf8");
    const ini = js.indexOf("var NIVEIS"), fim = js.indexOf("\n];", ini);
    const set = new Set();
    for (const m of js.slice(ini, fim).matchAll(/\[\s*"([^"]+\.html)"/g)) set.add(m[1]);
    return set;
  } catch (e) { return null; }
}
const NIVEIS = paginasNiveis();

/* ------------------------------------------------------- leitura da página */
function analisarHtml(html) {
  const src = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
  const linhaDe = (i) => src.slice(0, i).split("\n").length;
  const problemas = [];

  const pres = [];
  const rePre = /<pre\b([^>]*)>([\s\S]*?)<\/pre\s*>/gi;
  let m;
  while ((m = rePre.exec(src))) {
    const at = atributos(m[1]);
    const ini = m.index + m[0].indexOf(">") + 1;
    pres.push({ at, cls: classes(at), cru: m[2], ini, fim: ini + m[2].length, linha: linhaDe(m.index) });
  }

  const reTagOk = /^<\/?(mark|b|strong|em|i|u|span|kbd|sup|sub|br|a)(\s+[\w-]+\s*=\s*("[^"]*"|'[^']*'))*\s*\/?>/i;
  for (const p of pres) {
    const nome = "<pre" + (p.at["class"] ? ' class="' + p.at["class"] + '"' : "") + ">";
    const codigoEditor = p.cls.includes("script") || p.cls.includes("solucao");
    let i = -1;
    while ((i = p.cru.indexOf("<", i + 1)) >= 0) {
      if (!codigoEditor && reTagOk.test(p.cru.slice(i))) continue;
      problemas.push({ grav: "FALHA", linha: linhaDe(p.ini + i), msg: '"<" sem escape dentro de ' + nome + " (escreva &lt;): " + trecho(p.cru, i) });
      break;
    }
    i = -1;
    while ((i = p.cru.indexOf("&", i + 1)) >= 0) {
      const ent = /^&(#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/.exec(p.cru.slice(i));
      if (ent && (ent[1][0] === "#" || ENT_OK.has(ent[1]))) continue;
      problemas.push(ent
        ? { grav: "FALHA", linha: linhaDe(p.ini + i), msg: "entidade " + ent[0] + " que o testador não conhece, dentro de " + nome + " (use &lt; &gt; &amp; &quot; ou o caractere direto)" }
        : { grav: "FALHA", linha: linhaDe(p.ini + i), msg: '"&" sem escape dentro de ' + nome + " (escreva &amp;): " + trecho(p.cru, i) });
      break;
    }
  }

  const caixas = [];
  const reDiv = /<div\b([^>]*)>/gi;
  while ((m = reDiv.exec(src))) {
    const at = atributos(m[1]);
    if (!classes(at).includes("tryflutter")) continue;
    const reTok = /<(\/?)div\b[^>]*>/gi;
    reTok.lastIndex = m.index + m[0].length;
    let prof = 1, t, fim = -1;
    while ((t = reTok.exec(src))) { prof += t[1] ? -1 : 1; if (!prof) { fim = t.index; break; } }
    const linha = linhaDe(m.index);
    if (fim < 0) { problemas.push({ grav: "FALHA", linha, msg: '<div class="tryflutter"> sem o </div> de fechamento' }); continue; }
    const ini = m.index + m[0].length;
    const dentro = pres.filter((p) => p.ini > ini && p.fim < fim);
    const tarefa = /class="[^"]*\btry-task\b/.test(src.slice(ini, fim));
    caixas.push({ at, linha, goal: at["data-goal"], tarefa, script: dentro.filter((p) => p.cls.includes("script")), solucao: dentro.filter((p) => p.cls.includes("solucao")) });
    dentro.forEach((p) => { p.naCaixa = true; });
  }
  pres.filter((p) => !p.naCaixa && (p.cls.includes("solucao") || p.cls.includes("script"))).forEach((p) => {
    problemas.push({ grav: "aviso", linha: p.linha, msg: '<pre class="' + p.at["class"] + '"> fora de uma caixa .tryflutter (o editor ignora)' });
  });
  for (const v of src.matchAll(/class="[^"]*\b(trylua|trypy|trysql|tryc|trycpp|tryhtml|trycs|tryscript|tryphp|tryjshell|trydart)\b/g))
    problemas.push({ grav: "FALHA", linha: linhaDe(v.index), msg: 'caixa "' + v[1] + '" é de outro guia: aqui é <div class="tryflutter">' });

  // código para ler que é um app completo: também passa pelo analisador
  const arquivos = pres.filter((p) => !p.naCaixa && p.cls.includes("file") && /\.dart$/.test(p.at["data-file"] || ""))
    .map((p) => ({ linha: p.linha, base: linhaBase(p), txt: textoPre(p.cru) }))
    .filter((f) => /\bvoid\s+main\s*\(/.test(f.txt) && /^import\s+'package:flutter\//m.test(f.txt));

  // fotos
  const fotos = [];
  for (const im of src.matchAll(/<img\b([^>]*)>/gi)) {
    const at = atributos(im[1]);
    if (at.src && !/^(https?:|data:)/.test(at.src)) fotos.push({ linha: linhaDe(im.index), src: at.src, alt: at.alt });
  }

  for (const l of src.matchAll(/\bhref\s*=\s*"([^"#?:]+\.html)(?:[#?][^"]*)?"/g)) {
    const alvo = l[1];
    if (NIVEIS && !NIVEIS.has(alvo) && !alvo.includes("/"))
      problemas.push({ grav: "aviso", linha: linhaDe(l.index), msg: 'link para "' + alvo + '", que não está na NIVEIS' });
  }
  const PROIBIDO = /\/home\/admin|\/home\/wallyson|wallyson(?!devs\.github\.io)|ip-172-\d|guia-[a-z]+-lab|\/tmp\/claude|\.cache\/guia-flutter/i;
  const PROIBIDO_EXTRA = (() => { try { return fs.readFileSync(path.join(os.homedir(), ".guia-proibido"), "utf8").split("\n").map((x) => x.trim()).filter(Boolean); } catch (e) { return []; } })();
  const linhasSrc = html.split("\n");
  for (let k = 0; k < linhasSrc.length; k++) {
    const p = PROIBIDO.exec(linhasSrc[k]) || PROIBIDO_EXTRA.map((x) => [x]).find((x) => linhasSrc[k].includes(x[0]));
    if (p) problemas.push({ grav: "FALHA", linha: k + 1, msg: 'dado da máquina real na página: "' + p[0] + '" (use só /home/ana e ana@notebook)' });
  }
  return { caixas, problemas, arquivos, fotos };
}

// linha do HTML onde fica a "linha 0" do código de um <pre> (a linha N do código = base + N)
function linhaBase(p) { return p.linha - 1 + (/^\r?\n/.test(p.cru) ? 1 : 0); }

/* ---------------------------------------------------- o analisador do Flutter */
let modeloPronto = null;
function prepararModelo() {
  if (modeloPronto !== null) return modeloPronto;
  const flutter = path.join(FLUTTER_BIN, "flutter");
  if (!fs.existsSync(flutter)) return (modeloPronto = "Flutter não encontrado em " + FLUTTER_BIN + " (FLUTTER_BIN=…)");
  if (!fs.existsSync(path.join(MODELO, "pubspec.yaml"))) {
    fs.mkdirSync(path.dirname(MODELO), { recursive: true });
    const r = spawnSync(flutter, ["create", "--offline", "-e", "--platforms=web", "--project-name", "modelo", MODELO], { encoding: "utf8", timeout: 300000 });
    if (r.status !== 0) return (modeloPronto = "flutter create falhou: " + (r.stderr || r.stdout || "").slice(-300));
  }
  return (modeloPronto = "");
}
// os pacotes do DartPad que o código usa entram no projeto modelo (flutter pub add, uma vez)
function garantirPacotes(nomes) {
  const pub = fs.readFileSync(path.join(MODELO, "pubspec.yaml"), "utf8");
  const faltam = [...new Set(nomes)].filter((n) => n !== "flutter" && FlutSim.PACOTES_DARTPAD.includes(n) && !new RegExp("^\\s+" + n + ":", "m").test(pub));
  if (!faltam.length) return "";
  const r = spawnSync(path.join(FLUTTER_BIN, "flutter"), ["pub", "add", ...faltam], { cwd: MODELO, encoding: "utf8", timeout: 300000 });
  return r.status === 0 ? "" : "flutter pub add " + faltam.join(" ") + " falhou: " + (r.stderr || r.stdout || "").trim().split("\n").slice(-2).join(" ");
}
// itens: [{chave, txt}] → {chave: [{sev, cod, linha, col, msg}]}
let nAnalise = 0;
function analisarDart(itens) {
  const pasta = path.join(MODELO, "lib", "guia_" + process.pid + "_" + (++nAnalise));
  fs.mkdirSync(pasta, { recursive: true });
  const nomes = {};
  itens.forEach((it, i) => { const n = "c" + i + ".dart"; nomes[n] = it.chave; fs.writeFileSync(path.join(pasta, n), it.txt); });
  try {
    const r = spawnSync(path.join(FLUTTER_BIN, "dart"), ["analyze", "--format=machine", pasta], { cwd: MODELO, encoding: "utf8", timeout: 300000, env: Object.assign({}, process.env, { CI: "true" }) });
    if (r.error) throw r.error;
    const res = {};
    itens.forEach((it) => { res[it.chave] = []; });
    for (const l of (r.stderr + "\n" + r.stdout).split("\n")) {
      const c = l.split("|");
      if (c.length < 8 || !/^(ERROR|WARNING|INFO)$/.test(c[0])) continue;
      const chave = nomes[path.basename(c[3])];
      if (chave === undefined) continue;
      res[chave].push({ sev: c[0], cod: c[2].toLowerCase(), linha: +c[4], col: +c[5], msg: c.slice(7).join("|").trim() });
    }
    return res;
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------ uma página */
function testarPagina(arq) {
  const html = fs.readFileSync(arq, "utf8");
  const nomePag = path.basename(arq);
  const { caixas, problemas, arquivos, fotos } = analisarHtml(html);
  const itens = problemas.slice();
  const paraAnalisar = [];

  for (const im of fotos) {
    const caminho = path.join(path.dirname(arq), im.src.split(/[?#]/)[0]);
    if (!fs.existsSync(caminho)) itens.push({ grav: "FALHA", linha: im.linha, msg: "imagem " + im.src + " não existe (mandou e commitou a foto?)" });
    if (!im.alt) itens.push({ grav: "aviso", linha: im.linha, msg: "imagem " + im.src + " sem alt" });
  }

  caixas.forEach((cx, k) => {
    const nome = "caixa " + (k + 1);
    const L = cx.linha;
    if (cx.script.length !== 1) { itens.push({ grav: "FALHA", linha: L, msg: nome + ": precisa de exatamente um <pre class=\"script\" data-file=\"main.dart\"> (tem " + cx.script.length + ")" }); return; }
    const df = cx.script[0].at["data-file"];
    if (df !== "main.dart") itens.push({ grav: "FALHA", linha: L, msg: nome + ': o pre.script precisa de data-file="main.dart" (tem ' + JSON.stringify(df || "") + ")" });
    const inicial = textoPre(cx.script[0].cru);
    if (!/^import\s+'package:flutter\//m.test(inicial) || !/\bvoid\s+main\s*\(/.test(inicial))
      itens.push({ grav: "FALHA", linha: L, msg: nome + ": o main.dart precisa ser um app completo (import 'package:flutter/…' e void main)" });
    if (cx.solucao.length > 1) itens.push({ grav: "FALHA", linha: L, msg: nome + ": mais de um pre.solucao" });
    const solucao = cx.solucao.length ? textoPre(cx.solucao[0].cru) : null;
    paraAnalisar.push({ chave: k + ":inicial", txt: inicial, linha: linhaBase(cx.script[0]), nome: nome + " (código inicial)" });
    if (solucao !== null) paraAnalisar.push({ chave: k + ":solucao", txt: solucao, linha: linhaBase(cx.solucao[0]), nome: nome + " (solução)" });
    const foto = cx.at["data-foto"];
    if (foto && !fs.existsSync(path.join(path.dirname(arq), foto))) itens.push({ grav: "FALHA", linha: L, msg: nome + ": data-foto " + foto + " não existe" });
    if (foto && !(cx.at["data-foto-alt"] || "").trim()) itens.push({ grav: "FALHA", linha: L, msg: nome + ": data-foto sem data-foto-alt (descreva a foto, depois de olhar para ela)" });
    for (const [qual, txt] of [["código inicial", inicial], ["solução", solucao]]) {
      if (txt === null) continue;
      const imp = FlutSim.importsDe(txt);
      imp.pacotes.filter((n) => !FlutSim.PACOTES_DARTPAD.includes(n)).forEach((n) =>
        itens.push({ grav: "FALHA", linha: L, msg: nome + " (" + qual + "): import 'package:" + n + "/…' não existe no DartPad (só os pacotes de FlutSim.PACOTES_DARTPAD); mostre no lab" }));
      imp.dart.filter((n) => ["io", "ffi", "isolate", "mirrors", "cli"].includes(n)).forEach((n) =>
        itens.push({ grav: "FALHA", linha: L, msg: nome + " (" + qual + "): import 'dart:" + n + "' não funciona no DartPad (o app roda na web); mostre no lab" }));
    }
    if (cx.at["data-altura"] && !/^\d{3,4}$/.test(cx.at["data-altura"])) itens.push({ grav: "FALHA", linha: L, msg: nome + ": data-altura é um número em pixels (ex.: 600)" });

    const goal = cx.goal;
    if (goal === undefined || !goal.trim()) {
      if (solucao !== null) itens.push({ grav: "aviso", linha: L, msg: nome + ": tem pre.solucao mas não tem data-goal (a missão nunca é conferida)" });
      itens.push({ grav: "ok", linha: L, msg: nome + ": caixa livre (sem missão)" });
      return;
    }
    const probs = FlutSim.validarMeta(goal);
    if (probs.length) { probs.forEach((p) => itens.push({ grav: "FALHA", linha: L, msg: nome + ": " + p })); return; }
    if (!cx.tarefa) itens.push({ grav: "aviso", linha: L, msg: nome + ': missão sem <p class="try-task"> explicando o que fazer' });
    if (solucao === null) { itens.push({ grav: "FALHA", linha: L, msg: nome + ": missão sem <pre class=\"solucao\">" }); return; }
    const fIni = FlutSim.checarMeta(goal, inicial), fSol = FlutSim.checarMeta(goal, solucao);
    if (!fIni.length) itens.push({ grav: "FALHA", linha: L, msg: nome + ": o código INICIAL já cumpre a missão (" + goal + ")" });
    if (fSol.length) itens.push({ grav: "FALHA", linha: L, msg: nome + ": a SOLUÇÃO não cumpre: " + fSol.join(" ;; ") });
    if (!fIni.length || fSol.length) return;
    itens.push({ grav: "ok", linha: L, msg: nome + ": inicial não cumpre, solução cumpre (" + goal + ")" });
  });
  arquivos.forEach((f, i) => paraAnalisar.push({ chave: "file:" + i, txt: f.txt, linha: f.base, nome: "pre.file da linha " + f.linha }));

  if (analise && paraAnalisar.length) {
    const prob = prepararModelo();
    if (prob) itens.push({ grav: "aviso", linha: 1, msg: "sem análise do Dart: " + prob });
    else {
      const pp = garantirPacotes(paraAnalisar.flatMap((it) => FlutSim.importsDe(it.txt).pacotes));
      if (pp) itens.push({ grav: "aviso", linha: 1, msg: "análise sem alguns pacotes: " + pp });
      const res = analisarDart(paraAnalisar);
      for (const it of paraAnalisar) {
        const lista = res[it.chave] || [];
        const erros = lista.filter((d) => d.sev === "ERROR"), avisos = lista.filter((d) => d.sev === "WARNING"), dicas = lista.filter((d) => d.sev === "INFO");
        // o código inicial de uma missão pode estar errado de propósito? Só se a aula disser: data-erro-proposital
        const proposital = it.chave.endsWith(":inicial") && caixas[+it.chave.split(":")[0]].at["data-erro-proposital"] !== undefined;
        erros.forEach((d) => itens.push({ grav: proposital ? "ok" : "FALHA", linha: it.linha + d.linha, msg: it.nome + ": não compila: " + d.msg + " [" + d.cod + "]" + (proposital ? " (erro de propósito: data-erro-proposital)" : "") }));
        if (proposital && !erros.length) itens.push({ grav: "FALHA", linha: it.linha + 1, msg: it.nome + ": data-erro-proposital, mas o código compila" });
        avisos.forEach((d) => itens.push({ grav: "aviso", linha: it.linha + d.linha, msg: it.nome + ": aviso do analisador: " + d.msg + " [" + d.cod + "]" }));
        if (lints) dicas.forEach((d) => itens.push({ grav: "aviso", linha: it.linha + d.linha, msg: it.nome + ": dica do analisador: " + d.msg + " [" + d.cod + "]" }));
        if (!erros.length && !proposital) itens.push({ grav: "ok", linha: it.linha + 1, msg: it.nome + ": compila (dart analyze: " + avisos.length + " aviso(s), " + dicas.length + " dica(s))" });
      }
    }
  }

  if (nomePag !== "simulador.html" && nomePag !== "index.html" && !/^(ref-|projeto-)/.test(nomePag)) {
    if (!caixas.length) itens.push({ grav: "aviso", linha: 1, msg: "nenhuma caixa .tryflutter; a §2 pede pelo menos um Experimente por aula" });
    else if (!caixas.some((c) => c.goal && c.goal.trim())) itens.push({ grav: "aviso", linha: 1, msg: "nenhuma caixa é missão (data-goal)" });
  }
  return { itens: itens.sort((a, b) => a.linha - b.linha) };
}

/* ------------------------------------------------------------- principal */
function achar(p) {
  const cands = [p, path.join(RAIZ, p), path.join(RAIZ, path.basename(p))];
  return cands.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}
let totFalha = 0, totAviso = 0, totOk = 0, faltando = 0;
const ruins = [];
for (const p of paginas) {
  const arq = achar(p);
  console.log("== " + p);
  if (!arq) { console.log("  FALHA  página não encontrada (mandou com o enviar?)"); faltando++; ruins.push(p); continue; }
  let r;
  try { r = testarPagina(arq); }
  catch (e) { console.log("  FALHA  erro do testador: " + (e.stack || e)); totFalha++; ruins.push(p); continue; }
  const c = { ok: 0, FALHA: 0, aviso: 0 };
  for (const it of r.itens) {
    c[it.grav]++;
    if (quieto && it.grav === "ok") continue;
    console.log("  " + (it.grav + "      ").slice(0, 6) + " linha " + it.linha + ": " + it.msg.replace(/\n/g, "↵"));
  }
  console.log("  -> " + c.ok + " ok, " + c.FALHA + " FALHA, " + c.aviso + " aviso");
  totOk += c.ok; totFalha += c.FALHA; totAviso += c.aviso;
  if (c.FALHA) ruins.push(p);
}
if (paginas.length > 1)
  console.log("\nTOTAL: " + paginas.length + " página(s), " + totOk + " ok, " + totFalha + " FALHA, " + totAviso + " aviso" + (ruins.length ? "\ncom FALHA: " + ruins.join(" ") : ""));
if (analise) {
  const v = spawnSync(path.join(FLUTTER_BIN, "dart"), ["--version"], { encoding: "utf8" });
  console.log("(análise: " + ((v.stdout || v.stderr || "").trim() || "Dart ?") + ", do Flutter da VPS)");
}
process.exitCode = faltando ? 2 : totFalha ? 1 : 0;
