#set page(paper: "a4", flipped: true, margin: 15mm, numbering: "1 / 1")
#set text(font: "DejaVu Sans", size: 11pt, lang: "pt")
#set par(leading: .65em)
#set heading(numbering: none)
#let note(body) = block(fill: rgb("edf3f8"), inset: 10pt, radius: 4pt, width: 100%, body)
#let tab(..cells) = table(columns: (1fr, 1.8fr), inset: 7pt, stroke: .5pt + rgb("b6c5d0"), ..cells)
= TedTronics — nova placa de roteamento
#text(size: 18pt)[Decisões de simplificação e versão proposta]

Documento de consolidação • 29/10/2026 • Versão documental 01

A proposta reduz a matriz a *dois MT8816*, mantém *dois 74HC595* e utiliza *um 74HCT14* para adaptar cinco sinais de controle de 3,3 V para 5 V. Os estágios de saída continuam com transistores.

São *22 nós divididos em dois grupos de 11*. As ligações normais de cada circuito permanecem dentro de sua metade. A matriz também seleciona os dois sinais enviados à placa dos componentes inteligentes e o ponto que recebe o estímulo.

#note[*Estado:* esquema e posicionamento passaram nas verificações de software registradas. O roteamento completo em uma face de cobre não passou; não existe máscara de corrosão liberada. A montagem física e os ensaios elétricos continuam pendentes.]

Este PDF consolida o candidato independente em `routing-next/pcb-hct14-1face`. Não modifica o projeto EasyEDA recebido, a placa inteligente já soldada nem as revisões anteriores.

#pagebreak()
= 1. O que muda em relação ao circuito recebido
#tab(
 [*Antes*], [*Nova proposta*],
 [Três MT8816; distribuição de nós em 8 + 8 + 6.], [Dois MT8816: grupo A com NODE00–10 e grupo B com NODE11–21, usando X0–X10.],
 [Dois 74HC595 para endereço, dados e seleção.], [Mantidos: reduzem os fios de controle e aproveitam a escolha de peças acessíveis feita pelo usuário.],
 [Cinco transistores e quinze resistores para cinco sinais de controle.], [Um 74HCT14, cinco pull-downs e um capacitor. O adaptador de RESET em 12 V continua separado.],
 [Estágios de estímulo em 5 V e 3,3 V.], [Saída de experimento em 5 V limitada por resistores; o antigo estágio de 3,3 V vira estímulo de teste em 5 V através de 10 kΩ.],
 [Comandos de fonte compartilhados no original.], [Comandos separados para ALTO, BAIXO e TESTE. Um pedido de pulso chega da placa inteligente.],
)

*Resultado no modelo:* 48 referências de componentes, frente a 61 no candidato intermediário com adaptação discreta: redução de 13 referências. A conta inclui conectores/soquetes do ESP32, mas não o módulo ESP32 nem soquetes extras dos CIs. Não é uma contagem comparativa completa do arquivo original.

O 74HCT14 é uma proposta de adaptação; sua disponibilidade na Beta não foi confirmada. Não substituir por 74HC14: o limiar de entrada é diferente.

#pagebreak()
= 2. Como os dois chips atendem aos 22 nós
#tab(
 [*Elemento*], [*Função e restrição*],
 [MT8816 A], [X0–X10 recebem NODE00–NODE10. H1, pinos 1–11, segue essa ordem.],
 [MT8816 B], [X0–X10 recebem NODE11–NODE21. H3, pinos 1–11, segue essa ordem.],
 [Y0 / GND], [Retorno comum dos experimentos selecionados.],
 [Y1 / PULSE_BUS], [Saída ALTO/BAIXO limitada, compartilhada como serviço.],
 [Y2 / TEST_BUS], [Estímulo de continuidade através de 10 kΩ.],
 [Y3 / SENSE_A; Y4 / SENSE_B], [Selecionam os dois nós que serão medidos pela placa inteligente.],
 [Y5, Y6 e Y7], [Três barramentos de interligação privados em cada metade; não unir os barramentos A aos B.],
)

Para unir dois nós da mesma metade, conectá-los ao mesmo barramento privado. Um barramento pode reunir vários nós de uma mesma rede. Há três redes internas independentes disponíveis por metade, além dos serviços dedicados; isso limita os circuitos que podem ser montados.

*As metades não são galvanicamente isoladas:* compartilham GND e serviços de teste/medição/pulso. O firmware deve impedir que esses serviços criem uma ligação acidental entre experimentos. Não é uma matriz universal entre todos os 22 nós.

#pagebreak()
= 3. Alimentação e adaptação dos comandos
Os MT8816 permanecem alimentados em *12 V*, com VSS e VEE em GND. Os 74HC595 e o 74HCT14 operam em *5 V*. Os sinais aplicados aos experimentos ficam restritos à faixa de 0–5 V; os 12 V são exclusivamente alimentação da matriz e do RESET.

O ESP32 entrega lógica de 3,3 V. O 74HCT14 recebe esses sinais e fornece lógica de 5 V para os registradores e o STROBE. É um inversor: o firmware deve compensar a polaridade de SER, CLK, LATCH e STROBE. O comando OE_ENABLE alto produz OE_N baixo, habilitando as saídas dos registradores.

Os cinco resistores de 47 kΩ mantêm entradas do HCT14 em zero quando o ESP32 está em reset. A entrada do sexto inversor fica em GND e sua saída não é usada. Cada CI conserva seu desacoplamento local de 100 nF.

Q6 continua adaptando o RESET para 12 V: sem comando de liberação, RESET é puxado para 12 V e a matriz fica apagada. Os pull-downs de CS mantêm os chips não selecionados enquanto as saídas dos registradores estão desabilitadas.

#note[*Conferir a fonte:* a nova placa requer 12 V, 5 V e GND. Ainda é necessário confirmar os 12 V disponíveis na placa de energia existente. Neste candidato, o ESP32 roteador é alimentado por USB; seu VIN/5 V não é ligado à fonte externa em paralelo.]

#pagebreak()
= 4. Pulso, lógica e teste de continuidade
*ALTO:* Q8 comanda Q7, que fornece 5 V ao PULSE_BUS através de R17 = 470 Ω. *BAIXO:* Q11 leva o mesmo barramento ao GND através de outro resistor de 470 Ω. Desligar ambos deixa a saída sem acionamento ativo; isso não equivale a isolamento qualificado.

A placa inteligente envia apenas um *pedido digital de pulso de 3,3 V*. O roteador lê esse pedido, aplica os intertravamentos e comanda os transistores. Não existe passagem direta de 5 V por um GPIO. O firmware deve desligar o estado anterior antes de ativar o próximo; não habilitar ALTO e BAIXO simultaneamente.

*TESTE:* Q9/Q10 fornecem um estímulo de 5 V através de 10 kΩ. Com o experimento desligado, o roteador seleciona o par de nós e a placa inteligente lê SENSE_A e SENSE_B. Comparar casos aberto, curto conhecido e resistência conhecida permite avaliar o caminho.

A leitura simples pode apoiar um teste preliminar de contato. Entretanto, resistências dos MT8816, divisores de medição e caminhos paralelos afetam o resultado. Não garante identificar qual pogo falhou nem cumprir sozinho os limiares finais de continuidade.

*Limites calculados, não medidos:* com fonte até 5,25 V e resistores de 1%, 470 Ω limita um curto ideal a aproximadamente 11,29 mA; 10 kΩ limita o estímulo a aproximadamente 0,531 mA. A queda na matriz e nos transistores reduz esses valores, mas não substitui ensaio de falha/transiente nem a proteção da alimentação.

#pagebreak()
= 5. Conexões entre as placas
#tab(
 [*Conector / pino*], [*Destino e significado*],
 [H2.1 / 12 V], [Fonte → alimentação dos MT8816 e pull-up do RESET. Nunca levar aos GPIOs ou aos nós dos experimentos.],
 [H2.2 / 5 V], [Fonte → registradores, HCT14 e estágios de saída/teste.],
 [H2.3 / NC], [Sem conexão nesta proposta; não manter o antigo fio de 3,3 V automaticamente.],
 [H2.4 / GND], [Retorno comum da fonte, roteador e placa inteligente.],
 [J_SMART.1 / SENSE_A], [Nó selecionado A → entrada de medição A na placa inteligente.],
 [J_SMART.2 / GND], [Referência comum entre as placas.],
 [J_SMART.3 / SENSE_B], [Nó selecionado B → entrada de medição B na placa inteligente.],
 [J_SMART.4 / PULSE_CMD], [GPIO27 da placa inteligente → GPIO34 do ESP32 roteador; sinal digital de 3,3 V com pull-down de 47 kΩ no roteador.],
)

SENSE_A e SENSE_B transportam tensões do experimento: *não conectar diretamente a um ADC do ESP32*. Na proposta simples, cada entrada da placa inteligente usa seu divisor de 10 kΩ/10 kΩ para os ADCs GPIO34 e GPIO35. Os GPIO34 dos dois ESP32 pertencem a placas diferentes.

Os conectores dos OLEDs, joystick, Raspberry e NFC permanecem na placa inteligente. Seus cabos não passam pelo roteador. A seleção de qual posição/nó corresponde a cada medição continua sendo responsabilidade do sistema e do mapa físico.

#pagebreak()
= 6. Pinagem e sequência de operação
#table(columns: (1fr, 1fr, 1fr, 1fr), inset: 6pt, stroke: .5pt,
 [*Função*], [*GPIO roteador*], [*Função*], [*GPIO roteador*],
 [SER], [23], [CLK], [18],
 [LATCH], [22], [STROBE], [19],
 [OE_ENABLE], [21], [RESET_RELEASE], [25],
 [ALTO], [26], [BAIXO], [27],
 [TESTE], [14], [PULSE_IN], [34],
)

U5 fornece AX0–AX3, AY0–AY2 e DATA; U6 fornece CS_A e CS_B. Os registradores são encadeados; seus bits não utilizados ficam em zero. A codificação de endereço físico X do MT8816 não é linear em toda a faixa: conferir a tabela do fabricante, inclusive X6–X10.

+ Inicializar ALTO, BAIXO e TESTE desligados; manter RESET da matriz ativo.
+ Inicializar os registradores e selecionar nenhum chip. Não autorizar energia durante configuração.
+ Limpar a matriz e carregar apenas as conexões permitidas do circuito escolhido.
+ Desligar a saída de experimento, selecionar o par de teste e medir. Resultado inconclusivo mantém o sistema desligado.
+ Desligar TESTE, remover suas conexões e configurar as rotas de operação/medição.
+ Após autorização válida, aceitar pedidos da placa inteligente e acionar ALTO ou BAIXO com intervalo sem acionamento entre estados.
+ Falha, reinício ou perda de comunicação: desligar saídas e limpar a configuração antes de uma nova autorização.

Esta sequência é um contrato proposto; o firmware de teste dos OLEDs não implementa o controle deste roteador.

#pagebreak()
= 7. Montagem e pontos ainda em aberto
*Perfboard de 10 × 20 cm:* distribuição conceitual com ESP32 próximo ao USB, HCT14 junto dos registradores, dois MT8816 próximos aos conectores de nós e estágios de saída separados. Nas quatro bordas isoladas: GND à esquerda, 5 V à direita, 12 V embaixo e borda superior reservada. Sinais usam fios isolados; cruzamento físico de fios não significa junção.

O modelo tem 5 CIs, 6 transistores, 24 resistores, 7 capacitores e 6 conectores/soquetes de interface. Foram estimadas 152 ligações internas por terminais de rede; isso *não é* uma lista final de 152 fios cortados. Há ainda 22 condutores de nós, quatro da interface inteligente e três de alimentação.

*PCB corroída de uma face:* pontes isoladas no lado dos componentes foram aceitas, mas falta fechar suas posições e todas as trilhas. As tentativas automáticas tiveram erros/curtos ou falha do solucionador. O encaixe de corpos, soquetes, cabos e módulo ESP32 exige medição e prova 1:1.

#note[*Limitações preservadas:* divisor 10 kΩ/10 kΩ apresenta entrada de aproximadamente 20 kΩ, abaixo de 1 MΩ; saída com 470 Ω perde tensão sob carga e não garante os níveis lógicos finais sob 2 mA; corrente/leakage e continuidade ainda não foram qualificados; desligamento diante de ESP32 travado requer solução de watchdog físico.]

Antes de montar: conferir fonte e peças, fechar o mapa dos componentes/pogos, validar cada bloco em bancada e concluir um guia físico por fios ou uma PCB aprovada. A simplificação é candidata de engenharia; não substitui os requisitos finais nem libera soldagem por si só.

#pagebreak()
= Esquema — ESP32
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/ESP32.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — AdaptacaoControle
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/AdaptacaoControle.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — Registros
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/Registros.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — MatrizA
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/MatrizA.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — MatrizB
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/MatrizB.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — Pulso
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/Pulso.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — Continuidade
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/Continuidade.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — Interfaces
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/Interfaces.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Esquema — AdaptadorHCT
Exportação do circuito nativo com HCT14. Rótulos de rede iguais representam conexões elétricas entre folhas. Não é desenho de trilhas.
#align(center, image("assets/AdaptadorHCT.svg", width: 265mm, height: 145mm, fit: "contain"))

#pagebreak()
= Referências e rastreabilidade
Fontes locais do candidato: `routing-next/pcb-hct14-1face/model.mjs`, `circuit.tsx`, `parts.json`, `pins.csv`, `interface.json`, `checks.json`, `verification.json` e `routing-status.json`.

Comparação com a adaptação discreta: `routing-next/pcb-2mt-595/model.mjs`. Os dois modelos são preservados para rastreabilidade. Este PDF usa os esquemas já gerados do candidato HCT14, sem reaproveitar as trilhas reprovadas.

Dados de fabricante consultados no planejamento:

- #link("https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf")[MT8816 — matriz analógica, alimentação, controle e endereçamento.]
- #link("https://www.ti.com/lit/ds/symlink/sn74hct14.pdf")[SN74HCT14 — adaptação de níveis com inversores Schmitt.]
- #link("https://www.ti.com/lit/ds/symlink/sn74hc595.pdf")[SN74HC595 — registradores de deslocamento.]
- #link("https://www.onsemi.com/download/data-sheet/pdf/bc546-d.pdf")[BC548] e #link("https://www.onsemi.com/download/data-sheet/pdf/bc556b-d.pdf")[BC557 — conferir pinagem do fabricante da peça comprada.]

Disponibilidade e preços locais não foram confirmados por este documento. Todas as aprovações citadas são verificações registradas de software; não existem medições de aceitação desta nova placa neste PDF.
