# Rodando o Servidor
- Crie o virtual enviroment
- Instale os pacotes do requirements.txt
- Na root do projeto (:~/integration-workshop-3$):
```
python3 main.py
```

# Documentação: Diretórios `core/` e `modes/`

Esta documentação detalha os componentes dos diretórios `core/` e `modes/` do projeto Melody, com foco no propósito de cada módulo e nas tarefas pendentes (TODOs).

---

### Diretório `core/`

O diretório `core/` contém os módulos centrais que formam a base da funcionalidade do projeto Melody.

#### 1. `core/hardware.py`

* **Propósito**: Este módulo é responsável por interagir com os componentes de hardware do projeto. Atualmente, ele define funções para controlar LEDs.
* **Funcionalidades**:
    * `turnOnLed(indexLed, color="GREEN")`: Acende um LED específico com uma cor definida (o padrão é verde).
    * `turnOffLed(indexLed)`: Apaga um LED específico.
* **🔴 TODOs/Pontos Pendentes**:
    * Implementar botões para chamar as respectivas funções de configuração (`set_volume`, `set_tempo`, `play/stop`).
    * Realmente acender e apagar os respectivos leds
    * Implementar um botão de emergência que reseta tudo.
    * Desenvolver a comunicação com o ESP32.
    * Implementar o controle do servo motor.
    * Implementar o controle do motor de vibração (vibracall).

---

#### 2. `core/noteDetection.py`

* **Propósito**: Este módulo é projetado para lidar com a detecção de notas musicais, presumivelmente através de uma câmera ou outro sensor.
* **Funcionalidades**:
    * `NoteDetection` (classe):
        * `__init__(self)`: Inicializa o detector, configurando `notes_detected` como `None` e `running` como `True`.
        * `detect_note_loop(self)`: Contém o loop principal para a detecção de notas.
        * `get_notes_detected(self)`: Retorna as notas detectadas.
        * `stop_note_detection_thread(self)`: Para a thread de detecção de notas.
* **🔴 TODOs/Pontos Pendentes**:
    * Implementar toda a lógica para detectar as notas dentro de `detect_note_loop`. A variável `self.notes_detected` é crucial e deve ser atualizada por esta lógica.

---

#### 3. `core/session.py`

* **Propósito**: Este módulo é **crucial** para o gerenciamento do estado global da aplicação. Ele mantém informações sobre o volume, tempo, estado de reprodução, página atual da interface, melodia selecionada, nota atual, status de acessibilidade e o índice da nota atual na melodia. Ele centraliza o estado para que diferentes partes do sistema (API, modos de operação) possam acessá-lo e modificá-lo de forma consistente. As funções `set_*` atualizam o estado e, em alguns casos, imprimem o novo valor no console para depuração. A função `as_dict()` é usada para transmitir o estado atual, provavelmente para a interface do usuário via WebSockets.
* **Funcionalidades**:
    * `PlayerState` (dataclass): Define a estrutura para armazenar o estado da sessão.
        * `volume`: Volume atual (0-100%).
        * `tempo`: Andamento atual (BPM).
        * `playing`: Booleano indicando se a música está tocando.
        * `page`: String que representa a página/estado atual da interface.
        * `melody`: Nome ou ID da melodia selecionada.
        * `note`: Nota atual dentro da melodia.
        * `accessibility`: Booleano indicando se o modo de acessibilidade está ativo.
        * `note_index`: Índice da nota atual na melodia.
    * `set_volume(value: int)`: Define o volume, limitado entre 0 e 100.
    * `set_tempo(bpm: int)`: Define o tempo, limitado entre 60 e 120 BPM.
    * `start_playback()`: Define `state.playing` como `True`.
    * `stop_playback()`: Define `state.playing` como `False`.
    * `select_melody(name: str)`: Seleciona uma melodia e define a nota inicial.
    * `set_page(name: str)`: Define a página/estado atual da interface.
    * `set_note(note: str)`: Define a nota atual.
    * `set_note_index(idx: int)`: Define o índice da nota atual.
    * `set_accessibility(flag: bool)`: Ativa/desativa o modo de acessibilidade.
    * `play_current_melody_note()`: Toca a nota atual da melodia selecionada, considerando sua duração.
    * `as_dict()`: Retorna o estado atual como um dicionário.
* **🔴 TODOs/Pontos Pendentes**:
    * Em `set_volume(value: int)`: Implementar a lógica para de fato **AUMENTAR O VOLUME NO ALTO-FALANTE**.
    * Em `play_current_melody_note()`: Adicionar a lógica para mais duas melodias além de "Ovelha Preta".

---

#### 4. `core/soundPlaying.py`

* **Propósito**: Este módulo é dedicado à geração e reprodução de sons de notas musicais. Ele usa `numpy` para gerar as ondas sonoras e `sounddevice` para reproduzi-las.
* **Funcionalidades**:
    * `sample_rate`: Taxa de amostragem para o áudio (44100 Hz).
    * `envelope(t, attack, decay, sustain_level, release)`: Define o envelope ADSR (Attack, Decay, Sustain, Release) para a nota, moldando sua amplitude ao longo do tempo.
    * `synthesize_note(frequency, duration)`: Gera a forma de onda para uma nota com uma determinada frequência e duração, aplicando o envelope.
    * `play_note_async(note, duration)`: Função assíncrona para tocar uma nota. Busca a frequência da nota no dicionário `note_freqs` (de `core.utils`), sintetiza a onda sonora (usando `asyncio.to_thread` para não bloquear o loop de eventos) e a reproduz usando `sounddevice`.
    * `run_sequence()`: Uma função de exemplo para tocar uma sequência de notas (escala de Dó).
* **🔴 TODOs/Pontos Pendentes**: Nenhum TODO explícito marcado no código, mas a funcionalidade depende das frequências de notas e melodias definidas em `core/utils.py`.

---

#### 5. `core/utils.py`

* **Propósito**: Este módulo serve como um utilitário para armazenar dados e constantes usados em outras partes do projeto, como definições de melodias e frequências de notas.
* **Funcionalidades**:
    * `OVELHA_PRETA`: Uma lista de tuplas representando as notas e suas durações para a melodia "Ovelha Preta".
    * `note_freqs`: Um dicionário mapeando nomes de notas (e seus acidentes como sustenido '#' ou bemol 'b') para suas frequências em Hertz.
* **🔴 TODOs/Pontos Pendentes**:
    * Adicionar o *hardcode* de mais melodias (sequência de notas com duração).
    * Completar o *hardcode* de notas, com suas frequências, etc. (embora `note_freqs` já pareça bastante completo).
    * Implementar o *hardcode* do mapeamento de notas (cor -> nota), que seria usado pela detecção de notas baseada em cores.

---

### Diretório `modes/`

O diretório `modes/` contém módulos que definem os diferentes modos de operação da aplicação Melody. Cada modo geralmente tem uma função `run_mode()` que é executada quando esse modo está ativo. O `ModeManager` em `backend/main.py` controla a transição entre esses modos com base no valor de `session.state.page`.

#### 1. `modes/creation.py`

* **Propósito**: Define o comportamento do "Modo de Criação". Neste modo, o sistema toca uma sequência de notas em loop, acendendo LEDs correspondentes a cada tempo/coluna no tabuleiro.
* **Funcionalidades**:
    * `run_mode()`: Loop principal do modo.
        * Verifica se `session.state.playing` é `True`.
        * Calcula o `columnIndex` (0-15) baseado nos `beats`.
        * Apaga o LED da coluna anterior e acende o LED da coluna atual.
        * Toca a nota correspondente à coluna atual da melodia `notes_and_durations`.
        * Incrementa `beats` e espera um tempo baseado no `session.state.tempo`.
    * `get_empty_board()`: Retorna uma representação de um tabuleiro vazio.
    * `get_duration_value(duration_string)`: Converte a string de duração ("quarter", "half", "whole") para um valor numérico.
* **🔴 TODOs/Pontos Pendentes**:
    * A variável `notes_and_durations` está atualmente usando `OVELHA_PRETA` como *mock*. Precisa ser atualizada para usar as notas realmente detectadas (presumivelmente do `noteDetection.py`) ou uma melodia que o usuário está criando.
    * No `run_mode()`, ao tocar a nota, deve usar a lista atualizada de notas, não uma fixa.

---

#### 2. `modes/hear.py`

* **Propósito**: Define o "Modo Escute a Nota". A intenção é que o sistema toque uma nota de uma melodia pré-carregada, e o usuário tente identificar e posicionar a nota correspondente no tabuleiro. O sistema então daria feedback.
* **Funcionalidades**:
    * `run_mode()`: Loop principal do modo.
        * Espera que `session.state.playing` seja `True` e que uma melodia (`session.state.melody`) esteja selecionada.
        * Contém placeholders para a lógica principal.
* **🔴 TODOs/Pontos Pendentes**:
    * Tocar a nota atual da melodia.
    * Esperar que o usuário posicione a nota correspondente.
    * Usar `noteDetection` para verificar se a nota posicionada corresponde à tocada.
    * Acender LED verde se correto e avançar o índice da nota.
    * Acender LED vermelho se incorreto.
    * Acender LED amarelo se nada for detectado.

---

#### 3. `modes/identify.py`

* **Propósito**: Define o "Modo Identifique a Nota". Neste modo, o sistema indica uma nota (presumivelmente mostrando-a na interface ou de outra forma visual), e o usuário deve posicioná-la no tabuleiro. O sistema verifica a correção.
* **Funcionalidades**:
    * `run_mode()`: Loop principal do modo.
        * Espera que `session.state.playing` seja `True` e que uma melodia (`session.state.melody`) esteja selecionada.
        * Contém placeholders para a lógica principal.
* **🔴 TODOs/Pontos Pendentes**:
    * Ler a nota atual da melodia usando `note_index`.
    * Usar `noteDetection` para ler a nota posicionada pelo usuário.
    * Comparar a nota detectada com a nota esperada.
    * Acender LED verde se correto e avançar o índice.
    * Acender LED vermelho se incorreto.
    * Acender LED amarelo se nada for detectado.

---

#### 4. `modes/idle.py`

* **Propósito**: Define o modo "Idle" ou "Home". Este é o estado padrão ou inicial da aplicação. Ele reseta a seleção de melodia e para a reprodução.
* **Funcionalidades**:
    * `run_mode()`:
        * Seleciona `None` para a melodia (`session.select_melody(None)`).
        * Para a reprodução (`session.stop_playback()`).
        * Entra em um loop enquanto `session.state.page` for "home".
        * Verifica se `session.state.accessibility` está ativo para executar a lógica correspondente.
* **🔴 TODOs/Pontos Pendentes**:
    * Se `session.state.accessibility` for `True`, implementar a lógica de comunicação com o ESP32 ("Turn on ESP32 Communication").

---