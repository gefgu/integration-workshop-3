# Guia provisório da perfboard do roteador

`wiring-guide.pdf`: guia PT-BR com vistas TOP/inferior, coordenadas provisórias, ligações numeradas, funções, cabos e testes. Candidato elétrico preservado em `../pcb-hct14-1face`. Malha de 37×75 assumida por autorização do usuário; não medida. Não libera soldagem antes do encaixe real e revisão.

`parts.csv`, `pins.csv`, `wires.csv`: conferência por terminais. `verification.json`: equivalência de redes, sem alegação de roteamento físico ou ensaio. Não é PCB corroída nem um novo roteador automático: linhas pontilhadas ilustram apenas origem/destino de fios isolados.

Gerar: `python3 generate.py` e depois `/home/gustavo/.cargo/bin/typst compile wiring-guide.typ` neste diretório. Reutiliza esquemas nativos já exportados do candidato, sem números de peça de conectores.

## Mudança de escopo

O usuário optou pela PCB de uma face. Este guia de perfboard fica como histórico; o candidato vigente está em [pcb-singleface-v2](../pcb-singleface-v2/README.md), com prova física e bancada ainda pendentes. Não misturar as posições, conectores ou listas de fios dos dois candidatos.
