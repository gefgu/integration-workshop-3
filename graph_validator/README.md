# graph_validator

Turns what the camera sees on the TedTronics board into a graph and checks it against a lesson step's target graph (Notion requirements SFR1–8, SFR12, SFR14/15, SFR19, SFR23, SNFR6, SNFR12).

```
pip install -e '.[dev]' && pytest
uvicorn graph_validator.service.app:app          # HTTP service
python -m graph_validator.cli validate lesson.json board.json [--teacher] [--step N]
```

## How it works
- **Graph (SFR1):** one node per component terminal (`ctype`, `terminal`, `value`, `col`, `row`). Edges: inside a component, and between terminals in the same column. Rows never create edges (a column is one net across both banks). Battery and LED keep distinct terminals (polarity matters); other parts have orderless `pin` legs.
- **Match (SFR5/6/8):** networkx VF2 isomorphism behind cheap prefilters (counts, labels, degrees, WL hash). Default: type only. Per step `options`: `match_values` (resistor/pot value), `strict_positions` (compared relative to the circuit's bounding box, so shifting a build never breaks it).
- **Feedback (SFR12/14/15):** `complete`, `missing_component`, `missing_connection`, `excess_connection`, `incorrect_connection`, `reversed_polarity`, `wrong_value`, `wrong_component`, `misconnected_component`, `open_circuit`, `short_circuit`; default pt-BR messages, per-step `overrides: {category: {family|"*": text}}` (SFR15.1).
- **Steps (SFR2/3/4/19/23):** guided = target per step (cumulative `add`, or explicit `pieces` boundary); challenge = final target only. `lint` enforces exactly one action per guided step. `interact` steps are approved from the quiz answer.
- **Hint (SFR7):** `hint` is returned only when `graph_hash != previous_graph_hash` and the step isn't approved.

## JSON contracts
- Lesson: `{id, kind: guided|challenge, time_limit_s?, steps:[{id, action, add:[Piece]|pieces:[Piece], options?, interact?:{quiz_correct_id}, overrides?}]}`; Piece = `{id,type,a,b,row,value?}` (same as the teacher app).
- Board: camera `{"components":[{"type","terminals":{"anode":{"col","row"},…}}]}` (LED needs `anode`/`cathode`, battery `+`/`-`; other parts any two keys) or `{"pieces":[…]}`.
- Teacher-app lesson JSON v1 maps to a final-target-only lesson (`/lessons/import-teacher`).
- Endpoints: `GET /health`, `POST /lessons/lint`, `POST /lessons/import-teacher`, `POST /validate/step`, `POST /validate/final`. Invalid boards (bounds, kit limits, shared sockets) return 422 `invalid_board`, not feedback.

## Assumptions
Short/long jumpers are one family; capacitor value is ignored; camera output already carries a resolved `type` (colour+dots disambiguation stays in vision code). Out of scope: ENFR6 current limits, EFR18 energize gate, smart-capsule behaviour.

## Used by the teacher app
The teacher authoring app creates steps (auto-split from the final board, then editable) and its **Testar** mode validates through this service. The same FastAPI service also serves SQLite-backed `/workspace` endpoints for lessons, turmas and students. See the repository README for setup. After installing the Python and web dependencies, run this from the repository root to apply migrations and start both services:
```
./run.sh
```
Extra endpoints for the app: `GET /feedback/categories` (default pt-BR messages for the override UI) and `byStep` in the `/lessons/lint` response.
