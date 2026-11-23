# TedTronics — roteador de alimentação com multiplexadores

## Objetivo

Selecionar um nó para receber +5 V com corrente limitada por hardware e outro para receber GND. O sistema final tem 22 nós em dois bancos de 11 e três estados: OFF, banco A ou banco B. O firmware rejeita endereços inválidos, dois terminais no mesmo nó e pedidos que misturam bancos.

O primeiro teste usa três nós em uma protoboard separada, com o ESP32 e dois 74HC4051. A montagem com módulos CD74HC4067 segue documentada como alternativa. A PCB original, que fez um ruído ao ligar, fica desconectada durante o teste. Esta proposta demonstra o roteamento com multiplexadores. A qualificação do MT8816AE é um ensaio separado.

## Alternativa com módulos CD74HC4067 em 3,3 V

| Item | Quantidade |
|---|---:|
| ESP32 e cabo USB | 1 |
| Módulo analógico CD74HC4067 de 16 canais com pinos de 2,54 mm | 2 |
| Resistor de 560 Ω ±1%, ¼ W | 1 |
| Resistor de 10 kΩ para manter OFF na partida | 1 |
| Resistor de 10 kΩ para usar como carga ou polarização de teste | 1 |
| Protoboard, jumpers e multímetro | Conforme necessário |

1. Alimente os dois módulos com 3,3 V e ligue o GND dos módulos ao GND do ESP32.
2. Ligue o terminal comum `SIG` do primeiro módulo a 3,3 V através de **560 Ω**. Ligue o `SIG` do segundo a GND.
3. Ligue `C0` dos dois módulos ao nó 0. Repita para `C1` e `C2`, nos nós 1 e 2.
4. Ligue `S2` e `S3` de cada módulo a GND. Use quatro GPIOs, dois para `S0/S1` do módulo da fonte e dois para `S0/S1` do módulo de GND.
5. Ligue os dois `EN` a um quinto GPIO e use um resistor de **10 kΩ entre EN e 3,3 V**. Confira se o módulo expõe `EN` e se a própria placa permite que o pull-up o mantenha alto. No CD74HC4067, `EN` alto desliga todos os canais.

Para aplicar `POWER 0 1`, coloque `EN` em nível alto, selecione o canal 0 no módulo da fonte e o canal 1 no módulo de GND, e então coloque `EN` em nível baixo. Em `POWER 0 2`, o GND passa para o nó 2. `OFF` mantém `EN` alto. A ordem dos argumentos é **nó da fonte, nó do GND**. Um pedido como `POWER 0 0` deve retornar erro e deixar a saída em OFF.

### Bancada

- Com `POWER 0 1` ativo, coloque 10 kΩ entre os nós 0 e 1. Espere cerca de **3,1 V** entre eles, com a ponta vermelha no nó 0. Repita entre os nós 0 e 2 após `POWER 0 2`.
- Remova a carga entre os nós e verifique o nó que sobrou. Passe o resistor de 10 kΩ do nó para GND e espere perto de 0 V. Depois passe o resistor do nó para 3,3 V e espere perto de 3,3 V.
- Envie `OFF`. Polarize o antigo nó da fonte para GND com 10 kΩ e espere perto de 0 V. Polarize o antigo nó de GND para 3,3 V com 10 kΩ e espere perto de 3,3 V. Faça uma medição por vez.
- Com o ESP32 em reset e a alimentação de 3,3 V presente, confira se `EN` permanece alto. Registre as leituras reais. Os valores acima são previsões.

[Datasheet TI CD74HC4067 e CD74HCT4067](https://www.ti.com/lit/ds/symlink/cd74hc4067.pdf)

## Passagem para 5 V

Use a mesma fonte regulada de 5 V para alimentar os multiplexadores e para alimentar o terminal comum da fonte através do resistor de 560 Ω. O CD74HC4067 alimentado a 5 V requer adaptação de nível para os controles do ESP32. Para três nós, um **74AHCT125** alimentado a 5 V pode traduzir os quatro sinais de endereço. Para `EN`, um pull-up para 5 V no lado dos módulos e um transistor acionado pelo ESP32 preservam o padrão OFF quando o GPIO é liberado. Uma alternativa é usar peças **CD74HCT4067** em adaptadores, com entradas de controle compatíveis com níveis TTL. Confirme a variante impressa no componente.

O resistor de **560 Ω ±1%** limita um curto alimentado por uma fonte de até 5,25 V a aproximadamente **9,5 mA**, independentemente do firmware. Com uma fonte de 5,00 V e carga de 10 kΩ entre dois nós ativos, espere cerca de **4,7 V**. A queda depende da carga e da resistência dos dois canais ativos.

[Datasheet TI 74AHCT125](https://www.ti.com/lit/ds/symlink/sn74ahct125.pdf)

## Dois bancos de 11

- Use quatro multiplexadores analógicos bidirecionais 16:1, dois por banco. Em cada banco, cada nó vai ao canal de mesmo índice nos dois multiplexadores. São **44 ligações** entre canais e nós.
- Compartilhe os quatro sinais de endereço da fonte entre os bancos. Faça o mesmo com os quatro sinais de endereço de GND. Com seleção de banco e habilitação global, o total é de **10 GPIOs**.
- Use um único limitador no ramal de +5 V que alimenta os terminais comuns dos multiplexadores da fonte.
- Use um decodificador com habilitação global para selecionar somente um banco em estado estável. Desabilite os bancos antes de mudar o endereço ou a seleção de banco. O firmware valida o par de nós, o decodificador seleciona o banco e o limitador restringe a corrente da fonte.
- Na proposta com **ADG706**, as habilitações são ativas em nível alto. Um **74HC238 a 3,3 V** pode produzi-las, com a habilitação global puxada para baixo na partida. Se usar **CD74HC4067**, adapte a lógica às habilitações ativas em nível baixo e aos níveis de controle em 5 V.
- Para endereços globais, use **0–10** no banco A e **11–21** no banco B. Subtraia 11 dos endereços do banco B antes de enviá-los aos multiplexadores.

O ADG706 é uma opção de lógica direta com o ESP32 quando o multiplexador está alimentado em 5 V. O encapsulamento TSSOP-28 requer um adaptador soldado para a protoboard. Os módulos CD74HC4067 com pinos prontos simplificam a montagem inicial.

[Datasheet Analog Devices ADG706](https://www.analog.com/media/en/technical-documentation/data-sheets/ADG706_707.pdf) · [Datasheet Nexperia 74HC238](https://assets.nexperia.com/documents/data-sheet/74HC_HCT238.pdf)

## Mensagem para a Beta

> Oi! Vocês têm **módulo multiplexador analógico CD74HC4067 de 16 canais**? Preciso de **duas unidades** para testar em uma protoboard. Se tiverem a versão com os **pinos de 2,54 mm já soldados**, melhor.
>
> Qual é o valor por unidade? Tem estoque para retirada na loja?

Para Curitiba, sede Centro, a Paresteck também foi mencionada como opção para consultar. O endereço do catálogo é Rua 24 de Maio, 297, Loja 03. O estoque local do módulo não foi confirmado. [Paresteck](https://catalogo.paresteck.com.br/) · [Listagem do módulo na RoboBuilders](https://www.robobuilders.com.br/produto/modulo-multiplexador-cd74hc4067.html)

## Protótipo de três nós com 74HC4051

O [roteiro de bancada e sketch para ESP32](firmware/component_testing/hc4051_power_router/README.md) documentam os GPIOs e os comandos em 3,3 V. O sketch cobre até oito nós. Na montagem inicial, configure `sweepOnBoot = false`, use somente comandos com nós 0 a 2 e mantenha S2 dos dois CIs no GND.

A Beta informou que tem **SN74HC4051** e que o módulo CD74HC4067 está em falta. Confirme a marcação completa e o encapsulamento. Um CI em DIP-16 encaixa diretamente na protoboard. Dois CIs cobrem **até oito nós no mesmo banco**, com um seletor para a fonte e outro para GND.

### Pinagem para montar o primeiro par

A referência desta tabela é o CD74HC4051 da TI. Confira a versão entregue pela loja antes de ligar.

| Pino | Ligação |
|---|---|
| 16 | 3,3 V no primeiro teste. Coloque 100 nF entre os pinos 16 e 8 de cada CI. |
| 7 e 8 | GND comum com o ESP32 |
| 3, COM | Fonte através de 560 Ω em um CI. GND direto no outro. |
| 11, 10 e 9 | S0, S1 e S2. Use dois GPIOs por CI e prenda S2 ao GND no teste de três nós. Para oito nós, controle também S2. |
| 6, EN | Alto abre todos os canais. No primeiro par, una os dois EN e use um GPIO e um pull-up de 10 kΩ para 3,3 V. |
| Canais 0 a 7 | Pinos 13, 14, 15, 12, 1, 5, 2 e 4, em ordem. Una o mesmo canal dos dois CIs para formar cada nó. |

O teste de três nós segue o roteiro do sketch. Use os canais 0 a 2. Em cada troca, coloque EN alto, atualize os endereços da fonte e do GND e só então coloque EN baixo. Mantenha a PCB original desconectada.

### Dois bancos de oito nós

Se os três nós centrais de **cada banco** ficarem sem ligação, sobram oito em cima e oito embaixo. Monte um par de 74HC4051 por banco, **quatro CIs no total**. Se o recorte for de **oito nós no total**, por exemplo quatro em cima e quatro embaixo, um único par basta. Nesse caso o firmware precisa rejeitar pares que atravessem os grupos.

Para os dois bancos de oito, compartilhe os três bits da fonte entre os dois CIs da fonte e os três bits de GND entre os dois CIs de GND. Alimente os dois COM da fonte após **um único resistor de 560 Ω**. Os dois COM de GND vão ao GND comum.

Use metade de um **74HC139 a 3,3 V**. Ligue A1 a GND e A0 ao GPIO de seleção do banco. Y0 vai aos dois EN de cima e Y1 aos dois EN de baixo. A habilitação ativa baixa do 74HC139 recebe outro GPIO e um pull-up de 10 kΩ para 3,3 V. Com a habilitação alta, ambos os bancos ficam OFF. Habilite só depois de ajustar banco e endereços. Com a outra metade do decodificador desabilitada, mantenha suas entradas em níveis definidos. A montagem usa **oito GPIOs**.

### Uso dos 74HC4051 em 5 V

Alimente os 74HC4051 em 5 V e use a mesma fonte no ramal de 560 Ω. Traduza os controles de 3,3 V para o nível lógico de 5 V. Para três nós, um 74AHCT125 cobre os quatro sinais de endereço. Para o EN do par, use pull-up de 10 kΩ para 5 V no lado dos CIs e um NPN para puxar EN ao GND, com resistor em série na base e pull-down na base. GPIO alto habilita a rota. GPIO liberado deixa o par OFF. O pino do ESP32 fica no lado de 3,3 V do driver. Para dois bancos, preserve a seleção exclusiva e traduza também os sinais de habilitação que chegam aos multiplexadores de 5 V.

[Datasheet TI 74HC4051](https://www.ti.com/lit/ds/symlink/cd74hc4051.pdf) · [Datasheet Nexperia 74HC139](https://www.nexperia.com/product/74HC139D)

Veja também [Pulso e voltímetro nas posições inteligentes](PULSO_E_VOLTIMETRO.md).
