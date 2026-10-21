#set page(paper: "a4", flipped: true, margin: 10mm)
#set text(font: "DejaVu Sans", size: 9pt)
#set heading(numbering: none)
= Wiring group 1/31: V3V3\_EXT
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-01.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W001 / V3V3_EXT"), text("J_POWER.1\nC25, R3"), text("JP_EXT.1\nC25, R6")
)

])
#pagebreak()
= Wiring group 2/31: V3V3\_BOARD 1
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-02.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W002 / V3V3_BOARD"), text("JP_EXT.2\nC26, R6"), text("C_BULK.1\nC26, R10"),
text("W003 / V3V3_BOARD"), text("C_BULK.1\nC26, R10"), text("C_LOCAL.1\nC24, R22"),
text("W004 / V3V3_BOARD"), text("C_LOCAL.1\nC24, R22"), text("J_ESP_L.1\nC10, R5"),
text("W005 / V3V3_BOARD"), text("J_ESP_L.1\nC10, R5"), text("J_OLED0.1\nC2, R4"),
text("W006 / V3V3_BOARD"), text("J_OLED0.1\nC2, R4"), text("J_OLED1.1\nC2, R7"),
text("W007 / V3V3_BOARD"), text("J_OLED1.1\nC2, R7"), text("J_OLED2.1\nC2, R10"),
text("W008 / V3V3_BOARD"), text("J_OLED2.1\nC2, R10"), text("J_OLED3.1\nC2, R13"),
text("W009 / V3V3_BOARD"), text("J_OLED3.1\nC2, R13"), text("J_OLED4.1\nC2, R16"),
text("W010 / V3V3_BOARD"), text("J_OLED4.1\nC2, R16"), text("J_OLED5.1\nC2, R19"),
text("W011 / V3V3_BOARD"), text("C_LOCAL.1\nC24, R22"), text("J_JOY.1\nC24, R19")
)

])
#pagebreak()
= Wiring group 3/31: V3V3\_BOARD 2
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-03.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W012 / V3V3_BOARD"), text("J_JOY.1\nC24, R19"), text("J_EXP.8\nC28, R25")
)

])
#pagebreak()
= Wiring group 4/31: GND 1
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-04.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W013 / GND"), text("J_GND.1\nC2, R44"), text("J_GND.2\nC3, R44"),
text("W014 / GND"), text("J_GND.2\nC3, R44"), text("J_GND.3\nC4, R44"),
text("W015 / GND"), text("J_GND.3\nC4, R44"), text("J_GND.4\nC5, R44"),
text("W016 / GND"), text("J_GND.4\nC5, R44"), text("J_GND.5\nC6, R44"),
text("W017 / GND"), text("J_GND.5\nC6, R44"), text("J_GND.6\nC7, R44"),
text("W018 / GND"), text("J_GND.6\nC7, R44"), text("J_GND.7\nC8, R44"),
text("W019 / GND"), text("J_GND.7\nC8, R44"), text("J_GND.8\nC9, R44"),
text("W020 / GND"), text("J_POWER.2\nC26, R3"), text("J_GND.8\nC9, R44"),
text("W021 / GND"), text("J_GND.1\nC2, R44"), text("J_OLED5.2\nC3, R19"),
text("W022 / GND"), text("J_OLED5.2\nC3, R19"), text("J_OLED4.2\nC3, R16")
)

])
#pagebreak()
= Wiring group 5/31: GND 2
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-05.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W023 / GND"), text("J_OLED4.2\nC3, R16"), text("J_OLED3.2\nC3, R13"),
text("W024 / GND"), text("J_OLED3.2\nC3, R13"), text("J_OLED2.2\nC3, R10"),
text("W025 / GND"), text("J_OLED2.2\nC3, R10"), text("J_OLED1.2\nC3, R7"),
text("W026 / GND"), text("J_OLED1.2\nC3, R7"), text("J_OLED0.2\nC3, R4"),
text("W027 / GND"), text("J_GND.2\nC3, R44"), text("J_ESP_L.2\nC10, R6"),
text("W028 / GND"), text("J_ESP_L.2\nC10, R6"), text("J_ESP_R.2\nC20, R6"),
text("W029 / GND"), text("J_GND.3\nC4, R44"), text("R_P1_BOT.2\nC6, R37"),
text("W030 / GND"), text("R_P1_BOT.2\nC6, R37"), text("C_P1.2\nC7, R41"),
text("W031 / GND"), text("J_GND.4\nC5, R44"), text("R_P2_BOT.2\nC14, R37"),
text("W032 / GND"), text("R_P2_BOT.2\nC14, R37"), text("C_P2.2\nC15, R41")
)

])
#pagebreak()
= Wiring group 6/31: GND 3
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-06.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W033 / GND"), text("J_GND.5\nC6, R44"), text("J_SENSE.2\nC3, R28"),
text("W034 / GND"), text("J_GND.6\nC7, R44"), text("C_LOCAL.2\nC25, R22"),
text("W035 / GND"), text("C_LOCAL.2\nC25, R22"), text("C_BULK.2\nC27, R10"),
text("W036 / GND"), text("J_GND.7\nC8, R44"), text("J_UART.1\nC25, R14"),
text("W037 / GND"), text("J_UART.1\nC25, R14"), text("J_JOY.2\nC25, R19"),
text("W038 / GND"), text("J_JOY.2\nC25, R19"), text("J_EXP.7\nC27, R25")
)

])
#pagebreak()
= Wiring group 7/31: SCL
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-07.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W039 / SCL"), text("J_ESP_L.14\nC10, R18"), text("J_OLED0.3\nC4, R4"),
text("W040 / SCL"), text("J_OLED0.3\nC4, R4"), text("J_OLED1.3\nC4, R7"),
text("W041 / SCL"), text("J_OLED1.3\nC4, R7"), text("J_OLED2.3\nC4, R10"),
text("W042 / SCL"), text("J_OLED2.3\nC4, R10"), text("J_OLED3.3\nC4, R13"),
text("W043 / SCL"), text("J_OLED3.3\nC4, R13"), text("J_OLED4.3\nC4, R16"),
text("W044 / SCL"), text("J_OLED4.3\nC4, R16"), text("J_OLED5.3\nC4, R19")
)

])
#pagebreak()
= Wiring group 8/31: SDA\_0
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-08.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W045 / SDA_0"), text("J_ESP_L.5\nC10, R9"), text("J_OLED0.4\nC5, R4")
)

])
#pagebreak()
= Wiring group 9/31: SDA\_1
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-09.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W046 / SDA_1"), text("J_ESP_L.11\nC10, R15"), text("J_OLED1.4\nC5, R7")
)

])
#pagebreak()
= Wiring group 10/31: SDA\_2
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-10.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W047 / SDA_2"), text("J_ESP_L.10\nC10, R14"), text("J_OLED2.4\nC5, R10")
)

])
#pagebreak()
= Wiring group 11/31: SDA\_3
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-11.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W048 / SDA_3"), text("J_ESP_L.9\nC10, R13"), text("J_OLED3.4\nC5, R13")
)

])
#pagebreak()
= Wiring group 12/31: SDA\_4
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-12.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W049 / SDA_4"), text("J_ESP_L.7\nC10, R11"), text("J_OLED4.4\nC5, R16")
)

])
#pagebreak()
= Wiring group 13/31: SDA\_5
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-13.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W050 / SDA_5"), text("J_ESP_L.6\nC10, R10"), text("J_OLED5.4\nC5, R19")
)

])
#pagebreak()
= Wiring group 14/31: JOY\_X
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-14.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W051 / JOY_X"), text("J_ESP_R.14\nC20, R18"), text("J_JOY.3\nC26, R19")
)

])
#pagebreak()
= Wiring group 15/31: JOY\_Y
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-15.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W052 / JOY_Y"), text("J_ESP_R.13\nC20, R17"), text("J_JOY.4\nC27, R19")
)

])
#pagebreak()
= Wiring group 16/31: UART\_TX
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-16.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W053 / UART_TX"), text("J_ESP_R.9\nC20, R13"), text("J_UART.2\nC26, R14")
)

])
#pagebreak()
= Wiring group 17/31: UART\_RX
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-17.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W054 / UART_RX"), text("J_ESP_R.10\nC20, R14"), text("J_UART.3\nC27, R14")
)

])
#pagebreak()
= Wiring group 18/31: P1\_RAW
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-18.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W055 / P1_RAW"), text("J_SENSE.1\nC2, R28"), text("JP_SENSE1.1\nC3, R30")
)

])
#pagebreak()
= Wiring group 19/31: P1\_IN
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-19.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W056 / P1_IN"), text("JP_SENSE1.2\nC4, R30"), text("R_P1_TOP.1\nC3, R32")
)

])
#pagebreak()
= Wiring group 20/31: SENSE1\_DIV
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-20.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W057 / SENSE1_DIV"), text("R_P1_TOP.2\nC3, R35"), text("R_P1_BOT.1\nC3, R37"),
text("W058 / SENSE1_DIV"), text("R_P1_BOT.1\nC3, R37"), text("R_P1_SER.1\nC3, R39")
)

])
#pagebreak()
= Wiring group 21/31: SENSE1\_ADC
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-21.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W059 / SENSE1_ADC"), text("R_P1_SER.2\nC6, R39"), text("C_P1.1\nC6, R41"),
text("W060 / SENSE1_ADC"), text("C_P1.1\nC6, R41"), text("J_ESP_R.12\nC20, R16")
)

])
#pagebreak()
= Wiring group 22/31: P2\_RAW
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-22.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W061 / P2_RAW"), text("J_SENSE.3\nC4, R28"), text("JP_SENSE2.1\nC11, R30")
)

])
#pagebreak()
= Wiring group 23/31: P2\_IN
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-23.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W062 / P2_IN"), text("JP_SENSE2.2\nC12, R30"), text("R_P2_TOP.1\nC11, R32")
)

])
#pagebreak()
= Wiring group 24/31: SENSE2\_DIV
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-24.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W063 / SENSE2_DIV"), text("R_P2_TOP.2\nC11, R35"), text("R_P2_BOT.1\nC11, R37"),
text("W064 / SENSE2_DIV"), text("R_P2_BOT.1\nC11, R37"), text("R_P2_SER.1\nC11, R39")
)

])
#pagebreak()
= Wiring group 25/31: SENSE2\_ADC
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-25.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W065 / SENSE2_ADC"), text("R_P2_SER.2\nC14, R39"), text("C_P2.1\nC14, R41"),
text("W066 / SENSE2_ADC"), text("C_P2.1\nC14, R41"), text("J_ESP_R.11\nC20, R15")
)

])
#pagebreak()
= Wiring group 26/31: EXP\_GPIO13
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-26.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W067 / EXP_GPIO13"), text("J_ESP_R.3\nC20, R7"), text("J_EXP.1\nC21, R25")
)

])
#pagebreak()
= Wiring group 27/31: EXP\_GPIO14
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-27.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W068 / EXP_GPIO14"), text("J_ESP_R.5\nC20, R9"), text("J_EXP.2\nC22, R25")
)

])
#pagebreak()
= Wiring group 28/31: EXP\_GPIO23
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-28.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W069 / EXP_GPIO23"), text("J_ESP_L.15\nC10, R19"), text("J_EXP.3\nC23, R25")
)

])
#pagebreak()
= Wiring group 29/31: EXP\_GPIO25
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-29.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W070 / EXP_GPIO25"), text("J_ESP_R.8\nC20, R12"), text("J_EXP.4\nC24, R25")
)

])
#pagebreak()
= Wiring group 30/31: EXP\_GPIO26
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-30.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W071 / EXP_GPIO26"), text("J_ESP_R.7\nC20, R11"), text("J_EXP.5\nC25, R25")
)

])
#pagebreak()
= Wiring group 31/31: EXP\_GPIO27
Insulated underside wires only. TOP coordinates are retained in the mirrored view. Dashed guides identify endpoints, not qualified physical routes. Crossings are not joints. Keep the green reserve clear.

#grid(columns: (110mm,1fr), gutter: 8mm, image("assets/wiring-31.svg",width:110mm), [
#table(columns: (36%,32%,32%), inset: 3pt, align: left,
text("Wire / net"), text("From"), text("To"),
text("W072 / EXP_GPIO27"), text("J_ESP_R.6\nC20, R10"), text("J_EXP.6\nC26, R25")
)

])
