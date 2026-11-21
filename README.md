# Guia Flutter

Site: https://wallysondevs.github.io/guia-flutter/

Curso de Flutter em português para quem **já sabe o básico de Dart** (o [Guia Dart](https://wallysondevs.github.io/guia-dart/)) e **nunca fez um app**. Funciona como uma escola: uma aula para cada widget ou ideia, organizadas em **3 níveis + projetos + referência** (97 páginas). Vai de widgets, layout, `Row` e `Column` até estado com `setState`, listas, formulários, navegação, temas, internet, Provider, Riverpod, testes e publicação.

Cada aula explica cada parte do código (anatomia: o widget, os parâmetros, o `child`/`children`), mostra **a tela real** que o código desenha, a saída real do terminal (`flutter create`, `flutter run`) e o que acontece quando dá errado, com a mensagem verdadeira do console. As fotos das telas (`assets/telas/`) foram tiradas de um Flutter de verdade, e o guia usa o **Flutter 3.47.7 / Dart 3.13.5** com Material 3.

Para praticar, as páginas trazem o editor **Experimente** (`.tryflutter`):

- Edite o `main.dart` na própria página, com **▶ Rodar**, **↺ Restaurar**, **Ver solução** e **Copiar**.
- Ao clicar em **Rodar**, a caixa abre o **DartPad oficial** (o mesmo da documentação do Flutter) e mostra o **app de verdade**, clicável.
- Nas **missões**, a caixa confere o seu código e diz se você chegou ao resultado pedido.

O editor usa `assets/flutsim.js`. O código é compilado pelos servidores do DartPad, então **essa parte precisa de internet**. Nada é baixado ao abrir a aula: a página só fala com o DartPad no primeiro **Rodar**.

O site em si é 100% estático (HTML + CSS + JS, sem build): abre direto no navegador e funciona no GitHub Pages. Só o botão **Rodar** do editor depende do DartPad.

## Estrutura

```
index.html                 página inicial
<tema>.html                uma aula por tema
assets/style.css           visual
assets/site.js             níveis/menu (lista NIVEIS), Anterior/Próximo, anatomia, exercícios
assets/flutsim.js          o editor "Experimente" (caixas .tryflutter) com o DartPad embutido
assets/telas/              fotos das telas dos apps, tiradas de um Flutter de verdade
tools/testar-missoes.js    confere as missões e se o código compila (dart analyze)
tools/testar-navegador.js  abre as páginas num Chromium sem janela e confere o editor
CONTRIBUINDO.md            como escrever uma aula
.nojekyll                  faz o GitHub Pages servir os arquivos como estão
```

## Testes

```bash
node tools/testar-missoes.js --todas                    # todas as páginas (usa o dart analyze do Flutter)
node tools/testar-missoes.js pagina.html                # só estas páginas (-q mostra só os problemas)
node tools/testar-missoes.js --sem-analise pagina.html  # rápido, sem o dart analyze
node tools/testar-navegador.js pagina.html              # confere o editor num Chromium sem janela
node tools/testar-navegador.js --dartpad 1 pagina.html  # clica em Rodar na caixa 1 e espera o DartPad (precisa de internet)
bash tools/checar-privacidade.sh             # páginas e histórico; lista extra: PROIBIDO=lista.txt
```

## Publicar no GitHub Pages

Envie a pasta para um repositório e ative **Settings → Pages → Deploy from a branch → main / (root)**.

## Adicionar uma aula

Leia `CONTRIBUINDO.md` e inclua a página na lista `NIVEIS` de `assets/site.js`.
