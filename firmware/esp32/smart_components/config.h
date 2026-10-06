#pragma once
#include <Arduino.h>

// =====================================================================
//  TedTronics smart components - base-side firmware (ESP32 DevKitC 38-pin)
//  Hardware: SCH_TedTronics_2026-10-04(6) + the review fixes:
//    #5  J1-15 (IO13) is SR_OE_N, 10k pull-up to 3V3
//    #7  INA219 SDA on SDA_2
//    #8  J2-13 (IO4) is SDA_0
// =====================================================================

// ---------- Positions ----------
constexpr uint8_t NUM_POS = 6;      // POS0..POS2 = bank A row 1, POS3..POS5 = bank B row 12
constexpr uint8_t MAX_ACTIVE = 3;   // at most 3 capsules working at the same time
constexpr uint8_t AMMETER_POS = 2;  // INA219 + AQW212 + shunt only on POS2

// ---------- Pins ----------
constexpr uint8_t PIN_ADC_P1 = 34;  // J1-5, ADC1_CH6, divider after U6 (P1 mux)
constexpr uint8_t PIN_ADC_P2 = 35;  // J1-6, ADC1_CH7, divider after U7 (P2 mux)

// 74HCT4051 address pins, named by the *chip* pin they reach.
// The schematic labels are swapped: net MUX_S0 (IO32) goes to pin 9 = S2,
// net MUX_S2 (IO14) goes to pin 11 = S0. If you swap the labels in the
// schematic, swap PIN_MUX_A0 and PIN_MUX_A2 here.
constexpr uint8_t PIN_MUX_A0 = 14;  // J1-12 -> 4051 pin 11 (S0)
constexpr uint8_t PIN_MUX_A1 = 33;  // J1-8  -> 4051 pin 10 (S1)
constexpr uint8_t PIN_MUX_A2 = 32;  // J1-7  -> 4051 pin 9  (S2)

constexpr uint8_t PIN_SR_SRCLK = 25;  // J1-9,  595 SHCP (both chips)
constexpr uint8_t PIN_SR_RCLK = 26;   // J1-10, 595 STCP (both chips)
constexpr uint8_t PIN_SR_SER = 27;    // J1-11, U4 DS (U5 DS comes from U4 Q7S)
constexpr uint8_t PIN_SR_OE_N = 13;   // J1-15, 595 OE# (both chips), pull-up to 3V3

constexpr uint8_t PIN_SCL = 22;                                   // shared SCL
constexpr uint8_t PIN_SDA[NUM_POS] = {4, 21, 19, 18, 17, 16};     // SDA_0..SDA_5

// 4051 channel (Y) that reaches each position. Y6 = GND (auto-zero), Y7 = NC.
constexpr uint8_t MUX_CH[NUM_POS] = {5, 0, 1, 2, 3, 4};
constexpr uint8_t MUX_CH_GND = 6;

// ---------- I2C devices ----------
constexpr uint8_t OLED_ADDR = 0x3C;    // SSD1306 0.96" 128x64 (budget: 5-pack)
constexpr uint8_t INA219_ADDR = 0x40;  // A0 = A1 = GND
constexpr uint32_t I2C_HZ_DEFAULT = 400000;

// ---------- Measurement network ----------
// Pn -> 10k -> 4051 -> 1M -> node; node -> 680k -> GND; node -> 4.7M -> 3V3; 1n to GND.
// node = Z + K * Vin. Z is re-measured on the GND channel (Y6); K is nominal
// and corrected per position with `cal`.
constexpr float DIV_K = 0.3705f;    // V/V (1.01M series incl. the 10k input resistor)
constexpr float DIV_Z_MV = 261.7f;  // node voltage with Vin = 0
// Node time constant ~ 373k * 1n = 0.37 ms. 2 ms = 5.4 tau (~0.5% of a step).
constexpr uint32_t MUX_SETTLE_US_DEFAULT = 2000;
constexpr uint8_t SAMPLES_VOLT = 16;   // per ADC per visit, voltmeter
constexpr uint8_t SAMPLES_LOGIC = 4;   // per ADC per visit, gate / memory
constexpr uint8_t SAMPLES_ZERO = 32;   // GND channel
constexpr uint32_t ZERO_PERIOD_MS = 250;

// ---------- Behaviour ----------
constexpr uint32_t VOLT_PUBLISH_MS = 100;  // SFR10: 10 readings per second
constexpr float PULSE_HZ_MIN = 0.5f, PULSE_HZ_MAX = 10.0f;  // EFR32.2
constexpr uint8_t PULSE_DUTY_MIN = 25, PULSE_DUTY_MAX = 75;
constexpr float LOGIC_HIGH_V = 2.0f;  // input hysteresis for gate / memory
constexpr float LOGIC_LOW_V = 1.0f;
constexpr float SHUNT_OHMS = 10.0f;
constexpr float AMM_TRIP_MA = 15.0f;   // above this the PhotoMOS is opened (EFR32.4 range is +-10 mA)
constexpr uint32_t AMM_PERIOD_MS = 100;

// ---------- I2C task ----------
constexpr uint32_t OLED_MIN_INTERVAL_MS = 200;  // max 5 frames/s per display
constexpr uint32_t PROBE_PERIOD_MS = 500;       // capsule detection (OLED at 0x3C)

constexpr uint32_t WDT_TIMEOUT_MS = 3000;
