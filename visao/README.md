# Visão — câmera da bancada

O perfil padrão `current` lê a metade montada da bancada: 6 linhas por 11
colunas, chamada `C`. As coordenadas da saída são baseadas em zero (`C0` a
`C10`, linhas `0` a `5`). A metade `B` permanece desconhecida nesta montagem.
O perfil `legacy` mantém o leitor anterior de duas metades e suas regras de
cor; ele pode ser selecionado explicitamente para as imagens antigas.

## Executar

Da raiz do projeto, usando o ambiente Python instalado em `.venv`:

```bash
# Imagem capturada, com JSON e arquivos de diagnóstico
.venv/bin/python -m visao visao/fixtures/current/frame-00.jpg --json --debug /tmp/visao-debug

# Câmera: altere 1 para o índice da câmera conectada
.venv/bin/python -m visao --camera 1 --mostrar --json /tmp/circuito-camera.json

# Fotos do sistema anterior
.venv/bin/python -m visao --profile legacy real_img/pecas2.jpeg --debug /tmp/visao-legacy
```

No modo câmera, `r` reinicia o rastreamento, `s` salva diagnósticos e `q`
encerra. `s` salva o frame original sem anotações em PNG, as imagens de
diagnóstico e uma tabela CSV, usando nomes únicos; `--debug` escolhe a pasta
(padrão `debug/`). `--json -` envia objetos JSON para stdout; com um caminho, grava o
arquivo de forma atômica. O estado é publicado quando muda e pelo menos uma vez
por segundo enquanto os frames são processados. `gerado_em_unix` é o instante
de publicação em segundos Unix. Se a câmera não abrir, parar ou perder o grid,
a saída indica `valido: false`; consumidores também devem aplicar timeout para
falhas abruptas do processo.

## Calibração

O perfil atual primeiro procura os dois adesivos verdes diagonais da bancada de
demonstração fotografada em 11/11/2026. É uma referência específica dessa
bancada e da posição dos adesivos; não é uma calibração genérica de quatro
cantos. Os dois adesivos brancos não são usados. Mantenha a orientação e a
perspectiva da câmera, os adesivos e os contatos das duas metades visíveis.
Adesivos movidos, rotação de 180°, oclusão ou mudança acentuada de perspectiva
podem exigir calibração manual. A proposta dos adesivos precisa passar pelas
mesmas verificações de sockets, distribuição e erro; na falha usa o método
anterior. Ela não verifica polaridade nem continuidade elétrica.

O perfil atual tenta registrar a grade automaticamente quando há evidência das
quatro bordas. Caso falte uma borda, também tenta comparar características da
bancada com a foto de referência `fixtures/current/frame-00.jpg`; a proposta
precisa passar pela validação dos sockets visíveis antes de produzir posições.
A comparação depende da foto de referência e do suporte SIFT do OpenCV. Sem
evidência suficiente para numerar a grade, a leitura é rejeitada. Também é
possível selecionar os quatro cantos manualmente:

```bash
.venv/bin/python -m visao --camera 1 --calibrate /tmp/minha-calibracao.json --mostrar
# Depois, reutilize o arquivo com a mesma resolução e posição da câmera:
.venv/bin/python -m visao --camera 1 --calibration /tmp/minha-calibracao.json --mostrar
```

Clique nos centros dos sockets dos cantos superior esquerdo, superior direito,
inferior direito e inferior esquerdo. Pressione Enter, confira a grade numerada
e pressione Enter novamente para salvar. `r` reinicia a seleção e Escape cancela.
O arquivo indicado deve ser novo. O rastreamento valida o ajuste contra a imagem;
recalibre se a posição da câmera mudar e a grade não puder ser rastreada.
O campo `motivo` distingue origem ambígua, mudança de resolução, movimento
excessivo, falta de sockets distribuídos, erro de ajuste e ausência de leitura
local confiável. Esses diagnósticos também aparecem com `--verbose`.

## Interpretação e limites

- No arranjo experimental do teste, corpos vermelhos são interpretados como bateria,
  verdes como LED e o jumper branco de três espaços como `jumper_3`. A cor não
  distingue LED de buzzer, e a câmera não determina a polaridade: a integração
  assume o primeiro terminal (à esquerda) como positivo/ânodo, exceto na lição
  `03-guiada-1k`: nela a tela usa ânodo à direita para a montagem de teste
  confirmada. Confira fisicamente esses pressupostos; a identificação não é uma medição elétrica. A identificação
  foi conferida em uma montagem e depende de iluminação e posição.
- O perfil atual não lê as faixas de resistores axiais. Se houver vários corpos
  azuis visíveis, eles são marcados como peças não identificadas, sem presumir
  seus valores. Um único resistor azul com corpo axial continua identificado
  como 1 kΩ pela convenção do kit de teste, não por medição óptica.
- Um suporte azul com resistor axial visível também é interpretado como `resistor_1k`
  nesta montagem de teste, usando o valor informado para o kit. Não use essa
  identificação como leitura das faixas nem para distinguir outros valores.
- `observacoes` distingue `empty`, `occupied` e `unknown`; `atualidade` distingue
  `fresh`, `stale` e `unknown`. Leituras precisam de três frames consecutivos no
  modo câmera. Resultados anteriores ficam `stale` por até dois segundos, mas
  componentes não confirmados no frame atual saem do grafo imediatamente.
- `valido` significa que houve registro utilizável e pelo menos uma observação
  local confiável no frame; não significa que a placa
  inteira foi reconhecida. `completo` só fica `true` em modo temporal quando
  todas as posições ativas `C` estão atualizadas e nenhuma peça tem tipo
  desconhecido. Ele não afirma que a metade `B` foi lida. Uma imagem isolada
  nunca é completa. Não valide o circuito inteiro a partir de uma leitura
  incompleta. Em particular,
  passar apenas o objeto `circuito` ao validador descarta os campos de cobertura.
- O perfil atual foi desenvolvido com cinco fotos próximas da mesma montagem e
  transformações dessas fotos. Outras peças, luz, movimentos e a bancada
  remontada ainda precisam de verificação ao vivo. Veja as fotos e anotações em
  [fixtures/current](fixtures/current/README.md).

## Testes

Para medir a referência estática após aquecimento (tempo de calibração inicial,
tempo por quadro e peças reportadas):

```bash
.venv/bin/python -m visao.benchmark visao/fixtures/current/reference-completed.jpg --frames 90
```

`visao.markers.marker_homography` é um protótipo independente de calibração
ArUco: recebe quatro IDs e suas coordenadas conhecidas e retorna uma proposta
de homografia. Não está ligado à bancada nem substitui a validação da grade;
marcadores físicos e sua geometria ainda precisam ser testados.

```bash
.venv/bin/python -m unittest discover -s tests -p 'test_calibracao.py'
.venv/bin/python -m unittest discover -s tests -p 'test_resistor_atual.py'
.venv/bin/python -m unittest discover -s tests -p 'test_visao.py'
```

As imagens geradas são diagnósticos de software; os testes com fotos não
estabelecem a resposta de uma bancada física em todas as condições.
