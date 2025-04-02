class NoteParser:
    def __init__(self):

        self._g_clef_natural_notes = [
            "D6", "C6", "B5", "A5", "G5", "F5", "E5", "D5", "C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4", "B3", "A3", "G3"
        ]

        self._f_clef_natural_notes = [
            "F4", "E4", "D4", "C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3", "B2", "A2", "G2", "F2", "E2", "D2", "C2", "B1"
        ]

        self.color_map = {
            "blue":      ("b", 1),  # Flat Quarter
            "green":     ("", 1),   # Natural Quarter
            "wine":     ("#", 1),   # Sharp Semibreve
            "cyan":      ("b", 2),  # Flat Half
            "red":      ("", 2),   # Natural Half
            "yellow":    ("#", 2),  # Sharp Half
            "black":     ("b", 4),  # Flat Semibreve
            "orange":    ("", 4),   # Natural Semibreve
            "pink":       ("#", 4),  # Sharp Quarter
        }

    def parse_note(self, note_input: tuple[int, str], clef: str) -> tuple[str, int]:

        ### Arguments
        ## note_input:
        # index: int, posição vertical da nota (0-18)
        # color: str, cor da nota ("blue", "green", "red", "cyan", "pink", "yellow", "black", "orange", "lightpink")
        ## clef: str, clave da nota ("G" ou "F")

        ### Output
        # duration: int, 1 is for quarte note, 2 is for half note, 4 is for whole note
        # note: str, the note pitch with accidental if needed (e.g., "C3#", "D4b", "F4", "G2b")

        """
        Raises:
            ValueError: Se a posição vertical ou a cor forem inválidas/desconhecidas.
        """

        # Validate input

        index = note_input[0]
        color = note_input[1]

        if (index < 0 or index > 18):
            raise ValueError(
                f"Posição vertical {index} está fora do intervalo permitido (0-{len(self._g_clef_natural_notes)-1})."
            )

        if color not in self.color_map:
            raise ValueError(f"Cor {color} não é válida. Cores válidas: {self.color_map.keys()}")

        if clef not in ["G", "F"]:
            raise ValueError(f"Clave {clef} não é válida. Claves válidas: ['G', 'F']")
        
        # Parse note

        note = ""

        if clef == "G":
            base_note = self._g_clef_natural_notes[index]
        else:  # clef == "F"
            base_note = self._f_clef_natural_notes[index]

        accidental, duration = self.color_map[color]
        note = base_note + accidental

        return (note, duration)

