# Roteamento dos 22 nós — discussão de arquitetura

Pedido de 25/10/2026: ler os dois PDFs da raiz, retirar a função de resistor variável/selecionável do novo escopo e planejar o restante com perguntas antes de fechar esquema e fiação.

- [PDF inicial de planejamento, 4:3, cinco páginas](planejamento-22-nos-v01.pdf)
- [Fonte Typst](planejamento.typ)

Estado: rodada 1 de perguntas enviada; nenhuma resposta recebida no momento desta versão. Documento de planejamento, não esquema elétrico fechado nem instrução para soldar. PDFs recebidos e hardware de revisões anteriores preservados. Não há retrabalho autorizado por este arquivo.

## Hipóteses a confirmar

- Remover todo banco de resistores didáticos selecionáveis, e não apenas um potenciômetro. Manter resistores de proteção/medição e peças didáticas físicas.
- Base de comparação: 2 MT/8 buses e 3 MT/16 buses. Três chips é proposta, não escolha aprovada. Um quarto chip não é necessário apenas para oferecer o banco removido.
- Y6/Y7 de U3 poderiam servir de portas de medição no modelo de três chips; circuito, retorno, isolamento, carregamento e precisão ainda pendentes.
- O relato de LED apagado dos PDFs é histórico; não afirmar que o protótipo continua falhando sem a atualização do usuário.
- Placa de energia regulada não comprova proteção do ramo didático ou corte por falha.
- O ADC simplificado da placa inteligente não implementa automaticamente o contrato histórico de continuidade de precisão (≤20Ω/≥100Ω).

## Próxima rodada

Inventário/fotos/medidas; quantidade e ensaios dos MT; definição de continuidade e pontos observáveis; exemplos de exercícios; quantidade de nets simultâneas; funções inteligentes finais; saídas/limites/corte da alimentação; comunicação das duas ESP32 com o Pi; dimensões e conectores reais. Só então fechar o esquema tscircuit colorido 4:3, mapa de soldagem, BOM e testes físicos.

Regenerar: `typst compile planejamento.typ planejamento-22-nos-v01.pdf` nesta pasta.

## Atualização v02 — respostas do usuário

[PDF atualizado](planejamento-22-nos-v02.pdf), [fonte](planejamento-v02.typ).

Confirmados: retirar banco de resistores, manter peças encaixáveis; até 5 MT disponíveis; um LED acendeu no protótipo; continuidade entre dois nós antes de rodar com energia didática desligada; um par por vez; voltímetro e pulso apenas nas posições inteligentes; sem amperímetro; pulso inicial 0–5V/0,5–10Hz/50%; quatro exercícios (LED/resistor, botão/LED, série/paralelo, RC); ESP1 por USB, ESP2 por UART32/33; placa inteligente soldada; pogos em construção; energia/proteção relatadas prontas. Fotos e dimensões pendentes amanhã.

Base ainda proposta: 3 MT/16 barramentos; Y6/Y7 para aquisição/diagnóstico precisam de circuito fechado. Notion solicitado explicitamente, mas sem conector nesta sessão e acesso web ao link privado falhou; não declarar requisitos atuais verificados. Print/texto dos requisitos solicitado. Arquivos locais antigos incluem P1/P2, P3, portas lógicas e memória; estes últimos modos não foram confirmados no novo escopo. Número de pulsos simultâneos também solicitado. O v01 é histórico, não a lista atual de decisões.

## Atualização v03 — Notion acessível; único gerador

[PDF atual](planejamento-22-nos-v03.pdf), [fonte](planejamento-v03.typ), [requisitos consultados](notion-requirements-2026-10-25.json).

A conexão Notion voltou a disponibilizar fetch/query nesta rodada. Leitura realizada em TedTronics → Requirements Table → Requirements, sem escritas. EFR32.2 confirma pulso P3/0,5–10Hz/duty25–75%; EFR32.3 confirma P1−P2/±5,25V/≥1MΩ/erro±(0,10V+5%)/≤100ms; EFR28/30/32 definem alta impedância, limite12mA e níveis sob2mA. Portas lógicas, memória e amperímetro são opcionais na base; amperímetro excluído explicitamente. Requisitos consultados ainda referem CH446Q em ENFR6: recalcular limites por chip real MT8816, sem transplantar valores agregados. EFR31/31.2 dizem três cápsulas/três posições, divergindo das seis posições previstas localmente; preservar placa soldada até confirmar mapa real.

Usuário aceitou somente um gerador ativo por vez. Não unir P3: selecionar e isolar a posição ativa. A medição 10k/10k é protótipo e não cumpre ≥1MΩ; requer frontend próprio antes de declarar o voltímetro final conforme. 50% é ajuste inicial local; 25–75% consta do requisito e permanece diferença explícita até fechar implementação. Fotos/dimensões/proteção real ainda pendentes.

## Atualização v04 — seis posições completas

[PDF atual](planejamento-22-nos-v04.pdf), [fonte](planejamento-v04.typ). Confirmado explicitamente: seis posições completas para receber as três peças intercambiáveis, até três ativas. Cada posição deve permitir P1/P2 para voltímetro e P3 para pulso, além dos contatos de serviço; apenas um gerador de pulsos ativo por vez. Pode haver geração/medição compartilhada com seleção e isolamento adequados: não unir os terminais das posições. A expansão de três para seis posições é decisão desta conversa, distinta do texto consultado no Notion; nenhuma escrita externa foi feita. Mapear P1/P2/P3 aos 22 nós depende da placa real; fotos/dimensões/condicionamento e proteção continuam pendentes.
