# Placa inteligente — versão atual simplificada com RC522

[Guia em pt-BR](../wiring_guide.pdf) · [Mesmo PDF com hífen](../wiring-guide.pdf) · [Preview](review.html).

Escopo confirmado: uma perfboard30×45,14 referências já soldadas preservadas (mais módulo ESP32),10 peças novas na placa eRC522 externo. Acrescentar4×10kΩ,2×1kΩ,2×100nF, conector4pinos paraA/GND/B/comando e conector7pinos paraRC522. Sem buffers, ADC externo, placa complementar, lógica de60/69 peças, amperímetro ou banco de resistores.

GPIOs: telas SCL22/SDA4,21,19,18,17,16; joystick36/39; ADC34/35; UART32/33; NFC SCK14/MOSI23/MISO13/SS25/RST26; comando de pulso27. IRQ doRC522 e SW do joystick desconectados. Alimentação3,3V; nenhum5V é fornecido aGPIOs/RC522. A seleção A/B, estímulo de continuidade e estágio5V/GND/desconectado doP3 são externos. O modo desabilitado depende do protocolo/controle externo; não é codificado apenas no nível doGPIO27.

## Arquivos

- `wiring-guide.pdf` / `wiring-guide.typ`: guia gerado com origem, destino e função de todos os fios internos e cabos externos, peças, layout e verificações.
- `wire-functions.csv`:62 fios internos,39 Sxx existentes e23 Nxx novos, com explicação de cada função.
- `new-parts.csv`, `pins.csv`, `wires.csv`, `bom.csv`: inventário e terminais da revisão atual.
- `assets/top.svg`, `assets/underside.svg`, `assets/wire-*.svg`: superior, inferior espelhado e grupos de até5 fios.
- `assets/{Existing,Router,NFC,Voltage}.svg`: folhas nativas de referência, MPNs de conectores removidos.
- `design.mjs`, `circuit.tsx`, `build.tsx`, `guide.mjs`: modelo, tscircuit, verificações e gerador.
- `verification.json`, `checks.json`, `schematic-placement.txt`, `placement.txt`, `shorts.txt`, `pcb-style.json`: evidências de software, não ensaios físicos.

Regenerar na pasta tscircuit: `npm run build:smart-perfboard` ou `npm run build:smart-perfboard:simplified-final`.

Os dois nomes de PDF no diretório pai são cópias idênticas geradas da mesma fonte. O PDF anterior foi arquivado como `wiring-guide-historico-antes-RC522.pdf`. Outras propostas históricas não são instruções atuais de montagem.

## Limitações explícitas

Entrada10k/10k apresenta cerca de20kΩ paraGND: não cumpre≥1MΩ e pode alterar a tensão medida. Com sinal externo e placa desenergizada, não garante≤10µA de fuga. Desconectar entradas antes de desenergizar/programar; não declarar conformidade integral com os requisitos anteriores. Continuidade é classificação ampla com calibração de curto/resistor/aberto e resultado inconclusivo, não medição garantida de20Ω/100Ω.

Nenhum software/ADC confirma sozinho o estado desenergizado. O circuito externo deve tratar cargas em capacitores, fontes externas e caminhos paralelos antes do precheck. Um único comando de pulso não garante alta impedância após falha; o controle externo deve estabelecer isso.

`perfboard_stage1_test` cobre OLED/joystick/UART, não RC522, aquisição calibrada ou protocolo de saída desta revisão. Nenhuma alteração de firmware ou escrita no Notion foi feita nesta entrega.

Furos/pinagem antiga e39 fios são comparados ao modelo-base; o netlist nativo e o grafo dos fios são comparados para todos os terminais. Verificações de footprint/courtyard/pads não medem corpos reais, conexão de cabos, estabilidade da fonte, exatidão doADC ou resistência de contatos. Aceitação física permanece pendente.
