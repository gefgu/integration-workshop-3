import cv2
import numpy as np
import os
import time
from collections import defaultdict
from note_detection.noteParser import NoteParser

# import matplotlib.pyplot as plt
# import matplotlib
# matplotlib.use('qtagg')

output_dir = "color_analysis_output"

# Definindo os intervalos de cores no espaço HSV
color_ranges = {
    'black': {'lower': np.array([0, 0, 0]), 'upper': np.array([180, 255, 30])},
    'orange': {'lower': np.array([0, 50, 100]), 'upper': np.array([15, 200, 255])},
    'pink': {'lower': np.array([160, 15, 140]), 'upper': np.array([180, 50, 255])},
    'blue': {'lower': np.array([100, 150, 50]), 'upper': np.array([130, 255, 255])},
    'green': {'lower': np.array([35, 30, 25]), 'upper': np.array([85, 255, 255])},
    'red': {'lower1': np.array([0, 90, 70]), 'upper1': np.array([0, 255, 255]),
                'lower2': np.array([170, 90, 70]), 'upper2': np.array([179, 255, 255])},
    'wine': {'lower1': np.array([168, 80, 30]), 'upper1': np.array([180, 160, 165]),
             'lower2': np.array([0, 80, 30]), 'upper2': np.array([2, 160, 165])},
    'yellow': {'lower': np.array([20, 100, 100]), 'upper': np.array([40, 255, 255])},
    'cyan': {'lower': np.array([90, 30, 70]), 'upper': np.array([115, 150, 230])}
}

def find_predominant_color_in_rectangle(color_masks, top_left, bot_right):
    # Conta os pixels de cada cor
    color_counts = defaultdict(int)

    mask_size = color_masks['red'][top_left[1]:bot_right[1], top_left[0]:bot_right[0]].size

    for color_name, mask in color_masks.items():
        # conta pixels da cor na mascara

        grid_mask = mask[top_left[1]:bot_right[1], top_left[0]:bot_right[0]]
        count = cv2.countNonZero(grid_mask)
        color_counts[color_name] = count

    # Determina a cor predominante
    if color_counts:
        predominant_color = max(color_counts.items(), key=lambda x: x[1])[0]
        if color_counts[predominant_color] > (0.2 * mask_size):
            return predominant_color
        
def create_circles_mask(bit_mask):
    compressed_mask = cv2.resize(bit_mask, None, fx=0.7, fy=1., interpolation=cv2.INTER_AREA)
    original_height, original_width = bit_mask.shape[:2]

    circles = cv2.HoughCircles(compressed_mask, cv2.HOUGH_GRADIENT_ALT, 1, 20, param1=300, param2=0.7, minRadius=20, maxRadius=200)

    if circles is not None:
        mask = np.zeros(compressed_mask.shape[:2], dtype=np.uint8)

        circles = np.uint16(np.around(circles))
        for i in circles[0,:]:
            cv2.circle(mask, i[:2], i[2], 255, -1)

        return cv2.resize(mask, (original_width, original_height), interpolation=cv2.INTER_AREA)
    else:
        return np.full(bit_mask.shape[:2], 255, dtype=np.uint8)


def fill_small_holes(mask, max_hole_size):
    inv_mask = cv2.bitwise_not(mask)

    contours, _ = cv2.findContours(inv_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area <= max_hole_size:
            cv2.drawContours(mask, [cnt], 0, 255, -1)

    return mask

def create_range_mask(hsv, color_name):
    color = color_ranges[color_name]

    if color_name == 'red' or color_name == 'wine':
        mask1 = cv2.inRange(hsv, color['lower1'], color['upper1'])
        mask2 = cv2.inRange(hsv, color['lower2'], color['upper2'])
        mask = cv2.bitwise_or(mask1, mask2)
    else:
        mask = cv2.inRange(hsv, color['lower'], color['upper'])

    return mask

def create_color_masks(hsv, debug):
    height, width = hsv.shape[:2]
    color_masks = {color: np.zeros((height, width), dtype=np.uint8) for color in color_ranges}

    for color_name in color_ranges.keys():
        mask = create_range_mask(hsv, color_name)

        if debug:
            cv2.imwrite(f"{output_dir}/{color_name}/00-mask_color_range.jpg", mask)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (10, 10))
        mask = cv2.dilate(mask, kernel)
        if debug:
            cv2.imwrite(f"{output_dir}/{color_name}/01-mask-dilate.jpg", mask)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (12, 12))
        mask = cv2.erode(mask, kernel)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (10, 10))
        mask = cv2.dilate(mask, kernel)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (12, 12))
        mask = cv2.erode(mask, kernel)
        if debug:
            cv2.imwrite(f"{output_dir}/{color_name}/02-mask-dilate-erode.jpg", mask)

        mask = fill_small_holes(mask, 1000)
        if debug:
            cv2.imwrite(f"{output_dir}/{color_name}/03-mask-small-holes.jpg", mask)

        if color_name == 'black':
            mask_c = create_circles_mask(mask)
            if debug:
                cv2.imwrite(f"{output_dir}/{color_name}/04-mask-circles.jpg", mask_c)

    
        mask = cv2.bitwise_and(mask, mask_c)

        color_masks[color_name] = mask

    return color_masks


def analisar_cores_com_mascaras(frame_to_analyze, debug=False):
    # Criar diretório para salvar as imagens
    if debug:
        os.makedirs(output_dir, exist_ok=True)

        for color_name in color_ranges.keys():
            os.makedirs(f'{output_dir}/{color_name}', exist_ok=True)

    detected_notes_array = [("None", "") for _ in range(16)]
    duration_map = {1: "quarter", 2: "half", 4: "whole"}
    # frame = cv2.imread('board_warped.png')
    frame = frame_to_analyze

    height, width = frame.shape[:2]

    t0 = time.time()
    # Dicionário para armazenar as máscaras de cada cor
    color_masks = {color: np.zeros((height, width), dtype=np.uint8) for color in color_ranges}

    # Converte para HSV
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Cria mascaras para as 9 cores
    color_masks = create_color_masks(hsv,debug)
    t1 = time.time()

    # Cria uma cópia para desenhar a grade
    grid_frame = frame.copy()

    # Cria uma cópia para escrever as notas encontradas
    found_notes = frame.copy()

    start_pos = (57, 60)
    dx = 66.5
    dy = 46.5

    bar_dx = 274
    bar_dy = 0

    note_parser = NoteParser()

    for b in range(0, 4):
        p = (start_pos[0] + b*bar_dx, start_pos[1] + b*bar_dy)
        for i in range(0, 19):
            for j in range(0, 4):
                current_pos = (p[0] + int(j*dx), p[1] + int(i*dy))
                top_left = (current_pos[0] - int(dx)//2, current_pos[1] - int(dy)//2)
                bot_right = (current_pos[0] + int(dx)//2, current_pos[1] + int(dy)//2)

                predominant_color = find_predominant_color_in_rectangle(color_masks, top_left, bot_right) or 'None'

                cv2.putText(grid_frame, predominant_color,
                            (current_pos[0] - 15, current_pos[1] + 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                cv2.circle(grid_frame, current_pos, 5, (255, 0, 0), -1)
                cv2.rectangle(grid_frame, top_left, bot_right, (0, 255, 0), 3)

                if predominant_color != 'None':
                    note_name, duration_value = note_parser.parse_note((i, predominant_color), 'G')
                    duration_string = duration_map.get(duration_value, "")
                    
                    array_index = b * 4 + j
                    if 0 <= array_index < 16: # Should always be true with current loop structure
                        detected_notes_array[array_index] = (note_name, duration_string)

                    if debug:
                        cv2.putText(found_notes, note_name,
                                    (current_pos[0]-20, current_pos[1] + 40),
                                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 3)

    if debug:
        for color_name, mask in color_masks.items():
            # Converte a máscara para BGR para desenhar em colorido
            mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
            cv2.imwrite(f"{output_dir}/{color_name}/99-mask_final.jpg", mask_bgr)

        # Mostra uma visualização rápida (opcional)
        cv2.imwrite(f'{output_dir}/grade.png', grid_frame)
        cv2.imwrite(f'{output_dir}/notas_classificadas.png', found_notes)

    # rgb = cv2.cvtColor(grid_frame, cv2.COLOR_BGR2RGB)
    # plt.imshow(rgb)
    # plt.show()
    # return t0, t1
    return detected_notes_array

if __name__ == "__main__":
    image_to_load = cv2.imread('board_warped.png')
    t0 = time.time()
    detected_notes = analisar_cores_com_mascaras(image_to_load, False)
    t1 = time.time()
    dt = t1-t0
    fps = 1/dt
    print("Detected notes:")
    for index, note_info in enumerate(detected_notes):
        print(f"Position {index}: Note = {note_info[0]}, Duration = {note_info[1]}")
    print(f'{fps=}, {dt=}')
