# PCB de uma face — candidato V2

[PDF de revisão e montagem](pcb-camada-unica.pdf): 100 × 200 mm, uma única face de cobre, **59 pontes de fio isolado** no lado dos componentes e 106 ilhas WP reservadas (94 usadas por pontes). É um candidato completo em software; a prova física e a aceitação energizada continuam pendentes. Não é uma placa sem pontes e não foi demonstrado um mínimo de montagem.

## Resultado registrado

- Dois MT8816 em 12 V, dois 74HC595 e um HCT14 em 5 V; saídas discretas preservadas.
- Matrizes horizontais empilhadas, oito interfaces/soquetes funcionais; saídas de nós em H1/H3 de seis pinos e H1B/H3B de cinco pinos. O chicote antigo de 11 pinos por banco exige a divisão documentada no PDF.
- 50 referências funcionais; módulo ESP32 e soquetes DIP são materiais adicionais. Ilhas WP são características da PCB, não 106 conectores a comprar.
- 198 trechos de cobre; 372 furos de terminais/pontes e quatro furos mecânicos. Um só conjunto de cobre, nenhuma via de interligação entre camadas.
- Checks nativos de pinos, redes, posicionamento completo, folgas, sobreposições, furos, borda e continuidade dos trechos: zero erros.
- Check independente de curtos via cobre Gerber, 20 pixels/mm: passou. Estilo de trilhas: passou.
- Auditoria independente usa geometria das ilhas/trilhas e a lista JP, sem confiar nas `source_trace`: todas as redes fechadas após as pontes, nenhuma união indevida; detecta ponte essencial ausente e ponte ligada à rede errada.
- Encaixe real, orientação da transferência, tolerâncias e ensaio energizado: **pendentes**. Não há liberação de fotolito/Gerbers de produção.

## Arquivos atuais

- `model.mjs`, `circuit.tsx`: fonte funcional tscircuit, separada dos candidatos anteriores; não altera revisões antigas nem o EasyEDA recebido.
- `native-plan.json`: snapshot roteado congelado, incluindo os acessos às pontes e ajustes locais. `finalize.mjs` recusa posições/redes obsoletas.
- `copper.circuit.json`: somente a única face de cobre. O motor de uma camada chama essa face de `top`; a montagem física proposta utiliza o lado oposto aos componentes. As provas mostram a vista TOP e a vista inferior espelhada. Validar a inversão no processo de transferência profissional.
- `final-plan.json`, `wire-bridges.csv`, `wire-pads.csv`: 59 fios externos, seus percursos e pontos WP. Fio é isolado; não é segunda camada de cobre.
- `drill-table.csv`, `bom-functional.csv`: materiais e furação. TO-92 usa ilhas circulares de 1,4 mm/furo 0,8 mm na finalização; o padrão triangular e C/B/E precisam de dry-fit.
- `candidate-status.json`, `copper-checks.json`, `assembly-audit.json`, `shorts-check.txt`, `pcb-style-check.txt`: evidências de software, não de bancada.
- `assets/proof-top.svg`, `assets/proof-bottom.svg`: provas vetoriais 1:1 para revisão, não máscaras liberadas de fabricação.

O envelope do ESP32 é conservador e não medido, 33 × 55 mm, com avanço previsto de 7,5 mm além da borda superior. Confirmar acesso ao USB, suporte, capacitores, soquetes e altura das pontes. Campos vazios WP não devem ser fechados automaticamente.

As limitações elétricas continuam: entrada de tensão de aproximadamente 20 kΩ, queda nos limitadores de 470 Ω, continuidade ainda sem qualificação final e watchdog físico pendente. A PCB não corrige esses requisitos por mudar a forma de montagem.

## Regerar a partir do snapshot atual

Na raiz do repositório:

```sh
eletronics/perfboard/tscircuit/node_modules/.bin/bun eletronics/perfboard/tscircuit/routing-next/pcb-singleface-v2/verify.mjs
python3 eletronics/perfboard/tscircuit/routing-next/pcb-singleface-v2/documents.py
eletronics/perfboard/tscircuit/node_modules/.bin/bun eletronics/perfboard/tscircuit/routing-next/pcb-singleface-v2/crop-schematics.mjs
/home/gustavo/.cargo/bin/typst compile eletronics/perfboard/tscircuit/routing-next/pcb-singleface-v2/pcb-camada-unica.typ
```

Os arquivos `route.mjs`, `add-bridge-anchors.mjs`, `add-missing-anchors.mjs` e `repair-anchor-clearance.mjs` registram o planejamento iterativo com o motor nativo KRT do tscircuit. Reexecutar o roteamento substitui o snapshot; fazer isso somente para desenvolver um novo candidato e repetir todas as verificações. Não foi implementado roteador próprio. As tentativas globais e ordenações alternativas não eram melhores que o snapshot atual.
