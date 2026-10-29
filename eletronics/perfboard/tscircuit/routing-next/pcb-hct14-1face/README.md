# Candidato de uma face com 74HCT14 — NÃO LIBERADO

Modelo separado do candidato anterior: dois MT8816 em12V, dois74HC595 e um74HCT14 em5V; PCB100×200mm. Não substitui silenciosamente os desenhos anteriores, não modifica o arquivoEasyEDA recebido e não altera placas já soldadas.

## Resultado

- Esquema, especificação de pinos, netlist e comparação de todas as redes modelo↔circuito nativo: passaram.
- Posicionamento esquemático e físico do candidato: passou em software; encaixe real pendente.
- Roteamento completo em uma face de cobre: **não confirmado**.
- Tentativa inicial em fases: limite de tempo sem resultado utilizável.
- Tentativa em fases com índices explícitos: gerou trilhas, mas foi reprovada pelos erros de roteamento e pelo check independente de curtos. Não usar como cobre.
- Tentativa global com suporte nativo a jumpers: solver esgotou as iterações; não gerou trilhas completas.

Isso **não demonstra impossibilidade** de rotear a placa; demonstra que estes candidatos não foram aprovados. Não emitir fotolito/Gerbers nem usar os SVGs de tentativa para fabricar.

A ferramenta de jumpers testada possui modelos SMD; ela não produziu uma tabela de pontes de fio PTH no lado dos componentes. Não tratar essa tentativa como cumprimento da interface de montagem autorizada.

## Arquivos

`model.mjs`, `circuit.tsx`, `build.tsx`: fonte nativa, usando apenas o autorroteamento do tscircuit; nenhum roteador próprio foi implementado.

`placement.circuit.json`, `checks.json`, `placement.txt`, `schematic-placement.txt`, `parts.json`, `pins.csv`, `bom.csv`, `interface.json`: estado elétrico e posicionamento do candidato com HCT14.

`failed-indexed-status.json`, `failed-indexed-shorts.txt`, `failed-indexed.log`: evidência da reprovação da tentativa em fases.

`failed-global-routing-status.json`, `failed-global-attempt-1layer.circuit.json`, `failed-global.log`: evidência da falha da tentativa global.

`verification.json` e `routing-status.json`: estado explícito, fabricação não liberada.

Ajustes posteriores de roteamento devem manter100×200mm, apenas uma face de cobre, pontes isoladas identificadas, netlist completo e os conectores acordados. A confirmação exige conectividade integral, zero curtos, afastamentos/larguras compatíveis com o processo, tabela completa de pontes e prova1:1 dos componentes comprados. A validação geométrica não substitui teste elétrico após corrosão/montagem. Permanecem também as limitações já registradas da medição20kΩ, saída resistivamente limitada e watchdog.
