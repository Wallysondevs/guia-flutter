/* =====================================================================
   flutsim.js — o "Experimente" do Guia Flutter.
   O app roda no DartPad oficial (dartpad.dev, o mesmo que a documentação
   do Flutter usa), embutido na caixa: o código do editor do guia é enviado
   para o DartPad (postMessage {type:"sourceCode"}) e é compilado pelos
   servidores do DartPad, do Google. Nada é carregado antes do 1º "Rodar".

   Monta as caixas  <div class="tryflutter" data-goal="…" data-foto="…" data-altura="…">
   (contrato: CONTRIBUINDO.md, seções 3 e 4).
   Também roda no Node: tools/testar-missoes.js usa as funções puras daqui.
   ===================================================================== */
(function () {
  "use strict";
  var DARTPAD = "https://dartpad.dev";
  var ESPERA_MAX = 30000;   // ms esperando o DartPad dizer "ready"
  var FlutSim = { DARTPAD: DARTPAD, ESPERA_MAX: ESPERA_MAX };

  /* =====================================================================
     1. Funções puras (navegador e Node)
     ===================================================================== */
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  FlutSim.escHtml = escHtml;

  var ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bull: "•", middot: "·", deg: "°", times: "×", rarr: "→", larr: "←", check: "✓", copy: "©" };
  function decodificarEntidades(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, function (t, n) {
      if (n.charAt(0) === "#") {
        var c = n.charAt(1).toLowerCase() === "x" ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
        try { return String.fromCodePoint(c); } catch (e) { return t; }
      }
      return Object.prototype.hasOwnProperty.call(ENTIDADES, n) ? ENTIDADES[n] : t;
    });
  }
  FlutSim.decodificarEntidades = decodificarEntidades;

  /* O código Dart sem os comentários (// … e /* … *\/), com as strings intactas.
     As metas src:/nsrc: olham este texto: um trecho comentado não cumpre missão. */
  function semComentarios(cod) {
    var s = String(cod), r = "", i = 0, n = s.length;
    while (i < n) {
      var c = s[i], d = s[i + 1];
      if (c === "/" && d === "/") { while (i < n && s[i] !== "\n") i++; continue; }
      if (c === "/" && d === "*") {
        var prof = 1; i += 2;
        while (i < n && prof) {
          if (s[i] === "/" && s[i + 1] === "*") { prof++; i += 2; }
          else if (s[i] === "*" && s[i + 1] === "/") { prof--; i += 2; }
          else { if (s[i] === "\n") r += "\n"; i++; }
        }
        r += " ";
        continue;
      }
      var cru = false;
      if (c === "r" && (d === "'" || d === '"') && !/[A-Za-z0-9_$]/.test(s[i - 1] || "")) { cru = true; r += c; i++; c = d; }
      if (c === "'" || c === '"') {
        var q = s.substr(i, 3) === c + c + c ? c + c + c : c, j = i + q.length;
        while (j < n) {
          if (!cru && s[j] === "\\") { j += 2; continue; }
          if (s.substr(j, q.length) === q) { j += q.length; break; }
          if (q.length === 1 && s[j] === "\n") break;
          j++;
        }
        r += s.slice(i, j); i = j;
        continue;
      }
      r += c; i++;
    }
    return r;
  }
  FlutSim.semComentarios = semComentarios;

  /* Metas (data-goal), separadas por ";;":
       src:REGEX   o código do leitor (sem comentários) casa com a regex (flag m)
       nsrc:REGEX  o código do leitor NÃO casa com a regex                        */
  var META_NOMES = ["src", "nsrc"];
  FlutSim.META_NOMES = META_NOMES;
  function dividirMetas(meta) {
    return String(meta || "").split(";;").map(function (x) { return x.replace(/^\s+/, ""); }).filter(Boolean);
  }
  FlutSim.dividirMetas = dividirMetas;
  function partesMeta(g) {
    var i = g.indexOf(":");
    return { tipo: (i < 0 ? g : g.slice(0, i)).trim(), val: i < 0 ? "" : g.slice(i + 1), temValor: i >= 0 };
  }
  FlutSim.partesMeta = partesMeta;

  function validarMeta(meta) {
    var probs = [];
    var lista = dividirMetas(meta);
    if (!lista.length) probs.push("data-goal vazio");
    lista.forEach(function (g) {
      var p = partesMeta(g);
      if (META_NOMES.indexOf(p.tipo) < 0) { probs.push("meta desconhecida \"" + p.tipo + "\" em \"" + g + "\" (só " + META_NOMES.join(", ") + ")"); return; }
      if (!p.val) { probs.push("meta sem valor: \"" + g + "\""); return; }
      try { new RegExp(p.val, "m"); } catch (e) { probs.push("regex inválida em \"" + g + "\": " + e.message); }
    });
    if (lista.length && lista.every(function (g) { return partesMeta(g).tipo === "nsrc"; }))
      probs.push("só metas nsrc: (o código inicial \"cumpre\" ao apagar tudo); junte um src:");
    return probs;
  }
  FlutSim.validarMeta = validarMeta;

  /* → lista das metas que falharam ([] = missão cumprida) */
  function checarMeta(meta, codigo) {
    var limpo = semComentarios(codigo);
    var falhas = [];
    dividirMetas(meta).forEach(function (g) {
      var p = partesMeta(g), ok = false;
      try {
        if (p.tipo === "src") ok = new RegExp(p.val, "m").test(limpo);
        else if (p.tipo === "nsrc") ok = !new RegExp(p.val, "m").test(limpo);
      } catch (e) { ok = false; }
      if (!ok) falhas.push(g);
    });
    return falhas;
  }
  FlutSim.checarMeta = checarMeta;

  /* O texto de um <pre> como o editor recebe: sem o 1º e o último \n. */
  function limparPre(t) { return String(t).replace(/^\n/, "").replace(/\n$/, ""); }
  FlutSim.limparPre = limparPre;

  /* Pacotes que o DartPad aceita (stable.api.dartpad.dev/api/v3/version, 19/10/2026: Flutter 3.47.7).
     Um import 'package:X/…' fora desta lista não compila no DartPad. */
  var PACOTES_DARTPAD = ("flutter animated_to animations async basics bloc characters collection convert creator cross_file dartz dio " +
    "dio_web_adapter english_words equatable fast_immutable_collections fl_chart flame flame_fire_atlas flame_forge2d " +
    "flame_splash_screen flame_tiled flutter_adaptive_scaffold flutter_bloc flutter_hooks flutter_map flutter_markdown " +
    "flutter_riverpod flutter_svg go_router google_fonts google_generative_ai hooks_riverpod http intl lints matcher meta mix " +
    "path petitparser provider quiver riverpod rohd rohd_vf rxdart shared_preferences signals stack_trace timezone typed_data " +
    "url_launcher vector_math video_player web yaml yaml_edit").split(" ");
  FlutSim.PACOTES_DARTPAD = PACOTES_DARTPAD;
  /* → { pacotes: ["provider", …], dart: ["async", "io", …] } (os imports do código) */
  function importsDe(cod) {
    var r = { pacotes: [], dart: [] }, m, re = /^\s*import\s+['"](package|dart):([A-Za-z0-9_]+)/gm;
    var limpo = semComentarios(cod);
    while ((m = re.exec(limpo))) {
      var lista = m[1] === "package" ? r.pacotes : r.dart;
      if (lista.indexOf(m[2]) < 0) lista.push(m[2]);
    }
    return r;
  }
  FlutSim.importsDe = importsDe;

  /* O endereço do DartPad embutido */
  function urlDartPad(tema) {
    return DARTPAD + "/?embed=true&run=true&theme=" + (tema === "dark" ? "dark" : "light");
  }
  FlutSim.urlDartPad = urlDartPad;

  if (typeof module !== "undefined" && module.exports) { module.exports = FlutSim; return; }
  if (typeof document === "undefined") return;

  /* =====================================================================
     2. As caixas (navegador)
     ===================================================================== */
  window.FlutSim = FlutSim;
  FlutSim.caixas = [];

  var CSS = [
    ".tryflutter{margin:22px 0;padding:4px 18px 14px;border:2px dashed var(--accent);border-radius:10px}",
    ".tryflutter pre.script,.tryflutter pre.solucao{display:none}",
    ".fs-win{margin:8px 0 10px;border-radius:10px;overflow:hidden;background:#1e1e22;box-shadow:0 2px 10px rgba(0,0,0,.18)}",
    ".fs-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 10px;background:#2b2b30;color:#d4d4d8;font:13px system-ui,sans-serif}",
    ".fs-aba{padding:2px 10px;border-radius:5px 5px 0 0;background:#1e1e22;color:#fff;font:13px ui-monospace,Menlo,Consolas,monospace}",
    ".fs-esp{flex:1}",
    ".fs-ed{display:block;box-sizing:border-box;width:100%;min-height:180px;margin:0;padding:10px 14px;border:0;outline:0;resize:vertical;background:#1e1e22;color:#eeeeec;caret-color:#f0805f;font:14px/1.5 'Ubuntu Mono',ui-monospace,Menlo,Consolas,monospace;tab-size:2;white-space:pre;overflow:auto}",
    ".fs-acoes{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0}",
    ".fs-aviso{margin:6px 0;font-size:.9rem;color:var(--muted)}",
    ".fs-tela{margin:10px 0 0;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--example-bg)}",
    ".fs-tela iframe{display:block;width:100%;border:0;background:#fff}",
    ".fs-msg{margin:0;padding:14px 16px;color:var(--text)}",
    ".fs-msg.erro{color:var(--bad)}",
    ".fs-foto{margin:10px 0 0;text-align:center}",
    ".fs-foto img{max-width:100%;max-height:520px;height:auto;border:1px solid var(--border);border-radius:12px}",
    ".fs-foto figcaption{font-size:.9rem;color:var(--muted)}",
    ".fs-sol pre{margin:0 0 10px;padding:8px 12px;border-radius:6px;background:var(--code-bg);color:var(--code-text);overflow:auto;font:13.5px/1.45 ui-monospace,Menlo,Consolas,monospace}",
    "@media (max-width:600px){.tryflutter{padding:4px 10px 12px}}"
  ].join("\n");

  function el(tag, at, filhos) {
    var e = document.createElement(tag);
    if (at) Object.keys(at).forEach(function (k) {
      if (k === "texto") e.textContent = at[k];
      else if (k === "html") e.innerHTML = at[k];
      else e.setAttribute(k, at[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(f); });
    return e;
  }
  function temaAtual() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function copiar(txt, depois) {
    function velho() {
      var a = el("textarea"); a.value = txt; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      try { document.execCommand("copy"); } catch (e) {}
      a.remove(); depois && depois();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(depois, velho);
    else velho();
  }

  // a mensagem "ready" do DartPad traz sender = o name do iframe
  var esperando = {};
  window.addEventListener("message", function (ev) {
    if (ev.origin !== DARTPAD || !ev.data || ev.data.type !== "ready") return;
    Object.keys(esperando).forEach(function (id) {
      var cx = esperando[id];
      if (ev.data.sender === id || (cx.iframe && ev.source === cx.iframe.contentWindow)) { delete esperando[id]; cx.pronto(); }
    });
  });

  var seq = 0;
  function montar(box) {
    if (box.getAttribute("data-montada")) return;
    box.setAttribute("data-montada", "1");
    var preS = box.querySelector("pre.script"), preSol = box.querySelector("pre.solucao");
    var inicial = preS ? limparPre(preS.textContent) : "";
    var solucao = preSol ? limparPre(preSol.textContent) : null;
    var nomeArq = (preS && preS.getAttribute("data-file")) || "main.dart";
    var meta = box.getAttribute("data-goal") || "";
    var foto = box.getAttribute("data-foto");
    var altura = parseInt(box.getAttribute("data-altura"), 10) || 520;
    var id = "guia-dartpad-" + (++seq);

    var ed = el("textarea", { "class": "fs-ed", spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": "Código do " + nomeArq, wrap: "off" });
    ed.value = inicial;
    ed.rows = Math.min(30, Math.max(8, inicial.split("\n").length + 1));
    ed.addEventListener("keydown", function (e) {
      if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        var a = ed.selectionStart, b = ed.selectionEnd;
        ed.value = ed.value.slice(0, a) + "  " + ed.value.slice(b);
        ed.selectionStart = ed.selectionEnd = a + 2;
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rodar(); }
    });

    var bRodar = el("button", { "class": "sim-btn2", type: "button", texto: "▶ Rodar" });
    var bRest = el("button", { "class": "sim-btn2 secundario", type: "button", texto: "↺ Restaurar" });
    var bSol = solucao !== null ? el("button", { "class": "sim-btn2 secundario", type: "button", texto: "Ver solução" }) : null;
    var bCopiar = el("button", { "class": "sim-btn", type: "button", texto: "Copiar" });
    var win = el("div", { "class": "fs-win" }, [
      el("div", { "class": "fs-bar" }, [el("span", { "class": "fs-aba", texto: nomeArq }), el("span", { "class": "fs-esp" }), bCopiar]),
      ed
    ]);
    var status = el("p", { "class": "sim-status", "aria-live": "polite" });
    var acoes = el("div", { "class": "fs-acoes" }, [bRodar, bRest, bSol]);
    var aviso = el("p", { "class": "fs-aviso", texto: "Ao clicar em Rodar, o código vai para o DartPad (dartpad.dev), do Google, e é compilado pelos servidores dele: precisa de internet. O DartPad abre aqui embaixo com o app rodando (e uma cópia do código, que você pode mexer lá também; a missão confere o editor de cima)." });
    var tela = el("div", { "class": "fs-tela", hidden: "" });
    var sol = null;

    var depois = preS ? preS : box.querySelector(".try-task");
    var frag = [win, acoes, status, aviso, tela];
    if (foto) frag.push(el("figure", { "class": "fs-foto" }, [
      el("img", { src: foto, alt: box.getAttribute("data-foto-alt") || "Como a tela deve ficar quando a missão estiver cumprida", loading: "lazy" }),
      el("figcaption", { texto: "Como deve ficar (foto do app, tirada no laboratório do guia)." })
    ]));
    var ref = depois ? depois.nextSibling : null;
    frag.forEach(function (n) { box.insertBefore(n, ref); });

    var cx = { el: box, id: id, meta: meta, inicial: inicial, solucao: solucao, iframe: null, prontoJa: false, fila: null, timer: null };
    cx.codigo = function () { return ed.value; };
    cx.definir = function (t) { ed.value = t; };
    cx.conferir = function (txt) { return meta ? checarMeta(meta, txt === undefined ? ed.value : txt) : []; };
    cx.testar = function (qual) {
      var txt = qual === "solucao" ? solucao : qual === "inicial" ? inicial : ed.value;
      var f = cx.conferir(txt || "");
      return { ok: !f.length, falhas: f };
    };

    function mostrarStatus() {
      if (!meta) { status.textContent = ""; status.className = "sim-status"; return; }
      var f = cx.conferir();
      if (!f.length) { status.textContent = "✔ Missão cumprida!"; status.className = "sim-status ok"; }
      else { status.textContent = "Missão em andamento… (o código ainda não tem o que a missão pede)"; status.className = "sim-status"; }
    }
    function msg(texto, erro) {
      tela.hidden = false;
      var p = tela.querySelector(".fs-msg");
      if (!p) { p = el("p", { "class": "fs-msg" }); tela.insertBefore(p, tela.firstChild); }
      p.className = "fs-msg" + (erro ? " erro" : "");
      p.textContent = texto;
      p.hidden = !texto;
    }
    function enviar() {
      var w = cx.iframe && cx.iframe.contentWindow;
      if (!w) return;
      w.postMessage({ sourceCode: cx.fila, type: "sourceCode" }, DARTPAD);
      cx.fila = null;
      msg("");
    }
    cx.pronto = function () {
      cx.prontoJa = true;
      clearTimeout(cx.timer);
      if (cx.fila !== null) enviar();
    };
    function falhouDartPad() {
      if (cx.prontoJa) return;
      delete esperando[id];
      msg("O DartPad não respondeu em " + (ESPERA_MAX / 1000) + " segundos (sem internet, ou o serviço do Google está fora do ar). " +
        "Use o botão Copiar e cole o código em dartpad.dev, ou rode no seu computador (aula Instalar o Flutter)." + (foto ? " A foto abaixo mostra como deve ficar." : ""), true);
      bRodar.disabled = false;
    }
    function rodar() {
      mostrarStatus();
      cx.fila = ed.value;
      if (!cx.iframe) {
        tela.hidden = false;
        msg("Abrindo o DartPad e compilando… (a 1ª vez leva alguns segundos)");
        cx.iframe = el("iframe", { name: id, title: "DartPad: o app " + nomeArq + " rodando", src: urlDartPad(temaAtual()), allow: "clipboard-write", loading: "eager" });
        cx.iframe.style.height = altura + "px";
        tela.appendChild(cx.iframe);
        esperando[id] = cx;
        cx.timer = setTimeout(falhouDartPad, ESPERA_MAX);
      } else if (cx.prontoJa) enviar();
      // mostra o app: rola até o DartPad se ele estiver fora da tela (no celular ele fica abaixo do editor)
      var r = tela.getBoundingClientRect();
      if (r.top > window.innerHeight - 120 && tela.scrollIntoView) tela.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    cx.rodar = rodar;

    bRodar.addEventListener("click", rodar);
    bRest.addEventListener("click", function () { ed.value = inicial; status.textContent = ""; status.className = "sim-status"; });
    bCopiar.addEventListener("click", function () { copiar(ed.value, function () { bCopiar.textContent = "Copiado!"; setTimeout(function () { bCopiar.textContent = "Copiar"; }, 1500); }); });
    if (bSol) bSol.addEventListener("click", function () {
      if (sol) { sol.remove(); sol = null; bSol.textContent = "Ver solução"; return; }
      var usar = el("button", { "class": "sim-btn2", type: "button", texto: "Usar no editor" });
      sol = el("div", { "class": "sim-sol fs-sol" }, [el("p", { "class": "sim-sol-tit", texto: "Uma solução:" }), el("pre", { texto: solucao }), usar]);
      usar.addEventListener("click", function () { ed.value = solucao; mostrarStatus(); });
      acoes.parentNode.insertBefore(sol, status.nextSibling);
      bSol.textContent = "Esconder solução";
    });
    FlutSim.caixas.push(cx);
    return cx;
  }
  FlutSim.montar = montar;

  function iniciar() {
    if (!document.getElementById("flutsim-css")) document.head.appendChild(el("style", { id: "flutsim-css", texto: CSS }));
    Array.prototype.forEach.call(document.querySelectorAll(".tryflutter"), montar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
