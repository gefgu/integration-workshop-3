# Protocolo app do professor ⇄ bancada

Este protocolo define como o app do professor no celular conversa com a bancada.
Ele cobre os requisitos SFR41, SFR43, SFR44, SFR45, SFR56, SFR57, SFR59 e SNFR8.

O código fica em dois lugares, com o mesmo enquadramento e as mesmas mensagens:

- [`protocol/bench.ts`](../protocol/bench.ts), em TypeScript, usado pelo app e pela UI da bancada.
- [`bench/service/protocol.py`](../bench/service/protocol.py), em Python, usado pelo serviço da bancada.

## Transportes

| Transporte | Onde | Status |
|---|---|---|
| **BLE GATT**: serviço `7e1d0001-7ed7-4b1c-9a6e-0c1e5f7a0000` | Bancada real (Raspberry Pi, BlueZ) | Pronto: periférico em [`bench_service/ble.py`](../bench/service/bench_service/ble.py) com `bless`; cliente no app com `react-native-ble-plx` (build de desenvolvimento). |
| **WebSocket** `ws://<bancada>:8765/ble` | Bancada simulada (`bench/service`) | Pronto. Usado no Expo Go e nos testes. |

As características do serviço GATT são estas:

| Característica | UUID | Direção | Propriedade |
|---|---|---|---|
| RX | `7e1d0002-…` | app → bancada | write (com resposta) |
| TX | `7e1d0003-…` | bancada → app | notify |

O nome anunciado é `TedTronics-<bench_id>`, e o anúncio traz o UUID do serviço (o app filtra a busca por ele).
Mantenha o `bench_id` curto (até ~18 caracteres): o nome vai na resposta de varredura, que tem 31 bytes.

Para ligar o BLE junto com o HTTP/WebSocket, no Raspberry Pi:

```
pip install -e '.[ble]'
python -m bench_service --db bench.sqlite3 --ble [--adapter hci0]
```

Os dois transportes rodam no mesmo processo e usam o mesmo `BenchStore`. Um `HELLO` por Bluetooth libera a tela da bancada, e os eventos são os mesmos nos dois caminhos.
Se o adaptador ou o BlueZ falharem, o serviço inteiro para com o erro, em vez de ficar no ar sem Bluetooth.

## Quadros

Uma mensagem JSON pode passar do MTU. Por isso ela é dividida em quadros de texto ASCII:

```
<msgId>|<índice>|<total>|<fatia do JSON>
```

O JSON é serializado só com ASCII: todo caractere fora do ASCII vira `\uXXXX` (`ensure_ascii=True` no Python, `asciiJson()` no TypeScript).
Assim um caractere é um byte, e cada quadro carrega até 150 caracteres do JSON, o que cabe num MTU de 185 bytes (182 bytes úteis) junto com o cabeçalho.
Sem isso, um texto com acentos passaria de 182 bytes: a notificação seria cortada, e a escrita viraria uma escrita longa, que o `bless` não remonta.

No BLE, cada quadro do app é uma escrita com resposta na RX. A bancada responde com uma notificação na TX por quadro, na ordem.
O app pede MTU 185 ao conectar (`requestMTU`, no Android).
O WebSocket usa exatamente os mesmos quadros, então a demo exercita o mesmo código do BLE.
O receptor remonta a mensagem pelo `msgId`, e quadros de mensagens diferentes podem chegar intercalados.

## Mensagens

Toda mensagem do app traz um `id`. A resposta da bancada repete esse valor em `re`.

| App → bancada | Resposta | O que faz |
|---|---|---|
| `HELLO {token, protocol}` | `WELCOME {...status}` ou `ERROR bad_token` | O `token` vem de `POST /bench/session`: um HMAC assinado pelo servidor com o segredo compartilhado `TEDTRONICS_BENCH_SECRET`. A bancada confere a assinatura e a validade **offline**. Se estiver tudo certo, desbloqueia a sessão (SFR43, SFR57). |
| `STATUS` | `STATUS {...}` | Devolve `bench_id`, se a bancada está desbloqueada, o pacote carregado e quantos eventos estão pendentes. |
| `LOAD_PACKAGE {package}` | `PACKAGE_OK {version_id}` | Recebe o pacote de `GET /bench/package/{módulo}?class_id=`: módulo, documentos das lições com `lessonVersion` e alunos com tag. O pacote novo substitui o anterior. Sessões já abertas continuam na versão em que começaram (SFR58). |
| `PULL_EVENTS {max, after_seq?}` | `EVENTS {events, remaining}` | Devolve até `max` eventos pendentes com `seq > after_seq`, em ordem de `seq` (SFR44). Para paginar, o app envia como `after_seq` o `seq` do último evento recebido. |
| `ACK_EVENTS {event_ids}` | `ACKED {deleted, pending_events}` | A bancada apaga os eventos que o servidor já confirmou. |

Qualquer mensagem que não seja `HELLO`, enviada antes de um `HELLO` válido, recebe `ERROR locked`.

## Evento

```json
{"event_id": "uuid", "student_id": 3, "nfc_code": "TAG-1", "kind": "step_done",
 "seq": 17, "at": "2026-10-20T13:02:11Z", "lesson_id": "l1", "module_id": 2,
 "lesson_version": "a1b2…", "step_idx": 3, "score": null, "duration_s": null}
```

`kind` pode ser um destes valores:

| `kind` | Quando acontece |
|---|---|
| `session` | O aluno saiu. Traz `duration_s`. |
| `step_done` | Um passo foi concluído. |
| `lesson_done` | A lição foi concluída. Traz `duration_s`. |
| `quiz_answer` | O aluno respondeu um quiz. |
| `challenge_score` | O desafio terminou. Traz `score` e `duration_s`. |

Todo evento leva `student_id` **e** `nfc_code` juntos, nunca só a tag (SNFR8).

## Ciclo de sincronização

1. No app, o professor faz login. O app chama `POST /bench/session` e recebe o token da bancada.
2. O app conecta na bancada e envia `HELLO`. A bancada se desbloqueia.
3. O app envia `PULL_EVENTS` e guarda os eventos recebidos na fila local.
4. Com internet, o app envia a fila para `POST /bench/sync`. O servidor responde `acked`.
5. O app envia `ACK_EVENTS` com os ids confirmados. A bancada apaga esses eventos.
6. Sem internet, a fila fica marcada como "pendente" e o app tenta de novo quando a rede voltar (SFR45, SNFR9).
   A bancada só apaga um evento depois do `ACK_EVENTS`. Se a conexão cair no meio, o pior que acontece é reenviar eventos, e o servidor descarta as duplicatas pelo `event_id` (SFR59).
7. Se quiser, o professor escolhe um módulo e uma turma, e o app envia `LOAD_PACKAGE`.
