import asyncio
import time
import sounddevice as sd
from core import detectionThread
from core import session, hardware, soundPlaying
from core.utils import *
from core.detectionThread import NoteDetection
from core.globals import note_detect_obj


beats = 0
lastColumnIndex = None  
detect_task = None

async def run_mode():
    global beats, lastColumnIndex
    start_time = time.time()

    print("[CreationMode] Entered Creation Mode")
    try:
        notes_and_durations = note_detect_obj.get_notes_detected()

        print (notes_and_durations)

        while session.state.page == "creation":

            notes_and_durations = note_detect_obj.get_notes_detected()
            print (notes_and_durations)

            if session.state.playing:

                elapsed = time.time() - start_time
                print(f"[Beat {beats}] Elapsed Time: {elapsed:.3f}s")#for debuggin tempo
                
                columnIndex = beats % 16  # 0 to 15

                if lastColumnIndex is not None:
                    hardware.turnOffLed(lastColumnIndex)
                
                if columnIndex == 0 and beats != 0:
                    await asyncio.sleep(1.5)  #little delay to start again

                #if session.state.accessibility:
                #    creationCommandEsp(columnIndex)
                hardware.turnOnLed(columnIndex)  
                lastColumnIndex = columnIndex
                #print(notes_and_durations[columnIndex])
                note, duration = notes_and_durations[columnIndex]
                _, duration1 = notes_and_durations[columnIndex - 1]
                _, duration2 = notes_and_durations[columnIndex - 2]
                _, duration3 = notes_and_durations[columnIndex - 3]

                if note is not "None":
                    durationInt = get_duration_value(duration)

                if note == "R" or note == "None":
                    if (duration1 == "half" or duration1 == "whole" or
                       duration2 == "whole" or duration3 == "whole"):
                        beats += 1
                        await asyncio.sleep((60 / session.state.tempo)) 
                        continue    
                    else:
                        sd.stop()
                else:
                    await soundPlaying.play_note_async(note, (60 / session.state.tempo) * durationInt)

                beats += 1

            await asyncio.sleep((60 / session.state.tempo)) 

    except asyncio.CancelledError: # when ModeManager does .cancel()
        if lastColumnIndex is not None:
            hardware.turnOffAllLeds()
            lastColumnIndex = None
        print("[CreationMode] Exited Creation Mode")

def get_empty_board():
    return [("None", "") for _ in range(16)]

def get_duration_value(duration_string):
    if(duration_string == "quarter"):
        return 1
    elif(duration_string == "half"):
        return 2
    elif(duration_string == "whole"):
        return 4
    else:
        return 0

def creationCommandEsp(columnIndex):
    if (columnIndex % 4) == 0:
        if columnIndex == 0:
            print("Send vibration and servo 0")
        elif columnIndex == 4:
            print("Send vibration and servo 1")
        elif columnIndex == 8:
            print("Send vibration and servo 2")
        elif columnIndex == 12:
            print("Send vibration and servo 3")
    else:
        print("Send only vibration")