# Como escrever uma página do Guia Flutter

O guia é uma **escola**, estilo W3Schools, para quem já fez o básico de Dart (o Guia Dart: `https://wallysondevs.github.io/guia-dart/`) mas **nunca fez um app**. **Uma aula = um assunto** (um widget ou uma ideia). Nunca mostre código "seco":
- explique cada parte (anatomia: o widget, os parâmetros, o `child`/`children`);
- mostre **a tela real** que o código desenha (foto tirada de um Flutter de verdade, §5) e **a saída real** do terminal (`flutter create`, `flutter run`, erros);
- mostre **a árvore de widgets** quando ajudar (um `pre` simples com a hierarquia);
- mostre o que acontece quando dá errado: a tela vermelha/amarela, o erro de overflow, a mensagem **real** do console;
- deixe o leitor praticar no editor do guia (§4).

Antes de tudo, leia o `RECURSOS.md`.

## 0. O que o guia ensina
- **Flutter 3 (a versão estável do lab) com Material 3**, para Android em primeiro lugar; iOS, web e desktop aparecem nas aulas de build.
- Gerência de estado: `setState` primeiro; Provider/Riverpod/BLoC como visão geral no nível 3.
- O que depende de aparelho de verdade (câmera, GPS, notificações, emulador) é **ilustrativo** quando não der para conferir no lab.

## 1. Esqueleto do arquivo
Use como modelo uma aula do Guia Lua (`~/guia-lua/print.html`, na VPS): cabeçalho, `<main>`, blocos, rodapé, `.exercise`, `.mc`, `dl.anatomy`, `div.cenario`, `div.note`, `table.ref`. Troque:
- `<title>Flutter TEMA — descrição | Guia Flutter</title>`;
- `<h1>Flutter <span class="hl">TEMA</span></h1>`;
- a caixa `.trylua` por **`.tryflutter`** (§4).

Menu, selo e Anterior/Próximo vêm de `assets/site.js` (`NIVEIS`). **Não mude a `NIVEIS`.** Links internos só para páginas que estão nela.

## 2. Ordem de uma aula
1. Intro. 2. "Você vai aprender". 3. A ideia antes do código (uma comparação do dia a dia: blocos de montar, caixas dentro de caixas). 4. Do simples ao completo, uma novidade por vez, com `dl.anatomy`. 5. **A tela real** depois de cada exemplo (`figure` com a foto). 6. **Pelo menos um "Experimente"** (`.tryflutter`) por aula. 7. Formas diferentes de fazer + "qual usar". 8. **Quando dá errado** (`div.cenario`): o código errado, a tela/erro real (overflow com as listras amarelas e pretas, a tela vermelha de erro, a mensagem do console) e como resolver. 9. Referência (`table.ref`). 10. Exercícios (3 ou mais). 11. Resumo.

## 3. Componentes

### Código para ler
```html
<pre class="file" data-file="lib/main.dart">import 'package:flutter/material.dart';

void main() =&gt; runApp(const MeuApp());
</pre>
```
Escape `<`, `>` e `&` dentro de `<pre>` (`=&gt;`, `List&lt;Widget&gt;`, `&amp;&amp;`). O testador confere.

### A tela do app (`figure`)
```html
<figure class="tela"><img src="assets/telas/text-1.png" alt="Tela do app com o título 'Receitas da Ana' no topo, em azul, e o texto 'Bolo de cenoura' no meio" width="390" height="844" loading="lazy"><figcaption>O app rodando (Flutter 3.x, Android em tamanho de celular).</figcaption></figure>
```
- A foto vem do **lab** (§5): o código exato do `pre.file` ao lado, compilado e fotografado. **Olhe a foto (Read) antes de escrever o `alt` e o texto que a descreve.** Em guias anteriores, autores descreveram imagens que não existiam.
- Arquivo em `assets/telas/NOME-PAGINA-N.png` (PNG otimizado; o lab já reduz). Envie a imagem com `enviar` e commite junto com a página.

### Terminal (`pre.term`)
`$ ` = `ana@notebook:~$`; `«` = anotação. Toda saída vem do lab (`flutter create`, `flutter run`, `flutter doctor`, erros do console).

### Editor "Experimente" (`.tryflutter`)
O contrato exato fica na §4 (o agente do simulador está definindo). Escreva por enquanto assim:
```html
<div class="tryflutter" data-goal="src:Text\('Receitas da Ana'\)">
<p class="try-task"><strong>Missão:</strong> troque o título para "Receitas da Ana".</p>
<pre class="script" data-file="main.dart">…app completo, que roda sozinho…</pre>
<pre class="solucao" data-file="main.dart">…</pre>
</div>
```
- Sempre um **app completo** num único `main.dart` (com `import` e `main`), que rode como está.
- Até a §4 dizer outra coisa, use metas `src:REGEX` (o código do leitor casa com a regex) e mostre a **foto** do resultado esperado logo abaixo da missão.

### Outros blocos
`dl.anatomy`, `div.note/.tip/.warning/.cenario`, `ol.passo`, `div.table-wrap > table.ref`, `.exercise`, `.mc`, `<span class="versao">Flutter 3.x</span>`.

## 4. O editor do guia (`assets/flutsim.js`)
> **Esta seção é mantida pelo agente do simulador.** Antes de escrever uma frase do tipo "no editor…", confira aqui.

(em construção)

## 5. Fidelidade: o laboratório (`~/guia-flutter-lab/`, na VPS)
Flutter estável real (versão no `COMO-USAR.md` do lab), com:
- **foto da tela**: compila um `main.dart` e devolve a foto do app em tamanho de celular (e de tablet/desktop quando a aula pedir);
- **terminal da Ana** (`ana@notebook`): `flutter create`, `flutter run` (web/servidor), `flutter doctor`, `flutter analyze`, `flutter test`, as mensagens de erro reais;
- **as mensagens do Flutter saem em inglês**: copie como saíram e explique em português;
- **Privacidade:** nada da VPS (o `flutter doctor` mostra caminhos e o sistema: só `/home/ana`, notebook; o que identificar a máquina vira ilustrativo).

## 6. Escrita
- Português do Brasil, frases curtas, "você". O leitor sabe Dart básico, nunca fez app.
- Termos em inglês ganham tradução: *widget* = "componente/peça da tela", *child* = "filho", *state* = "estado", *hot reload* = "recarga a quente".
- Exemplos com a vida da Ana: o app de receitas, a lojinha, a lista de compras.
- Boas práticas desde o começo, sempre com o porquê: `const` nos widgets que não mudam, widgets pequenos, nomes claros, `final` nos campos, Material 3 (`useMaterial3` já é o padrão).
