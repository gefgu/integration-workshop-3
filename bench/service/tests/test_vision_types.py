"""Every piece type the vision package can name reaches the bench board under the editor's type."""
from bench_service.vision import ASSUMED_TYPE, SAME_TYPE, UNSUPPORTED, to_pieces


def comp(tipo, colunas, cor="azul"):
    return {"id": tipo, "tipo": tipo, "cor": cor, "posicao": {"metade": "C", "linha": 0, "colunas": colunas}}


def test_resistor_values_read_from_the_stripe_are_kept():
    pieces, unknown = to_pieces({"componentes": [
        comp("resistor_220", [0, 1]), comp("resistor_470", [2, 3]), comp("resistor_1k", [4, 5]),
        comp("capacitor", [6, 7]),
    ]})
    assert unknown == []
    assert [p["type"] for p in pieces] == ["resistor_220", "resistor_470", "resistor_1k", "capacitor"]


def test_camera_colors_are_locked_after_auto_exposure_settles():
    from bench_service.vision import settle_and_lock

    class Cv:
        CAP_PROP_AUTO_WB, CAP_PROP_AUTO_EXPOSURE = "wb", "exposure"

    class Cap:
        reads, settings = 0, []

        def read(self):
            self.reads += 1
            return True, None

        def set(self, prop, value):
            self.settings.append((prop, value, self.reads))

    cap = Cap()
    settle_and_lock(Cv, cap, seconds=0.05)
    assert cap.reads >= 1
    assert [(p, v) for p, v, _ in cap.settings] == [("wb", 0), ("exposure", 1)]
    assert all(reads == cap.reads for _, _, reads in cap.settings)  # locked only after the reads


def test_every_vision_type_is_mapped_or_explained():
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from visao import config

    named = {rule["tipo"] for rule in config.COMPONENTES.values()}
    named |= {t for rule in config.COMPONENTES.values() for t in rule.get("pontos", {}).values()}
    named |= {faixa["tipo"] for faixa in config.FAIXAS.values()}
    known = SAME_TYPE | set(ASSUMED_TYPE) | set(UNSUPPORTED)
    # vermelho_3 has no kit piece yet and falls to the generic "Peça não reconhecida".
    assert named - known <= {"vermelho_3"}
