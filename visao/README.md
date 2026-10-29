# visao — protoboard → grafo do circuito

```
frame → registro do grid (furos + homografia RANSAC) → imagem retificada
      → cor de cada socket e de cada "ponte" entre colunas vizinhas
      → filtro temporal (3 frames) → componentes → grafo
```

| arquivo | o que faz |
|---|---|
| `config.py` | **todos os parâmetros** (geometria, faixas HSV, tabela de componentes, limiares) |
| `registro.py` | acha os furos e calcula a homografia modelo → imagem; rastreia entre frames e recalibra sozinho |
| `sockets.py` | retifica a placa e classifica a cor de cada socket/ponte |
| `componentes.py` | agrupa sockets da mesma cor ligados por ponte → componente (2 ou 3 sockets) |
| `temporal.py` | só aceita mudança depois de N frames iguais |
| `circuito.py` | grafo bipartido (redes × componentes) e versão com os jumpers contraídos |
| `pipeline.py` | junta tudo; descarta frames com mão na frente / movimento |
| `debug.py` | desenhos de depuração |

## Uso

```bash
python3 -m visao real_img/pecas2.jpeg --debug saida/   # imagens soltas
python3 -m visao --camera 0 --mostrar --json circuito.json --travar-camera   # tempo real
python3 -m unittest discover tests -v
```

No modo câmera: `r` recalibra, `s` salva imagens de depuração, `q` sai.

## Modelo elétrico

- cada coluna de 6 sockets de cada metade é um nó (`C0..C10` em cima, `B0..B10` embaixo);
- um componente ocupa 2 ou 3 sockets vizinhos na mesma linha; todos são terminais, exceto no
  `jumper_longo`, que liga só a 1ª e a 3ª coluna;
- `grafo` mantém os jumpers como componentes; `grafo_eletrico` funde as redes ligadas por jumper.

## Calibrar com as peças reais

1. Trave exposição e balanço de branco da câmera (`--travar-camera`, ou `v4l2-ctl`).
2. Fotografe as peças na placa e rode `python3 -m visao foto.jpg --cores`: ele imprime o HSV
   mediano de cada socket ocupado. Ajuste `CORES` em `config.py`.
3. Ajuste a tabela `COMPONENTES` (cor, nº de sockets) → tipo, e o desempate por nº de pontos pretos.
4. Se a placa real tiver outra proporção, ajuste `GAP` (distância entre as metades, em linhas).
