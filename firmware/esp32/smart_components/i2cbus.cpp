#include "i2cbus.h"

#include <U8g2lib.h>
#include <Wire.h>
#include <driver/gpio.h>
#include <esp_rom_gpio.h>
#include <esp_task_wdt.h>
#include <soc/gpio_sig_map.h>

#include "capsules.h"
#include "config.h"
#include "stats.h"

namespace i2cbus {
namespace {

// INA219 config: 16 V bus range, PGA /4 (+-160 mV = +-16 mA on 10 ohm),
// 12-bit bus, shunt 12-bit x8 averaging (4.26 ms), shunt + bus continuous.
constexpr uint16_t INA_CONFIG = (0 << 13) | (2 << 11) | (3 << 7) | (0xB << 3) | 7;
constexpr uint8_t INA_REG_CONFIG = 0x00, INA_REG_SHUNT = 0x01;

// Bytes on the wire for one U8g2 SSD1306 frame: per page 1 command transfer
// (addr + 0x00 + 3 cmds) and 6 data transfers of <=24 bytes (addr + 0x40 + data).
constexpr uint32_t FRAME_BYTES_PER_PAGE = 5 + 128 + 6 * 2;
constexpr uint32_t FRAME_XFERS_PER_PAGE = 7;
constexpr uint32_t XFER_OVERHEAD_US = 40;  // driver set-up per transaction (rough)

SemaphoreHandle_t mtx;
int8_t current = -1;
uint32_t hz = I2C_HZ_DEFAULT;
SwitchMode swMode = SwitchMode::Matrix;
volatile bool simMode = false;

U8G2* oled[NUM_POS];
bool oledReady[NUM_POS];  // frames are composed for this position
bool oledInit[NUM_POS];   // SSD1306 init sequence sent
bool forceFull[NUM_POS];
uint32_t shownVersion[NUM_POS];
uint32_t lastFrameMs[NUM_POS];
bool inaReady = false;

struct Screen {
  char title[24];
  char big[16];
  char foot[28];
};
Screen lastScreen[NUM_POS];

// ---------------------------------------------------------------- bus routing

void detachOthers(uint8_t p) {
  for (uint8_t q = 0; q < NUM_POS; ++q) {
    if (q == p) continue;
    // Plain GPIO input; the 10k pull-up keeps that line idle-high, so the
    // OLED there sees no traffic.
    esp_rom_gpio_connect_out_signal(PIN_SDA[q], SIG_GPIO_OUT_IDX, false, false);
    gpio_set_direction((gpio_num_t)PIN_SDA[q], GPIO_MODE_INPUT);
    gpio_set_pull_mode((gpio_num_t)PIN_SDA[q], GPIO_PULLUP_ONLY);
  }
}

void routeTo(uint8_t p) {
  detachOthers(p);
  const gpio_num_t pin = (gpio_num_t)PIN_SDA[p];
  gpio_set_level(pin, 1);
  gpio_set_direction(pin, GPIO_MODE_INPUT_OUTPUT_OD);
  // Wire.end() can drop the internal pull-up; a floating SDA reads as ACK.
  gpio_set_pull_mode(pin, GPIO_PULLUP_ONLY);
  esp_rom_gpio_connect_out_signal(pin, I2CEXT0_SDA_OUT_IDX, false, false);
  esp_rom_gpio_connect_in_signal(pin, I2CEXT0_SDA_IN_IDX, false);
}

void select(uint8_t p) {
  const uint32_t t = micros();
  if (swMode == SwitchMode::Matrix) {
    // Always re-assert: after an error the driver may restore its own pin.
    routeTo(p);
  } else if (current != (int8_t)p) {
    Wire.end();
    Wire.begin(PIN_SDA[p], PIN_SCL, hz);
    Wire.setTimeOut(20);
    detachOthers(p);
  }
  current = p;
  g_stats.busSwitch.add(micros() - t);
}

bool probeAddr(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

// ---------------------------------------------------------------- INA219

bool inaWrite(uint8_t reg, uint16_t v) {
  Wire.beginTransmission(INA219_ADDR);
  Wire.write(reg);
  Wire.write(v >> 8);
  Wire.write(v & 0xFF);
  return Wire.endTransmission() == 0;
}

bool inaRead(uint8_t reg, int16_t& v) {
  Wire.beginTransmission(INA219_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission() != 0) return false;
  if (Wire.requestFrom(INA219_ADDR, (uint8_t)2) != 2) return false;
  v = (int16_t)((Wire.read() << 8) | Wire.read());
  return true;
}

void readAmmeter() {
  select(AMMETER_POS);
  const uint32_t t = micros();
  if (!inaReady) inaReady = inaWrite(INA_REG_CONFIG, INA_CONFIG);
  int16_t raw = 0;
  const bool ok = inaReady && inaRead(INA_REG_SHUNT, raw);
  if (!ok) inaReady = false;
  g_stats.inaRead.add(micros() - t);
  // Shunt LSB = 10 uV -> 1 uA on 10 ohm.
  capsules::ammeterSample(raw * 0.01f / SHUNT_OHMS, ok);
}

// ---------------------------------------------------------------- OLED

void decimalComma(char* s) {
  for (; *s; ++s)
    if (*s == '.') *s = ',';
}

void compose(uint8_t p, const PosView& v, Screen& s) {
  static const char* gateTitle[] = {"Porta E", "Porta OU", "Porta NÃO-E", "Porta NÃO-OU", "Porta OU-EXC.",
                                    "Porta NÃO"};
  snprintf(s.foot, sizeof s.foot, "Posição %u", p);
  switch (v.cfg.mode) {
    case Mode::Off:
      snprintf(s.title, sizeof s.title, "TedTronics");
      snprintf(s.big, sizeof s.big, "Livre");
      break;
    case Mode::Pulse:
      snprintf(s.title, sizeof s.title, "Fonte de pulso");
      snprintf(s.big, sizeof s.big, "%.1f Hz", v.cfg.hz);
      snprintf(s.foot, sizeof s.foot, "Ciclo %u %%", v.cfg.duty);
      break;
    case Mode::Volt:
      snprintf(s.title, sizeof s.title, "Voltímetro");
      if (isnan(v.live.vdiff)) snprintf(s.big, sizeof s.big, "--.-- V");
      else snprintf(s.big, sizeof s.big, "%+.2f V", v.live.vdiff);
      snprintf(s.foot, sizeof s.foot, "V(P1) - V(P2)");
      break;
    case Mode::Amm:
      snprintf(s.title, sizeof s.title, "Amperímetro");
      if (v.live.fault) {
        snprintf(s.big, sizeof s.big, "ABERTO");
        snprintf(s.foot, sizeof s.foot, "Sobrecorrente!");
      } else if (isnan(v.live.ma)) {
        snprintf(s.big, sizeof s.big, "--.-- mA");
        snprintf(s.foot, sizeof s.foot, "Sem leitura");
      } else {
        snprintf(s.big, sizeof s.big, "%+.2f mA", v.live.ma);
        snprintf(s.foot, sizeof s.foot, "Em série P1-P2");
      }
      break;
    case Mode::Gate:
      snprintf(s.title, sizeof s.title, "%s", gateTitle[(uint8_t)v.cfg.op]);
      snprintf(s.big, sizeof s.big, "Saída %d", v.live.out);
      if (v.cfg.op == GateOp::Not) snprintf(s.foot, sizeof s.foot, "P1=%d", v.live.in1);
      else snprintf(s.foot, sizeof s.foot, "P1=%d  P2=%d", v.live.in1, v.live.in2);
      break;
    case Mode::Mem:
      snprintf(s.title, sizeof s.title, v.cfg.mem == MemKind::D ? "Memória D" : "Memória SR");
      snprintf(s.big, sizeof s.big, "Q = %d", v.live.out);
      if (v.cfg.mem == MemKind::D) snprintf(s.foot, sizeof s.foot, "D=%d  CLK=%d", v.live.in1, v.live.in2);
      else snprintf(s.foot, sizeof s.foot, "S=%d  R=%d", v.live.in1, v.live.in2);
      break;
  }
  if (!v.rail) snprintf(s.foot, sizeof s.foot, "Trilho desligado");
  decimalComma(s.big);
}

void draw(U8G2& u, const Screen& s) {
  u.clearBuffer();
  u.setFont(u8g2_font_helvB10_tf);
  u.drawUTF8(0, 12, s.title);
  u.drawHLine(0, 15, 128);
  u.setFont(u8g2_font_helvB18_tf);
  u.drawUTF8(0, 42, s.big);  // stays inside pages 2..5 (y 16..47)
  u.setFont(u8g2_font_6x12_tf);
  u.drawUTF8(0, 62, s.foot);
}

void refreshDisplays() {
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    if (!oledReady[p]) continue;
    const PosView v = capsules::view(p);
    if (v.version == shownVersion[p] && !forceFull[p]) continue;
    if (millis() - lastFrameMs[p] < OLED_MIN_INTERVAL_MS) continue;

    Screen s;
    compose(p, v, s);
    shownVersion[p] = v.version;
    const Screen& old = lastScreen[p];
    const bool sameTitleFoot = !strcmp(s.title, old.title) && !strcmp(s.foot, old.foot);
    const bool unchanged = sameTitleFoot && !strcmp(s.big, old.big);

    if (!unchanged || forceFull[p]) {
      uint32_t t = micros();
      draw(*oled[p], s);
      g_stats.oledRender.add(micros() - t);
      // `sim` without a real OLED: render only. A NACKed transfer can make the
      // driver restore its own SDA pin and spill the rest of the frame there.
      if (v.found) {
        select(p);
        t = micros();
        if (sameTitleFoot && !forceFull[p]) {
          oled[p]->updateDisplayArea(0, 2, 16, 4);  // only the value (pages 2..5)
          g_stats.oledPartial.add(micros() - t);
        } else {
          oled[p]->sendBuffer();
          g_stats.oledFull.add(micros() - t);
        }
      }
      lastScreen[p] = s;
      forceFull[p] = false;
      lastFrameMs[p] = millis();
    }

    const int32_t us = capsules::frameShown(p, v.version);
    if (us >= 0) {
      g_stats.configToFrame.add(us);
      Serial.printf("[cfg] position %u: command -> first OLED frame in %.1f ms (EFR31: <= 1000 ms)\n", p,
                    us / 1000.0f);
    }
  }
}

void initOled(uint8_t p) {
  select(p);
  oled[p]->begin();  // init sequence + clears the panel (one full frame)
  oledInit[p] = true;
  oledReady[p] = true;
  forceFull[p] = true;
  lastScreen[p] = Screen{};
}

void probeAll() {
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    const uint32_t t = micros();
    select(p);
    const bool found = probeAddr(OLED_ADDR);
    g_stats.probe.add(micros() - t);
    capsules::setFound(p, found);
    if (found && !oledInit[p]) initOled(p);  // also after a re-plug
    if (!found) oledInit[p] = false;
    // sim: render path enabled without hardware (nothing sent, see refreshDisplays)
    const bool present = found || simMode;
    if (present && !oledReady[p]) {
      oledReady[p] = true;
      forceFull[p] = true;
      lastScreen[p] = Screen{};
    }
    if (!present) oledReady[p] = false;
  }
}

void task(void*) {
  esp_task_wdt_add(nullptr);
  uint32_t lastProbe = 0, lastAmm = 0;
  for (;;) {
    esp_task_wdt_reset();
    xSemaphoreTake(mtx, portMAX_DELAY);
    const uint32_t now = millis();
    if (now - lastProbe >= PROBE_PERIOD_MS) {
      probeAll();
      lastProbe = now;
    }
    if (capsules::view(AMMETER_POS).cfg.mode == Mode::Amm && now - lastAmm >= AMM_PERIOD_MS) {
      readAmmeter();
      lastAmm = now;
    }
    refreshDisplays();
    xSemaphoreGive(mtx);
    vTaskDelay(pdMS_TO_TICKS(5));
  }
}

float frameEstimateUs(uint8_t pages) {
  const float bits = pages * (FRAME_BYTES_PER_PAGE * 9.0f + FRAME_XFERS_PER_PAGE * 2.0f);
  return bits * 1e6f / hz + pages * FRAME_XFERS_PER_PAGE * XFER_OVERHEAD_US;
}

}  // namespace

void begin() {
  mtx = xSemaphoreCreateMutex();
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    pinMode(PIN_SDA[p], INPUT_PULLUP);  // GPIO function + pull-up; the boards add 10k
    oled[p] = new U8G2_SSD1306_128X64_NONAME_F_HW_I2C(U8G2_R0);
    oled[p]->setBusClock(hz);
  }
  Wire.begin(PIN_SDA[0], PIN_SCL, hz);
  Wire.setTimeOut(20);
  current = 0;
  routeTo(0);
  xTaskCreatePinnedToCore(task, "i2c", 6144, nullptr, 2, nullptr, 0);
}

void setSim(bool on) { simMode = on; }
bool sim() { return simMode; }

void setClock(uint32_t newHz) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  hz = newHz;
  Wire.setClock(hz);
  for (uint8_t p = 0; p < NUM_POS; ++p) oled[p]->setBusClock(hz);
  xSemaphoreGive(mtx);
}
uint32_t clock() { return hz; }

void setSwitchMode(SwitchMode m) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  swMode = m;
  current = -1;  // force a real switch next time
  xSemaphoreGive(mtx);
}
SwitchMode switchMode() { return swMode; }

void scan(Print& out) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    select(p);
    out.printf("  position %u (SDA IO%u): OLED 0x3C %s", p, PIN_SDA[p], probeAddr(OLED_ADDR) ? "FOUND" : "-");
    if (p == AMMETER_POS) out.printf(", INA219 0x40 %s", probeAddr(INA219_ADDR) ? "FOUND" : "-");
    out.println();
  }
  xSemaphoreGive(mtx);
}

void bench(Print& out) {
  xSemaphoreTake(mtx, portMAX_DELAY);
  const SwitchMode saved = swMode;
  constexpr int N = 100;

  for (SwitchMode m : {SwitchMode::Matrix, SwitchMode::Restart}) {
    swMode = m;
    current = -1;
    const uint32_t t = micros();
    for (int i = 0; i < N; ++i) select(1 + (i & 1));
    out.printf("  bus switch, %-16s %8.1f us\n", m == SwitchMode::Matrix ? "GPIO matrix" : "Wire.end/begin",
               (float)(micros() - t) / N);
  }
  swMode = saved;
  current = -1;
  select(0);

  uint32_t t = micros();
  for (int i = 0; i < N; ++i) probeAddr(OLED_ADDR);
  const float probeUs = (float)(micros() - t) / N;
  out.printf("  address probe (pos 0)        %8.1f us (%s)\n", probeUs,
             probeAddr(OLED_ADDR) ? "device present" : "no device, NACK");

  select(AMMETER_POS);
  int16_t raw;
  t = micros();
  const bool inaOk = inaRead(INA_REG_SHUNT, raw);
  const uint32_t inaUs = micros() - t;
  out.printf("  INA219 shunt read            %8lu us (%s)\n", (unsigned long)inaUs,
             inaOk ? "device present" : "no device, NACK");

  // OLED: render on the CPU, then one full and one partial transfer, on the
  // first position with a real OLED (position 0 if there is none).
  uint8_t op = 0;
  for (uint8_t p = 0; p < NUM_POS; ++p) {
    select(p);
    if (probeAddr(OLED_ADDR)) {
      op = p;
      break;
    }
  }
  select(op);
  const bool oledPresent = probeAddr(OLED_ADDR);
  if (oledPresent && !oledInit[op]) initOled(op);
  Screen s;
  compose(op, capsules::view(op), s);
  t = micros();
  for (int i = 0; i < 20; ++i) draw(*oled[op], s);
  out.printf("  OLED render into RAM         %8.1f us\n", (float)(micros() - t) / 20);
  t = micros();
  oled[op]->sendBuffer();
  const uint32_t fullUs = micros() - t;
  select(op);  // re-route in case a NACK made the driver restore its pin
  t = micros();
  oled[op]->updateDisplayArea(0, 2, 16, 4);
  const uint32_t partUs = micros() - t;
  forceFull[op] = true;
  out.printf("  OLED full frame (8 pages)    %8lu us (%s, position %u)\n", (unsigned long)fullUs,
             oledPresent ? "measured with OLED" : "NO OLED: aborted transfers, not realistic", op);
  out.printf("  OLED value only (4 pages)    %8lu us\n", (unsigned long)partUs);
  xSemaphoreGive(mtx);

  const float estFull = frameEstimateUs(8), estPart = frameEstimateUs(4);
  const float estIna = (5 * 9 + 4) * 1e6f / hz + 2 * XFER_OVERHEAD_US;
  out.printf("  Estimated with real devices at %lu Hz:\n", (unsigned long)hz);
  out.printf("    OLED full frame  ~%6.1f ms   value only ~%5.1f ms\n", estFull / 1000, estPart / 1000);
  out.printf("    INA219 read      ~%6.2f ms\n", estIna / 1000);
  const float busy = 3 * (1000.0f / OLED_MIN_INTERVAL_MS) * estPart + (1000.0f / AMM_PERIOD_MS) * estIna;
  out.printf("    3 OLEDs at %lu fps (value only) + INA219 at %lu Hz: bus busy ~%.0f %%\n",
             (unsigned long)(1000 / OLED_MIN_INTERVAL_MS), (unsigned long)(1000 / AMM_PERIOD_MS), busy / 1e4f);
}

}  // namespace i2cbus
