from dataclasses import dataclass
from typing import Optional

from .utils import *
from .soundPlaying import *

@dataclass
class PlayerState:
    volume: int = 50                                # 0‒100  (%)
    tempo: int = 60                                 # BPM
    playing: bool = False                           # True if currently playing
    page: str = "home"                              # Page represents actual state 
    melody: Optional[str] = None                    # name / id of the melody
    note: Optional[str] = None                      # note within the melody 
    note_duration: Optional[str] = None             # note duration within the melody
    note_duration_display: Optional[str] = None     # duration to show on the display
    accessibility: bool = False                     # True if accessbility is turned on
    note_index: int = 0                             # Which note it is (note + duration)

state = PlayerState()

def get_duration_display_name(duration_code: Optional[str]) -> Optional[str]:
    if duration_code == "quarter":
        return "Semiminima"
    elif duration_code == "half":
        return "Minima"
    elif duration_code == "whole":
        return "Semibreve"
    elif duration_code == "": #
        return "-" 
    return None

def set_volume(value: int) -> None:
    volume = max(0, min(100, value)) # 0-100
    state.volume = volume # 0-100
    print(state.volume)

def set_tempo(bpm: int) -> None:
    tempo = max(60, min(120, bpm))
    state.tempo = tempo   # 60,90,120
    print(state.tempo)

def start_playback() -> None:
    state.playing = True
    print(state.playing)

def stop_playback() -> None:
    state.playing = False
    #TODO FAZER ZERAR TUDO
    # set_note_index(0)
    state.note = None
    state.note_duration_display = None
    # print(f"On stop_playback, is playing: {state.playing}")
    
def select_melody(name: str) -> None:
    stop_playback()
    state.melody = name
    if name == "Ovelha Preta":
        state.note, state.note_duration = OVELHA_PRETA[0]
    elif name == "Ode Alegria":
        state.note, state.note_duration = ODE_ALEGRIA[0]
    elif name == "Canon in D":
        state.note, state.note_duration = CANON_IN_D[0]
    else:
        state.note = None
        state.note_duration = None

    state.note_duration_display = get_duration_display_name(state.note_duration)

    print(f"On select_melody {state.melody}  {state.note}")

def set_page(name: str) -> None:
    state.page = name 
    print(f"On set_page {state}")

def set_note(note: str) -> None:
    state.note = note 
    print(f"On set_note {state}")

def set_duration(duration: str) -> None:
    state.duration = duration 
    print(f"On set_note {state}")

def set_note_index(idx: int) -> None:
    state.note_index = idx 
    # print(f"On set_note_index {state}")

def set_accessibility(flag: bool) -> None:        
    state.accessibility = bool(flag)
    print(f"[state] accessibility  {state.accessibility}")

def set_current_note_and_duration_for_display(note_name, duration_code):
    state.note = note_name
    state.note_duration = duration_code 
    state.note_duration_display = get_duration_display_name(duration_code)

async def play_current_melody_note() -> None:
    if state.note:
        if state.melody == "Ovelha Preta":
            note, duration = OVELHA_PRETA[state.note_index]
        elif state.melody == "Ode Alegria":
            note, duration = ODE_ALEGRIA[state.note_index]
        elif state.melody == "Canon in D":
            note, duration = CANON_IN_D[state.note_index]

        if duration == "quarter":
            await play_note_async(note, 1)
        elif duration == "half":
            await play_note_async(note, 2)
        elif duration == "whole":
            await play_note_async(note,4)
        print(f"Note {note}, Duration: {duration} on note_idx {state.note_index}")

def as_dict() -> dict:
    return {
        "volume"                : state.volume,
        "tempo"                 : state.tempo,
        "playing"               : state.playing,
        "page"                  : state.page,
        "melody"                : state.melody,
        "note"                  : state.note,
        "note_duration"         : state.note_duration,
        "note_duration_display" : state.note_duration_display,
        "accessibility"         : state.accessibility,
        "note_index"            : state.note_index
    }