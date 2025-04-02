import asyncio
from core import session, utils, hardware, soundPlaying
from core.globals import note_detect_obj

async def run_mode():
    current_board_column_index = 0
    previous_playing_state = False
    session.set_note_index(0)
    note_idx = 0

    # Melody data mapping
    melodies = {
        "Ovelha Preta": utils.OVELHA_PRETA,
        "Ode Alegria": utils.ODE_ALEGRIA,
        "Canon in D": utils.CANON_IN_D
    }

    print("[IdentifyMode] Entered Identify Note Mode")
    try:
        while session.state.page == "identify":
            if(session.state.playing and session.state.melody is not None):
                
                note_idx = session.state.note_index
                current_melody_data = melodies.get(session.state.melody)

                expected_note_name, expected_duration = current_melody_data[note_idx]
                session.set_current_note_and_duration_for_display(expected_note_name, expected_duration)
                if not previous_playing_state: 
                    if note_idx == 0: 
                        current_board_column_index = 0

                previous_playing_state = True

                detected_notes_on_board = note_detect_obj.get_notes_detected()
                detected_note_name, detected_duration = detected_notes_on_board[current_board_column_index]

                if detected_note_name == "None" or detected_note_name is None:
                    hardware.turnOnLed(current_board_column_index, color="YELLOW")
                    
                # Correct Note and Duration
                elif detected_note_name == expected_note_name and detected_duration == expected_duration:
                    # Feedback to user
                    hardware.turnOnLed(current_board_column_index, color="GREEN")
                    if session.state.accessibility:
                        print("Command esp to vibrate ONCE")
                        #TODO
                    print("fora do 16")
                    # Goes to next column
                    expected_duration_value = get_duration_value(expected_duration)
                    current_board_column_index += expected_duration_value
                    if current_board_column_index >= 16:
                        #TODO play async the melody
                        print(">=16")
                        await asyncio.sleep((60 / session.state.tempo)) 
                        for note, duration_string in current_melody_data:
                            durationInt = get_duration_value(duration_string)
                            await soundPlaying.play_note_async(note, (60 / session.state.tempo) * durationInt)
                            await asyncio.sleep((60 / session.state.tempo)) 

                        reset_game()
                        await asyncio.sleep(8)          # Time to play the melody
                        continue
                    else:
                        session.set_note_index(note_idx + expected_duration_value)
                        expected_note_name, expected_duration = current_melody_data[note_idx + expected_duration_value]
                        session.set_current_note_and_duration_for_display(expected_note_name, expected_duration)
                    await hardware.api_manager.broadcast_state()
                    await asyncio.sleep(1)

                    continue

                # Wrong Note and Duration
                else: 
                    # Feedback to user
                    hardware.turnOnLed(current_board_column_index, color="RED")
                    if session.state.accessibility:
                        print("Command esp to vibrate TWICE")
                        #TODO
                
                await asyncio.sleep(3) 

            else: 
                current_board_column_index = 0
                previous_playing_state = False
                reset_game()
                await hardware.api_manager.broadcast_state()
                await asyncio.sleep(1)


    except asyncio.CancelledError:
        hardware.turnOffAllLeds()
        print("[IdentifyMode] Exited Identify Note Mode")
        raise

def get_duration_value(duration_string: str):
    if duration_string == "quarter":
        return 1
    elif duration_string == "half":
        return 2
    elif duration_string == "whole":
        return 4
    return 0

def reset_game():
    print("reset")
    hardware.turnOffAllLeds()
    session.stop_playback()
    session.set_note_index(0)
    if session.state.melody:
        session.select_melody(session.state.melody)
    else: 
        session.set_current_note_and_duration_for_display(None, None)
        print("entered here")

    hardware.api_manager.broadcast_state()