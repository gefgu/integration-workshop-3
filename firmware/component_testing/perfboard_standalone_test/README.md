# Perfboard — três OLEDs e joystick sem Monitor Serial

Teste independente para a placa soldada com ESP32 clássico de 30 pinos. Inicia automaticamente e não espera conexão USB/Serial nem comandos. Preserva o teste interativo `perfboard_stage1_test`.

## Conexões

Mapa atualizado: OLED0…5 → SDA GPIO4,16,18,17,19,21; todos compartilham SCL22. Conectores OLED: 3V3/GND/SCL/SDA, conferindo os nomes no módulo. Não adicionar pull-ups externos sem revisar os que os módulos já possuem.

Por padrão, detecta automaticamente até três telas nos seis conectores, em ordem
OLED0…OLED5. A segunda tela detectada mostra o joystick. Por exemplo, se as
conectadas forem OLED2/4/5, o joystick aparece na OLED4. Cada tela identifica sua
porta e GPIO. Conectar no máximo três módulos para este teste.

Se preferir fixar quais portas usar, editar:

```cpp
constexpr bool AUTO_FIND_SCREENS = false;
constexpr uint8_t DEFAULT_SLOTS[] = {0, 1, 2};
```

São números de portas, não GPIOs. Por exemplo, `{0, 3, 5}` usa SDA4/17/21.
O joystick aparece na segunda tela dessa lista (`JOYSTICK_SCREEN = 1`).
A descoberta ocorre na inicialização; se mudar os conectores, desligar antes de
mover cabos e reiniciar. Portas ausentes já selecionadas são verificadas novamente,
mas uma nova busca global exige reiniciar.

Joystick: alimentação 3,3 V, GND, VRx → GPIO36/VP, VRy → GPIO39/VN. SW não é usado. Somente centro e quatro direções, com diagonais reduzidas ao eixo dominante.

## Upload e operação

1. Com alimentação desligada, conectar as três telas e o joystick.
2. Abrir `perfboard_standalone_test.ino`, selecionar **ESP32 Dev Module** e a porta correta.
3. Instalar **Adafruit SSD1306** e **Adafruit GFX Library**, com suas dependências.
4. Para upload/teste por USB, manter a fonte externa desconectada e JP_EXT aberto; não conectar 5 V ao VIN junto com USB.
5. Fazer upload. Não é necessário abrir o Monitor Serial.
6. Deixar o joystick solto no centro durante a mensagem de calibração inicial (aproximadamente três segundos).

Depois da calibração:

- Primeira tela: identificação da porta, contador, tempo ligado, ACK das três portas e um bloco em movimento.
- Segunda tela detectada: valores ADC brutos X/Y (12 bits, 0…4095) e direção grande `CENTER`, `LEFT`, `RIGHT`, `UP` ou `DOWN`.
- Terceira tela: identificação, contador, centro calibrado e barra animada.

Todas mostram seu GPIO SDA e SCL22. O firmware percorre as três telas em cada ciclo de atualização (intervalo nominal de 100 ms), sequencialmente a 100 kHz; transferências I2C podem atrasar a amostragem e a atualização. Os módulos recebem alimentação 3,3 V contínua: o firmware alterna o barramento SDA e atualiza cada tela, não liga/desliga a alimentação individualmente. Não é uma qualificação de latência do firmware final. Detecta 0x3C/0x3D por porta e continua atualizando as demais se uma estiver ausente. Repete a procura nas ausentes aproximadamente a cada 2 s. Não conectar/desconectar módulos energizados.

Se os eixos estiverem invertidos, alterar `INVERT_X`/`INVERT_Y` e reenviar. Para recalibrar, soltar o joystick e pressionar EN/reset. `UNCAL` indica centro fora da faixa esperada: conferir a fiação e reiniciar. Entrada desconectada pode flutuar e parecer calibrada; confirmar movimentos físicos nas quatro direções.

SSD1306 de 128×64 porpadrão; este layout visual foi preparado para 64 pixels de altura. Não é driver SH1106. Não aciona GPIO27, roteamento, pulso, NFC ou UART.

Para funcionamento com a fonte externa3,3V: desligar/desconectar USB e só então restaurar JP_EXT e conectar a fonte conforme o guia da placa. O teste reinicia sozinho. Não usar USB e alimentação externa em paralelo.

## Verificação

Compilação concluída para `esp32:esp32:esp32` (ESP32 Dev Module), core ESP32 3.3.12, usando o Arduino CLI 1.5.1 incluído no Arduino IDE. Resultado: 306220 bytes de flash e 23988 bytes de RAM estática. Upload e ensaio físico ainda pendentes. Firmware não verifica soldas, polaridade ou tensão de alimentação.
