import RPi.GPIO as gpio
import time
import asyncio
from core import session
from api import manager

# Pinos de saida dos DEMUX
GREEN_OUTPUT_PIN = 0
RED_OUTPUT_PIN = 5

# Pinos de endereçamento (4 bits: A0, A1, A2, A3)
GREEN_ADDRESS_PINS = [22, 10, 9, 11]
RED_ADDRESS_PINS = [6, 13, 19, 26]

# Mapeamento de LED para pino do DEMUX
RED_MAP =   [ 0, 8, 4,12,  1, 9, 5, 13,  2, 10,  6, 14,  3, 11,  7, 15]
GREEN_MAP = [13, 5, 9, 1, 12, 4, 8,  0, 15,  7, 11,  3, 14,  6, 10,  2]

BUTTON_GPIO_PINS = [21, 20, 16, 12, 1, 7, 8]
SYSTEM_ON = True 

main_event_loop = None
api_manager = None

def set_main_loop_and_manager(loop, manager_instance):
    """
    Called by main.py to provide the asyncio loop and API manager.
    """
    global main_event_loop, api_manager
    main_event_loop = loop
    api_manager = manager_instance
    print("[Hardware] Main event loop and API manager have been set.")

# Função para selecionar um canal (0 a 15)
def set_address(channel):
    if channel < 0 or channel > 15:
        print("Canal inválido! Use 0-15.")
        return
    
    # Converter o número do canal para binário (4 bits)
    red_bits = [int(bit) for bit in format(RED_MAP[channel], '04b')]
    green_bits = [int(bit) for bit in format(GREEN_MAP[channel], '04b')]

    # Aplicar os bits aos pinos de endereço
    for i, pin in enumerate(RED_ADDRESS_PINS):
        gpio.output(pin, red_bits[i])

    for i, pin in enumerate(GREEN_ADDRESS_PINS):
        gpio.output(pin, green_bits[i])

def turnOnLed(indexLed, color="GREEN"):
    print(f"Turning on led: {indexLed}. Color: {color}")
    set_address(indexLed)
    if color.upper() == "GREEN":
        gpio.output(GREEN_OUTPUT_PIN, gpio.LOW)
        gpio.output(RED_OUTPUT_PIN, gpio.HIGH)
    elif color.upper() == "RED":
        gpio.output(RED_OUTPUT_PIN, gpio.LOW)
        gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH)
    elif color.upper() == "YELLOW":
        gpio.output(RED_OUTPUT_PIN, gpio.HIGH)
        gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH)
    else: # Off for unknown colors or "None"
        gpio.output(RED_OUTPUT_PIN, gpio.HIGH)
        gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH)


def turnOffLed(indexLed):
    print(f"Turning off led: {indexLed}")
    # Setting both to HIGH effectively disables the output of the demux
    gpio.output(RED_OUTPUT_PIN, gpio.HIGH)
    gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH)

def turnOffAllLeds():
    print(f"Turning off all leds")
    gpio.output(RED_OUTPUT_PIN, gpio.HIGH)
    gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH)

def emergency_off_actions():
    #TODO testar
    global SYSTEM_ON
    SYSTEM_ON = False
    print("System OFF ")
    turnOffAllLeds()
    #os.func("sudo reboot")

def system_on_actions():
    global SYSTEM_ON
    SYSTEM_ON = True
    #Set to default
    reset_melody()
    print("System ON")

def reset_melody():
    session.set_page("home") 
    session.set_volume(50) 
    session.set_tempo(60)  
    session.set_accessibility(False)
    session.set_note(None)
    session.set_note_index(0)
    session.select_melody(None)

def button_callback(pin):
    global SYSTEM_ON, main_event_loop, api_manager
    try:
        button_index = BUTTON_GPIO_PINS.index(pin)
    except ValueError:
        print(f"Unknown pin {pin} pressed.")
        return

    if button_index == 6: # Turn On/Off button
        
        emergency_off_actions()

        if api_manager and main_event_loop and main_event_loop.is_running():
            asyncio.run_coroutine_threadsafe(api_manager.broadcast_state(), main_event_loop)
            print("[Hardware] System ON/OFF state broadcast scheduled.")
        
        return

    if not SYSTEM_ON:
        print("System is OFF. Press Button 7 to turn ON.")
        return

    action_taken = False
    if button_index == 0: # Play
        session.start_playback()
        print("Playback started via hardware button.")
        action_taken = True
    elif button_index == 1: # Stop
        session.stop_playback()
        print("Playback stopped via hardware button.")
        action_taken = True
    elif button_index == 2: # Volume +
        current_volume = session.state.volume
        session.set_volume(min(100, current_volume + 5))
        print(f"Volume increased to {session.state.volume}% via hardware button.")
        action_taken = True
    elif button_index == 3: # Volume -
        current_volume = session.state.volume
        session.set_volume(max(0, current_volume - 5))
        print(f"Volume decreased to {session.state.volume}% via hardware button.")
        action_taken = True
    elif button_index == 4: # Tempo +
        current_tempo = session.state.tempo
        session.set_tempo(min(120, current_tempo + 30))
        print(f"Tempo increased to {session.state.tempo} BPM via hardware button.")
        action_taken = True
    elif button_index == 5: # Tempo -
        current_tempo = session.state.tempo
        session.set_tempo(max(60, current_tempo - 30))
        print(f"Tempo decreased to {session.state.tempo} BPM via hardware button.")
        action_taken = True

    if action_taken:
        if api_manager and main_event_loop and main_event_loop.is_running():
            future = asyncio.run_coroutine_threadsafe(api_manager.broadcast_state(), main_event_loop)
            try:
                future.result(timeout=1) # Wait for 1 second
                print("[Hardware] Broadcast state successfully scheduled and completed from button callback.")
            except asyncio.TimeoutError:
                print("[Hardware] Warning: Broadcast state scheduling timed out.")
            except Exception as e:
                print(f"[Hardware] Error during broadcast_state: {e}")
        elif not (api_manager and main_event_loop):
            print("[Hardware] Error: API manager or event loop not set. Cannot broadcast.")
        elif not main_event_loop.is_running():
            print("[Hardware] Error: Event loop not running. Cannot broadcast.")


def setup():
    gpio.setmode(gpio.BCM)
    gpio.setwarnings(False)

    # Configurar pinos de LED
    gpio.setup(RED_OUTPUT_PIN, gpio.OUT)
    gpio.setup(GREEN_OUTPUT_PIN, gpio.OUT)
    gpio.output(RED_OUTPUT_PIN, gpio.HIGH) # Desligado
    gpio.output(GREEN_OUTPUT_PIN, gpio.HIGH) # Desligado

    for pin in RED_ADDRESS_PINS + GREEN_ADDRESS_PINS:
        gpio.setup(pin, gpio.OUT)
        gpio.output(pin, gpio.LOW)

    # Configurar pinos de botão
    for pin in BUTTON_GPIO_PINS:
        gpio.setup(pin, gpio.IN, pull_up_down=gpio.PUD_UP)
        gpio.add_event_detect(pin, gpio.FALLING, callback=button_callback, bouncetime=300)

try:
    setup()
    print("Hardware buttons initialized.")
except RuntimeError:
    print("Could not setup GPIO. RPi.GPIO error.")
except Exception as e:
    print(f"An error occurred during hardware setup: {e}")

def cleanup_gpio():
    print("Cleaning up GPIO...")
    gpio.cleanup()

# QUANDO IMPORTAR ISSO N VAI EXECUTAR
if __name__ == '__main__':
    # Teste para os LEDs
    print("Teste de LEDs. Pressione Ctrl+C para sair.")
    try:
        while True:
            for i in range(16):
                turnOnLed(i, "RED")
                time.sleep(0.1)
                turnOnLed(i, "GREEN")
                time.sleep(0.1)
                turnOnLed(i, "YELLOW")
                time.sleep(0.1)
                turnOffLed(i)
                time.sleep(0.1)
    except KeyboardInterrupt:
        print("Exiting test mode.")
    finally:
        cleanup_gpio()

#TODO communication with esp32
