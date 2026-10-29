# PCB de roteamento — 2 MT8816, 2 × 74HC595 e transistores

[PDF do planejamento](planejamento-pcb-2mt-595.pdf).

Candidato independente, 100 × 200 mm, uma face de cobre. Substitui a proposta `../simplificacao-direta/` na arquitetura de controle e saída: não usa AHCT244 nem TC4427A. O arquivo EasyEDA original e as placas já soldadas permanecem intactos.

**Estado: esquema e posicionamento, não fabricação.** O autorroteamento nativo em uma camada não concluiu uma solução validada (a tentativa final foi interrompida por limite de 45 segundos; uma anterior foi interrompida manualmente após permanecer sem resultado). Isso não demonstra impossibilidade. Não há fotolito, Gerbers liberados nem tabela física final de pontes. O usuário autorizou pontes de fio isolado no lado dos componentes; elas devem ser numeradas e conferidas quando o cobre for fechado no EasyEDA. As figuras de posicionamento não contêm trilhas e não são máscaras de corrosão.

## Decisões e interface

- U1: 11 nós superiores nos X0…X10. U2: 11 nós inferiores nos X0…X10.
- Y0=GND, Y1=PULSE_BUS, Y2=TEST_BUS, Y3=SENSE_A, Y4=SENSE_B; serviços compartilhados com seleção exclusiva por operação.
- Y5/Y6/Y7 são três barramentos privados por metade, sem interligação A↔B.
- Um experimento alimentado/estimulado por vez. GND comum; sem isolamento galvânico.
- 74HC595 a 5 V com conversores NPN; RESET por NPN com pull-up de 12 V.
- Saída alta Q7/Q8 e baixa Q11, cada ramo com 470 Ω, 1%; estímulo Q9/Q10 em 5 V/10 kΩ.
- H2: 12 V / 5 V / NC / GND. Confirmar que a placa de energia realmente fornece os 12 V necessários. ESP32 roteador por USB, sem VIN externo em paralelo.
- J_SMART: SENSE_A / GND / SENSE_B / PULSE_CMD (3,3 V). Placa inteligente preservada.

O usuário optou por peças disponíveis localmente, mas estoque/preço exato e fabricante/encapsulamento dos conectores continuam sem confirmação. Os números de conectores não aparecem nos esquemas.

## Arquivos e reprodução

- `model.mjs`: componentes, pinagem, coordenadas e redes completas.
- `circuit.tsx`: esquema nativo tscircuit, candidato de uma camada e posicionamento.
- `build.tsx`: geração, comparação de todas as redes do modelo com o netlist nativo e checks.
- `documents.py`: PDF/diagrama de planejamento. Não implementa roteador nem gera trilhas.
- `placement.circuit.json`, `checks.json`, `schematic-placement.txt`, `placement.txt`: candidato e verificações.
- `bom.csv`, `pins.csv`, `interface.json`: peças, terminais e interface.
- `assets/*.svg`: folhas esquemáticas e posicionamento. TOP do modelo não é automaticamente a orientação do fotolito para a face de solda.
- `verification.json`, `routing-status.json`: status explícito, sem confundir pads com trilhas.

Na pasta `eletronics/perfboard/tscircuit`:

```sh
node_modules/.bin/bun routing-next/pcb-2mt-595/build.tsx
python3 routing-next/pcb-2mt-595/documents.py
```

A tentativa opcional de autorroteamento nativo usa `ROUTE_PCB=1`; pode demorar e não constitui liberação. Parâmetros iniciais: trilha 0,4 mm, afastamento 0,25 mm; o profissional deve confirmar que o processo de corrosão/furação suporta esses valores.

## Limitações de conformidade

Os divisores da placa inteligente apresentam 20 kΩ, não ≥1 MΩ. A medição não garante fuga ≤10 µA desligada. Limites de continuidade 20/100 Ω não estão qualificados. As resistências de 470 Ω limitam corrente, mas não garantem os níveis alto/baixo requeridos sob carga. RESET e heartbeat de software não equivalem a watchdog físico contra MCU travado. O encapsulamento comprado, corpo do DevKit, soquetes e conectores ainda exigem medição e prova 1:1; a verificação dos pads não cobre o volume dos módulos.

Nenhum ensaio físico ou alteração de firmware foi realizado. CP00–CP36 e as revisões anteriores permanecem preservados. Revisar essas diferenças e fechar cobre/pontes antes de fabricação definitiva.

## Fontes primárias

- [MT8816 — datasheet do fabricante](https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf)
- [SN74HC595 — Texas Instruments](https://www.ti.com/lit/ds/symlink/sn74hc595.pdf)
- [BC548B — onsemi](https://www.onsemi.com/download/data-sheet/pdf/bc546-d.pdf)
- [BC557B — onsemi](https://www.onsemi.com/download/data-sheet/pdf/bc556b-d.pdf)
