// TedTronics - smart components firmware (base side, ESP32 DevKitC)
//
// One ESP32 runs up to 3 active passive capsules on 6 positions:
//   pulse source (EFR32.2), voltmeter (EFR32.3), ammeter at position 2 (EFR32.4),
//   logic gate (EFR32.1), 1-bit memory (EFR32.5), each with its own OLED (EFR31.x).
//
// Tasks:
//   loop()  core 1  serial commands + mux/ADC sensing + gate/memory logic
//   pulse   core 0  1 ms tick, P3 pulse edges through the 595 chain
//   i2c     core 0  capsule detection, INA219, OLED frames (one bus, 6 SDA lines)
//
// Type `help` in the Serial Monitor (115200 baud, newline).

#include <esp_arduino_version.h>
#include <esp_task_wdt.h>

#include "capsules.h"
#include "config.h"
#include "i2cbus.h"
#include "outputs.h"
#include "sensing.h"
#include "stats.h"

Stats g_stats;

static bool streamOn = false;

static void watchdogBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {.timeout_ms = WDT_TIMEOUT_MS, .idle_core_mask = 1, .trigger_panic = true};
  if (esp_task_wdt_reconfigure(&cfg) != ESP_OK) esp_task_wdt_init(&cfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_MS / 1000, true);
#endif
  esp_task_wdt_add(nullptr);  // loop task
}

static void printHelp() {
  Serial.println(F(
      "Commands (positions 0..5, max 3 active, ammeter only at 2):\n"
      "  set <p> off\n"
      "  set <p> pulse <hz 0.5-10> <duty 25-75>\n"
      "  set <p> volt\n"
      "  set 2 amm\n"
      "  set <p> gate <and|or|nand|nor|xor|not>\n"
      "  set <p> mem <d|sr>            d: P1=D, P2=clock   sr: P1=S, P2=R\n"
      "  demo <mix|volt|gate|off>      load a 3-capsule scenario\n"
      "  rail <on|off>                 firmware rail state (P3 outputs / ammeter)\n"
      "  status | stream <on|off> | scan\n"
      "  stats [reset]                 timings measured while running\n"
      "  bench                         micro-benchmarks + estimates\n"
      "  sim <on|off>                  pretend every position has an OLED\n"
      "  settle <us>                   mux settle time (default 2000)\n"
      "  i2c <hz> | i2cswitch <matrix|restart>\n"
      "  cal <p> <gain_p1> <gain_p2>   saved in flash"));
}

static void report(uint8_t p, const char* err, uint32_t us) {
  if (err) Serial.printf("ERR %s\n", err);
  else Serial.printf("OK position %u -> %s (outputs applied in %lu us)\n", p, capsules::modeName(capsules::view(p).cfg.mode),
                     (unsigned long)us);
}

static bool parseGate(const char* s, GateOp& op) {
  static const char* names[] = {"and", "or", "nand", "nor", "xor", "not"};
  for (uint8_t i = 0; i < 6; ++i)
    if (s && !strcasecmp(s, names[i])) {
      op = (GateOp)i;
      return true;
    }
  return false;
}

static void cmdSet(char* args) {
  const char* sp = strtok(args, " ");
  const char* sm = strtok(nullptr, " ");
  if (!sp || !sm) {
    Serial.println("ERR usage: set <p> <mode> ...");
    return;
  }
  const uint8_t p = atoi(sp);
  Config c;
  if (!strcasecmp(sm, "off")) {
    c.mode = Mode::Off;
  } else if (!strcasecmp(sm, "pulse")) {
    const char* f = strtok(nullptr, " ");
    const char* d = strtok(nullptr, " ");
    c.mode = Mode::Pulse;
    c.hz = f ? atof(f) : 1.0f;
    c.duty = d ? atoi(d) : 50;
  } else if (!strcasecmp(sm, "volt")) {
    c.mode = Mode::Volt;
  } else if (!strcasecmp(sm, "amm")) {
    c.mode = Mode::Amm;
  } else if (!strcasecmp(sm, "gate")) {
    c.mode = Mode::Gate;
    if (!parseGate(strtok(nullptr, " "), c.op)) {
      Serial.println("ERR gate must be and|or|nand|nor|xor|not");
      return;
    }
  } else if (!strcasecmp(sm, "mem")) {
    const char* k = strtok(nullptr, " ");
    c.mode = Mode::Mem;
    c.mem = (k && !strcasecmp(k, "sr")) ? MemKind::SR : MemKind::D;
  } else {
    Serial.println("ERR unknown mode");
    return;
  }
  const uint32_t t = micros();
  const char* err = capsules::configure(p, c);
  report(p, err, micros() - t);
}

static void demo(const char* which) {
  for (uint8_t p = 0; p < NUM_POS; ++p) capsules::configure(p, Config());
  Config c;
  if (which && !strcasecmp(which, "off")) {
    Serial.println("OK all positions off");
    return;
  }
  if (which && !strcasecmp(which, "volt")) {
    c.mode = Mode::Volt;
    for (uint8_t p : {0, 1, 3}) capsules::configure(p, c);
    Serial.println("OK voltmeters at 0, 1, 3");
  } else if (which && !strcasecmp(which, "gate")) {
    c.mode = Mode::Gate;
    c.op = GateOp::And;
    capsules::configure(0, c);
    c.op = GateOp::Xor;
    capsules::configure(3, c);
    c.mode = Mode::Mem;
    capsules::configure(5, c);
    Serial.println("OK AND at 0, XOR at 3, D memory at 5");
  } else {
    c.mode = Mode::Pulse;
    c.hz = 10;
    c.duty = 50;
    capsules::configure(0, c);
    c = Config();
    c.mode = Mode::Volt;
    capsules::configure(1, c);
    c.mode = Mode::Amm;
    capsules::configure(2, c);
    Serial.println("OK pulse 10 Hz at 0, voltmeter at 1, ammeter at 2");
  }
}

static void printStats() {
  Serial.println("--- stats (since boot or `stats reset`) ---");
  g_stats.shiftCommit.print(Serial, "595 commit");
  g_stats.pulseEdgeErr.print(Serial, "pulse edge delay");
  g_stats.senseRound.print(Serial, "sensing round");
  g_stats.posRead.print(Serial, "position read");
  g_stats.zeroRead.print(Serial, "auto-zero read");
  g_stats.busSwitch.print(Serial, "I2C bus switch");
  g_stats.probe.print(Serial, "capsule probe");
  g_stats.inaRead.print(Serial, "INA219 read");
  g_stats.oledRender.print(Serial, "OLED render (CPU)");
  g_stats.oledFull.print(Serial, "OLED full frame");
  g_stats.oledPartial.print(Serial, "OLED value-only frame");
  g_stats.configToFrame.print(Serial, "set -> first frame");
  if (g_stats.pulseEdgeErr.n)
    Serial.printf("  worst pulse edge delay = %.2f %% of a 10 Hz period (EFR32.2 allows 5 %%)\n",
                  g_stats.pulseEdgeErr.mx / 1000.0f);
  if (g_stats.senseRound.n)
    Serial.printf("  gate/memory input->P3 delay <= %.2f ms (one round)\n", g_stats.senseRound.mx / 1000.0f);
  Serial.printf("  free heap %lu B, loop stack free %lu B\n", (unsigned long)ESP.getFreeHeap(),
                (unsigned long)uxTaskGetStackHighWaterMark(nullptr));
}

static void runBench() {
  Serial.println("=== bench: 74HCT595 chain ===");
  outputs::bench(Serial);
  Serial.println("=== bench: mux + ADC ===");
  sensing::bench(Serial, capsules::settleUs());
  Serial.println("=== bench: I2C ===");
  i2cbus::bench(Serial);
  Serial.println("=== live timings ===");
  printStats();
}

static void handleLine(char* line) {
  char* cmd = strtok(line, " ");
  if (!cmd) return;
  char* rest = strtok(nullptr, "");
  char* a1 = nullptr;

  if (!strcasecmp(cmd, "help")) {
    printHelp();
  } else if (!strcasecmp(cmd, "set")) {
    cmdSet(rest ? rest : (char*)"");
  } else if (!strcasecmp(cmd, "demo")) {
    demo(rest ? strtok(rest, " ") : nullptr);
  } else if (!strcasecmp(cmd, "status")) {
    capsules::printStatus(Serial);
    Serial.printf("  i2c %lu Hz, switch=%s, sim=%s\n", (unsigned long)i2cbus::clock(),
                  i2cbus::switchMode() == i2cbus::SwitchMode::Matrix ? "matrix" : "restart", i2cbus::sim() ? "on" : "off");
  } else if (!strcasecmp(cmd, "rail")) {
    a1 = rest ? strtok(rest, " ") : nullptr;
    const bool on = !a1 || strcasecmp(a1, "off");
    const uint32_t t = micros();
    capsules::setRail(on);
    Serial.printf("OK rail %s, outputs updated in %lu us\n", on ? "on" : "off", (unsigned long)(micros() - t));
  } else if (!strcasecmp(cmd, "stream")) {
    streamOn = !(rest && !strcasecmp(strtok(rest, " "), "off"));
  } else if (!strcasecmp(cmd, "scan")) {
    i2cbus::scan(Serial);
  } else if (!strcasecmp(cmd, "stats")) {
    if (rest && !strcasecmp(strtok(rest, " "), "reset")) {
      g_stats = Stats();
      Serial.println("OK stats reset");
    } else {
      printStats();
    }
  } else if (!strcasecmp(cmd, "bench")) {
    runBench();
  } else if (!strcasecmp(cmd, "sim")) {
    i2cbus::setSim(!(rest && !strcasecmp(strtok(rest, " "), "off")));
    Serial.printf("OK sim %s\n", i2cbus::sim() ? "on" : "off");
  } else if (!strcasecmp(cmd, "settle")) {
    capsules::setSettleUs(rest ? atoi(rest) : MUX_SETTLE_US_DEFAULT);
    Serial.printf("OK settle %lu us\n", (unsigned long)capsules::settleUs());
  } else if (!strcasecmp(cmd, "i2c")) {
    i2cbus::setClock(rest ? atoi(rest) : I2C_HZ_DEFAULT);
    Serial.printf("OK i2c %lu Hz\n", (unsigned long)i2cbus::clock());
  } else if (!strcasecmp(cmd, "i2cswitch")) {
    const bool restart = rest && !strcasecmp(strtok(rest, " "), "restart");
    i2cbus::setSwitchMode(restart ? i2cbus::SwitchMode::Restart : i2cbus::SwitchMode::Matrix);
    Serial.printf("OK i2cswitch %s\n", restart ? "restart" : "matrix");
  } else if (!strcasecmp(cmd, "cal")) {
    const char* sp = rest ? strtok(rest, " ") : nullptr;
    const char* g1 = strtok(nullptr, " ");
    const char* g2 = strtok(nullptr, " ");
    if (!sp || !g1 || !g2 || atoi(sp) >= NUM_POS) {
      Serial.println("ERR usage: cal <p> <gain_p1> <gain_p2>");
      return;
    }
    capsules::setGains(atoi(sp), atof(g1), atof(g2));
    Serial.println("OK calibration saved");
  } else {
    Serial.println("ERR unknown command, type help");
  }
}

static void pollSerial() {
  static char buf[96];
  static uint8_t len = 0;
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      buf[len] = 0;
      len = 0;
      handleLine(buf);
    } else if (len < sizeof buf - 1) {
      buf[len++] = c;
    }
  }
}

void setup() {
  outputs::begin();  // first: every P3 high-Z, ammeter open
  Serial.begin(115200);
  delay(200);
  sensing::begin();
  capsules::begin();
  i2cbus::begin();
  watchdogBegin();
  Serial.printf("\nTedTronics smart components | ESP32 core %d.%d.%d | %lu MHz\n", ESP_ARDUINO_VERSION_MAJOR,
                ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH, (unsigned long)getCpuFrequencyMhz());
  printHelp();
}

void loop() {
  esp_task_wdt_reset();
  pollSerial();
  const bool sensed = capsules::senseRound();

  static uint32_t lastStream = 0;
  if (streamOn && millis() - lastStream >= VOLT_PUBLISH_MS) {
    lastStream = millis();
    capsules::printStream(Serial);
  }
  if (!sensed) vTaskDelay(1);
}
