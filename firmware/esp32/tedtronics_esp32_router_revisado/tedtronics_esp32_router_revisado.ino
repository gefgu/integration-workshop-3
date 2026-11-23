/*
  TedTronics — Controlador ESP32 / duas placas MT8816AE (revisao 2)

  Base de verificacao: arquivo EasyEDA
  ProPrj_Oficias_agrVai_deusehbom_2lados_2026-11-09(1).epro2

  PCB A (U1): NODE00..NODE10 -> X0..X10
  PCB B (U2): NODE11..NODE21 -> X0..X10

  Dois 74HC595 em cascata na PCB A:
    U5 QA..QH = AX0, AX1, AX2, AX3, AY0, AY1, AY2, DATA
    U5 QH' -> U6 SER
    U6 QA = CS_A; U6 QB = CS_B

  GPIOs ESP32 -> transistores inversores BC548:
    23 SER, 18 SCK, 22 RCK, 19 STROBE, 21 OE#
    25 RESET dos dois MT8816 (LOW na ESP32 = RESET alto = tudo aberto)

  Somente Y5/Y6/Y7 sao usados para conexoes genericas.
  Barramentos A_BUS1..3 e B_BUS1..3 NAO estao interligados no projeto.

  ATENCAO:
  - CONFIGURAR_PONTES_AB pode ser true APENAS depois de unir fisicamente
    Y5 <-> Y5, Y6 <-> Y6 e Y7 <-> Y7 entre as placas, e testar continuidade.
  - O firmware nao mede corrente nem tensao, nem detecta curtos.
  - Nao usar a matriz para cargas elevadas: MT8816 tem resistencia ON
    significativa e limite absoluto de +/-15 mA por pino analogico.
  - Protocolo serial: 115200, comandos terminados em NL ou CR.
*/

#include <Arduino.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

namespace Ted {

constexpr uint8_t PIN_SER   = 23;
constexpr uint8_t PIN_SCK   = 18;
constexpr uint8_t PIN_RCK   = 22;
constexpr uint8_t PIN_STB   = 19;
constexpr uint8_t PIN_OE    = 21;
constexpr uint8_t PIN_RST   = 25;

// Geradores de sinais da placa B: esta versao os mantem sempre DESLIGADOS.
constexpr uint8_t PIN_TEST  = 14;
constexpr uint8_t PIN_PULSE_HI = 26;
constexpr uint8_t PIN_PULSE_LO = 27;

constexpr bool CONFIGURAR_PONTES_AB = false;  // NUNCA habilitar sem pontes reais.
constexpr uint8_t NUM_NODES = 22;
constexpr uint8_t NODES_PLACA = 11;
constexpr uint8_t BUS_INICIAL = 5;
constexpr uint8_t BUS_FINAL = 7;
constexpr uint32_t BAUD = 115200;
constexpr size_t TAM_LINHA = 96;
constexpr uint16_t T_SHIFT_US = 6;
constexpr uint16_t T_LATCH_US = 15;
constexpr uint16_t T_STROBE_US = 30;

// Matriz de arestas de solicitacao; componentes conexos formam redes.
// Nenhuma ligacao persiste apos um reinicio da ESP32.
bool aresta[NUM_NODES][NUM_NODES] = {};
bool resetAtivo = true; // estado COMANDADO, nao retorno eletrico.
char linhaSerial[TAM_LINHA];
size_t tamanhoLinha = 0;
bool linhaEstourou = false;

struct Plano {
  int8_t barramento[NUM_NODES]; // -1 isolado; 5/6/7 se conectado
  uint8_t redesPorPlaca[2];
  uint8_t totalRedes;
};

// GPIO no nivel alto -> BC548 conduz -> sinal no CI em nivel baixo.
inline void sinalCI(uint8_t gpio, bool alto) {
  digitalWrite(gpio, alto ? LOW : HIGH);
}

// U6 recebe o byte ALTO; U5 recebe o byte BAIXO.
// Transmissao: bit 15 primeiro, ate bit 0.
void carregarRegistradores(uint16_t palavra) {
  sinalCI(PIN_SCK, false);
  for (int8_t bit = 15; bit >= 0; --bit) {
    sinalCI(PIN_SER, (palavra & (uint16_t(1U) << bit)) != 0);
    delayMicroseconds(T_SHIFT_US);
    sinalCI(PIN_SCK, true);     // borda de subida no SCK do 74HC595
    delayMicroseconds(T_SHIFT_US);
    sinalCI(PIN_SCK, false);
    delayMicroseconds(T_SHIFT_US);
  }
  sinalCI(PIN_RCK, true);        // atualiza saidas paralelas
  delayMicroseconds(T_LATCH_US);
  sinalCI(PIN_RCK, false);
  delayMicroseconds(T_LATCH_US);
}

// GPIO25 LOW desliga Q6/Q12; os pull-ups levam o RESET dos CIs a 12 V.
void afirmarReset() {
  digitalWrite(PIN_RST, LOW);
  resetAtivo = true;
  delay(5);
}

// GPIO25 HIGH conduz Q6/Q12, levando RESET dos CIs a GND.
void liberarReset() {
  digitalWrite(PIN_RST, HIGH);
  resetAtivo = false;
  delay(2);
}

// Em qualquer reset: STROBE baixo, RESET afirmado, registradores zerados.
void zerarHardware() {
  sinalCI(PIN_STB, false);
  afirmarReset();
  sinalCI(PIN_OE, true);         // 74HC595 OE# alto -> saidas em alta impedancia
  carregarRegistradores(0);     // zera ambos bytes de controle
  sinalCI(PIN_OE, false);        // OE# baixo -> CS_A / CS_B = 0
  delay(1);
}

// Escreve UM crosspoint. Os outros crosspoints mantem o estado anterior.
// CS e STROBE precisam ficar altos para escrever. A memoria e fixada
// na borda de DESCIDA de STROBE, conforme datasheet do MT8816AE.
void escreverCrosspoint(uint8_t placa, uint8_t x, uint8_t y, bool ligar) {
  if (resetAtivo || placa > 1 || x > 15 || y > 7) return;
  uint8_t u5 = uint8_t((x & 0x0F) | ((y & 0x07) << 4));
  if (ligar) u5 |= 0x80;         // DATA=1 liga, DATA=0 abre
  uint8_t u6 = (placa == 0) ? 0x01 : 0x02; // QA=CS_A, QB=CS_B

  sinalCI(PIN_STB, false);
  carregarRegistradores((uint16_t(u6) << 8) | u5);
  delayMicroseconds(T_STROBE_US); // estabilizacao enderecos/CS/DATA
  sinalCI(PIN_STB, true);
  delayMicroseconds(T_STROBE_US);
  sinalCI(PIN_STB, false);
  delayMicroseconds(T_STROBE_US);
  carregarRegistradores(0);     // retira CS antes de proxima escrita
}

uint8_t raiz(uint8_t pai[], uint8_t n) {
  while (pai[n] != n) {
    pai[n] = pai[pai[n]];
    n = pai[n];
  }
  return n;
}

void unir(uint8_t pai[], uint8_t a, uint8_t b) {
  const uint8_t ra = raiz(pai, a);
  const uint8_t rb = raiz(pai, b);
  if (ra != rb) pai[rb] = ra;
}

// Planeja antes de alterar hardware; rejeita tentativas alem da capacidade.
bool montarPlano(Plano &p) {
  uint8_t pai[NUM_NODES];
  uint8_t integrantes[NUM_NODES] = {};
  int8_t barramentoRaiz[NUM_NODES];
  uint8_t proximoY[2] = {BUS_INICIAL, BUS_INICIAL};
  for (uint8_t n = 0; n < NUM_NODES; ++n) {
    pai[n] = n;
    barramentoRaiz[n] = -1;
    p.barramento[n] = -1;
  }

  for (uint8_t a = 0; a < NUM_NODES; ++a) {
    for (uint8_t b = a + 1; b < NUM_NODES; ++b) {
      if (!aresta[a][b]) continue;
      if (!CONFIGURAR_PONTES_AB && a / NODES_PLACA != b / NODES_PLACA)
        return false;
      unir(pai, a, b);
    }
  }
  for (uint8_t n = 0; n < NUM_NODES; ++n)
    ++integrantes[raiz(pai, n)];

  p.redesPorPlaca[0] = p.redesPorPlaca[1] = p.totalRedes = 0;
  for (uint8_t n = 0; n < NUM_NODES; ++n) {
    uint8_t r = raiz(pai, n);
    if (integrantes[r] < 2) continue;
    if (barramentoRaiz[r] < 0) {
      const uint8_t indice = CONFIGURAR_PONTES_AB ? 0 : n / NODES_PLACA;
      if (proximoY[indice] > BUS_FINAL) return false;
      barramentoRaiz[r] = int8_t(proximoY[indice]++);
      ++p.redesPorPlaca[indice];
      ++p.totalRedes;
    }
    p.barramento[n] = barramentoRaiz[r];
  }
  return true;
}

// BREAK-BEFORE-MAKE: abre TUDO antes de configurar o novo plano.
void aplicarPlano(const Plano &p) {
  zerarHardware();
  if (p.totalRedes == 0) return; // deixa RESET ativo quando vazio
  liberarReset();
  for (uint8_t n = 0; n < NUM_NODES; ++n) {
    if (p.barramento[n] < 0) continue;
    uint8_t placa = n / NODES_PLACA;
    uint8_t x = n % NODES_PLACA;
    escreverCrosspoint(placa, x, uint8_t(p.barramento[n]), true);
  }
  carregarRegistradores(0); // ambos CS inativos; MEMORIA permanece
}

void imprimirNode(uint8_t n) {
  Serial.print(F("NODE"));
  if (n < 10) Serial.print('0');
  Serial.print(n);
}

bool interpretarNode(const char *s, uint8_t &out) {
  if (!s) return false;
  if (strncmp(s, "NODE", 4) == 0) s += 4;
  else if (*s == 'N') ++s;
  if (!*s) return false;
  for (const char *c = s; *c; ++c)
    if (!isdigit((unsigned char)*c)) return false;
  char *fim = nullptr;
  const long n = strtol(s, &fim, 10);
  if (*fim || n < 0 || n >= NUM_NODES) return false;
  out = uint8_t(n);
  return true;
}

uint16_t contarArestas() {
  uint16_t num = 0;
  for (uint8_t a = 0; a < NUM_NODES; ++a)
    for (uint8_t b = a + 1; b < NUM_NODES; ++b)
      if (aresta[a][b]) ++num;
  return num;
}

void ajuda() {
  Serial.println(F("\n=== TedTronics MT8816AE — comandos ==="));
  Serial.println(F("CONNECT 0 5        | LIGAR / JUNTAR: unir dois nodes"));
  Serial.println(F("CONNECT NODE05 N07 | tambem aceita NODE05 e N07"));
  Serial.println(F("DISCONNECT 0 5     | DESLIGAR: remove aresta solicitada"));
  Serial.println(F("ISOLATE 5          | ISOLAR: remove todas as arestas do node"));
  Serial.println(F("LIST               | LISTAR: grupos e conexoes logicas"));
  Serial.println(F("MAP                | MAPA: crosspoints X/Y programados"));
  Serial.println(F("STATUS             | ESTADO: estado logico e limites"));
  Serial.println(F("REAPPLY            | REAPLICAR: regrava roteamento da RAM"));
  Serial.println(F("RESET              | LIMPAR / STOP: abre todos os crosspoints"));
  Serial.println(F("HELP               | AJUDA"));
  Serial.println(F("Sinais TEST_BUS e PULSE_BUS sao mantidos DESLIGADOS."));
  if (!CONFIGURAR_PONTES_AB)
    Serial.println(F("CROSS-PLACA bloqueado: Y5/Y6/Y7 nao interligados."));
}

void listar() {
  Serial.println(F("\n--- Arestas logicas ---"));
  bool alguma = false;
  for (uint8_t a = 0; a < NUM_NODES; ++a) {
    for (uint8_t b = a + 1; b < NUM_NODES; ++b) {
      if (!aresta[a][b]) continue;
      imprimirNode(a); Serial.print(F(" <-> ")); imprimirNode(b); Serial.println();
      alguma = true;
    }
  }
  if (!alguma) Serial.println(F("(nenhuma)"));
  Plano p;
  if (!montarPlano(p)) {
    Serial.println(F("ERRO: plano invalido em RAM"));
    return;
  }
  Serial.println(F("--- Redes logicas planejadas (sem confirmacao eletrica) ---"));
  for (uint8_t placa = 0; placa < (CONFIGURAR_PONTES_AB ? 1 : 2); ++placa) {
    for (uint8_t y = BUS_INICIAL; y <= BUS_FINAL; ++y) {
      bool encontrou = false;
      for (uint8_t n = 0; n < NUM_NODES; ++n) {
        if (p.barramento[n] != y) continue;
        if (!CONFIGURAR_PONTES_AB && n / NODES_PLACA != placa) continue;
        if (!encontrou) {
          Serial.print(F("Y")); Serial.print(y);
          if (!CONFIGURAR_PONTES_AB) {
            Serial.print(F(" [placa ")); Serial.print(placa ? 'B' : 'A');
            Serial.print(']');
          }
          Serial.print(F(": "));
          encontrou = true;
        }
        imprimirNode(n); Serial.print(' ');
      }
      if (encontrou) Serial.println();
    }
  }
  if (p.totalRedes == 0) Serial.println(F("(todos os nodes isolados)"));
}

void mapa() {
  Plano p;
  if (!montarPlano(p)) { Serial.println(F("ERRO: plano invalido")); return; }
  Serial.println(F("\n--- Crosspoints selecionados ---"));
  if (p.totalRedes == 0) { Serial.println(F("(nenhum)")); return; }
  for (uint8_t n = 0; n < NUM_NODES; ++n) {
    if (p.barramento[n] < 0) continue;
    const uint8_t placa = n / NODES_PLACA;
    const uint8_t x = n % NODES_PLACA;
    imprimirNode(n);
    Serial.print(F(" -> U")); Serial.print(placa ? 2 : 1);
    Serial.print(F(" X")); Serial.print(x);
    Serial.print(F(" Y")); Serial.println(p.barramento[n]);
  }
  Serial.println(F("Mapa logico: nao comprova continuidade na PCB."));
}

void estado() {
  Plano p;
  const bool valido = montarPlano(p);
  Serial.print(F("RESET comandado: "));
  Serial.println(resetAtivo ? F("ATIVO (aberto)") : F("LIBERADO"));
  Serial.print(F("Arestas solicitadas: ")); Serial.println(contarArestas());
  Serial.print(F("Redes alocadas: "));
  if (valido) Serial.println(p.totalRedes);
  else Serial.println(F("ERRO no plano"));
  Serial.print(F("Pontes Y5..Y7 A/B: "));
  Serial.println(CONFIGURAR_PONTES_AB ? F("CONFIGURADAS PELO USUARIO") : F("NAO CONFIGURADAS"));
  Serial.println(F("Sem leitura de tensao, corrente ou confirmacao fisica."));
}

void conectar(uint8_t a, uint8_t b) {
  if (a == b) { Serial.println(F("ERRO: selecione nodes diferentes.")); return; }
  if (!CONFIGURAR_PONTES_AB && a / NODES_PLACA != b / NODES_PLACA) {
    Serial.println(F("ERRO: nodes de placas diferentes sem pontes Y5/Y6/Y7."));
    return;
  }
  if (aresta[a][b]) { Serial.println(F("OK: aresta ja cadastrada.")); return; }
  aresta[a][b] = aresta[b][a] = true;
  Plano p;
  if (!montarPlano(p)) {
    aresta[a][b] = aresta[b][a] = false;  // transacao revertida
    Serial.println(F("ERRO: capacidade excedida (3 redes independentes por placa)."));
    return;
  }
  aplicarPlano(p);
  Serial.print(F("OK: ")); imprimirNode(a);
  Serial.print(F(" unido a ")); imprimirNode(b);
  Serial.println(F(". Matriz reprogramada."));
}

void desconectar(uint8_t a, uint8_t b) {
  if (a == b || !aresta[a][b]) {
    Serial.println(F("ERRO: aresta inexistente.")); return;
  }
  aresta[a][b] = aresta[b][a] = false;
  Plano p;
  if (!montarPlano(p)) {
    aresta[a][b] = aresta[b][a] = true;
    Serial.println(F("ERRO interno: plano invalido, sem alteracoes.")); return;
  }
  aplicarPlano(p);
  Serial.println(F("OK: aresta removida; conexoes restantes preservadas."));
  Serial.println(F("AVISO: outro caminho pode manter os dois nodes unidos."));
}

void isolar(uint8_t n) {
  for (uint8_t i = 0; i < NUM_NODES; ++i)
    aresta[n][i] = aresta[i][n] = false;
  Plano p;
  if (!montarPlano(p)) {
    memset(aresta, 0, sizeof(aresta));
    zerarHardware();
    Serial.println(F("ERRO interno: RESET geral por seguranca.")); return;
  }
  aplicarPlano(p);
  Serial.print(F("OK: ")); imprimirNode(n);
  Serial.println(F(" isolado da matriz logica."));
}

bool semArgumentos(const char *a, const char *b, const char *c) {
  if (a || b || c) {
    Serial.println(F("ERRO: comando nao aceita argumentos.")); return false;
  }
  return true;
}

void processarLinha(char *linha) {
  for (char *p = linha; *p; ++p)
    *p = char(toupper((unsigned char)*p));
  const char *sep = " \t,;";
  char *cmd = strtok(linha, sep);
  if (!cmd) return;
  char *a = strtok(nullptr, sep);
  char *b = strtok(nullptr, sep);
  char *c = strtok(nullptr, sep);

  if (!strcmp(cmd, "HELP") || !strcmp(cmd, "AJUDA")) {
    if (semArgumentos(a,b,c)) ajuda();
    return;
  }
  if (!strcmp(cmd, "RESET") || !strcmp(cmd, "LIMPAR") || !strcmp(cmd, "STOP")) {
    // RESET de emergencia deve funcionar ate com argumentos inesperados.
    memset(aresta, 0, sizeof(aresta));
    zerarHardware();
    Serial.println(F("OK: todas as chaves abertas; RESET mantido ATIVO.")); return;
  }
  if (!strcmp(cmd, "LIST") || !strcmp(cmd, "LISTAR")) {
    if (semArgumentos(a,b,c)) listar();
    return;
  }
  if (!strcmp(cmd, "MAP") || !strcmp(cmd, "MAPA")) {
    if (semArgumentos(a,b,c)) mapa();
    return;
  }
  if (!strcmp(cmd, "STATUS") || !strcmp(cmd, "ESTADO")) {
    if (semArgumentos(a,b,c)) estado();
    return;
  }
  if (!strcmp(cmd, "REAPPLY") || !strcmp(cmd, "REAPLICAR")) {
    if (!semArgumentos(a,b,c)) return;
    Plano p;
    if (montarPlano(p)) { aplicarPlano(p); Serial.println(F("OK: plano regravado.")); }
    else { memset(aresta,0,sizeof(aresta)); zerarHardware();
           Serial.println(F("ERRO: plano invalido; RESET geral por seguranca.")); }
    return;
  }

  const bool ehConnect = !strcmp(cmd,"CONNECT") || !strcmp(cmd,"LIGAR") || !strcmp(cmd,"JUNTAR");
  const bool ehDisconnect = !strcmp(cmd,"DISCONNECT") || !strcmp(cmd,"DESLIGAR");
  const bool ehIsolate = !strcmp(cmd,"ISOLATE") || !strcmp(cmd,"ISOLAR");
  if (ehIsolate) {
    uint8_t n;
    if (!interpretarNode(a,n) || b) { Serial.println(F("Uso: ISOLATE 5")); return; }
    isolar(n); return;
  }
  if (ehConnect || ehDisconnect) {
    uint8_t na,nb;
    if (!interpretarNode(a,na) || !interpretarNode(b,nb) || c) {
      Serial.println(F("Uso: CONNECT 0 5 ou DISCONNECT 0 5")); return;
    }
    if (ehConnect) conectar(na,nb);
    else desconectar(na,nb);
    return;
  }
  Serial.println(F("ERRO: comando desconhecido. Use HELP."));
}

} // namespace Ted

void setup() {
  // Definir niveis de saida antes de configurar cada GPIO como OUTPUT.
  // Hardware: resistores de pulldown nas bases; RESET puxa para 12 V
  // durante boot, desde que as duas alimentacoes estejam corretas.
  digitalWrite(Ted::PIN_RST, LOW);      pinMode(Ted::PIN_RST, OUTPUT);
  digitalWrite(Ted::PIN_STB, HIGH);     pinMode(Ted::PIN_STB, OUTPUT);
  digitalWrite(Ted::PIN_OE, LOW);       pinMode(Ted::PIN_OE, OUTPUT);
  digitalWrite(Ted::PIN_SER, HIGH);     pinMode(Ted::PIN_SER, OUTPUT);
  digitalWrite(Ted::PIN_SCK, HIGH);     pinMode(Ted::PIN_SCK, OUTPUT);
  digitalWrite(Ted::PIN_RCK, HIGH);     pinMode(Ted::PIN_RCK, OUTPUT);

  // Inibe os drivers especiais de sinais na PCB B (GPIO HIGH os ativaria).
  digitalWrite(Ted::PIN_TEST, LOW);     pinMode(Ted::PIN_TEST, OUTPUT);
  digitalWrite(Ted::PIN_PULSE_HI, LOW); pinMode(Ted::PIN_PULSE_HI, OUTPUT);
  digitalWrite(Ted::PIN_PULSE_LO, LOW); pinMode(Ted::PIN_PULSE_LO, OUTPUT);

  Ted::zerarHardware();
  Serial.begin(Ted::BAUD);
  Serial.println(F("\nTedTronics — ESP32 / 2x MT8816AE — REVISAO 2"));
  Serial.println(F("Boot: RESET ativo. Nenhum crosspoint solicitado."));
  Ted::ajuda();
}

void loop() {
  while (Serial.available() > 0) {
    const char c = char(Serial.read());
    if (c == '\r' || c == '\n') {
      if (Ted::linhaEstourou) {
        Serial.println(F("ERRO: linha longa demais; ignorada."));
      } else {
        Ted::linhaSerial[Ted::tamanhoLinha] = '\0';
        Ted::processarLinha(Ted::linhaSerial);
      }
      Ted::tamanhoLinha = 0;
      Ted::linhaEstourou = false;
    } else if (!Ted::linhaEstourou) {
      if (Ted::tamanhoLinha + 1 < Ted::TAM_LINHA)
        Ted::linhaSerial[Ted::tamanhoLinha++] = c;
      else Ted::linhaEstourou = true;
    }
  }
}
