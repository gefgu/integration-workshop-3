import cv2
import numpy as np
import os
from collections import defaultdict

def analisar_cores_com_mascaras():
    # Criar diretório para salvar as imagens
    output_dir = "color_analysis_output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Definindo os intervalos de cores no espaço HSV
    color_ranges = {
        'preto': {'lower': np.array([0, 0, 0]), 'upper': np.array([180, 255, 50])},
        'laranja': {'lower': np.array([0, 100, 100]), 'upper': np.array([15, 255, 255])},
        'rosa': {'lower': np.array([160, 15, 140]), 'upper': np.array([180, 50, 255])},
        'azul': {'lower': np.array([100, 150, 50]), 'upper': np.array([130, 255, 255])},
        'verde': {'lower': np.array([35, 30, 25]), 'upper': np.array([85, 255, 255])},
        'vermelho': {'lower1': np.array([0, 120, 70]), 'upper1': np.array([0, 255, 255]),
                    'lower2': np.array([170, 120, 100]), 'upper2': np.array([179, 255, 255])},
        'vinho': {'lower': np.array([168, 50, 30]), 'upper': np.array([176, 180, 120])},
        'amarelo': {'lower': np.array([20, 100, 100]), 'upper': np.array([40, 255, 255])},
        'ciano': {'lower': np.array([95, 30, 80]), 'upper': np.array([110, 130, 230])}
    }
    
    # Inicializa a webcam com parâmetros otimizados para Raspberry Pi
    # Tamanho da matriz (linhas x colunas)
    rows = 16
    cols = 19
    
    frame = cv2.imread('board.png')
    
    # Redimensiona para garantir que a divisão será exata
    height, width = frame.shape[:2]
    new_width = width - (width % cols)
    new_height = height - (height % rows)
    frame = cv2.resize(frame, (new_width, new_height))
    height, width = frame.shape[:2]
    
    # Converte para HSV
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # Calcula o tamanho de cada célula
    cell_height = height // rows
    cell_width = width // cols
    
    # Cria uma cópia para desenhar a grade
    grid_frame = frame.copy()
    
    # Desenha a grade
    for i in range(1, rows):
        cv2.line(grid_frame, (0, i * cell_height), (width, i * cell_height), (255, 255, 255), 1)
    for j in range(1, cols):
        cv2.line(grid_frame, (j * cell_width, 0), (j * cell_width, height), (255, 255, 255), 1)
    
    # Dicionário para armazenar as máscaras de cada cor
    color_masks = {color: np.zeros((height, width), dtype=np.uint8) for color in color_ranges}
    
    # Processa cada célula da matriz
    for i in range(rows):
        for j in range(cols):
            # Define a região da célula atual
            y_start = i * cell_height
            y_end = (i + 1) * cell_height
            x_start = j * cell_width
            x_end = (j + 1) * cell_width
            
            # Recorta a célula da imagem HSV
            cell = hsv[y_start:y_end, x_start:x_end]
            
            # Conta os pixels de cada cor
            color_counts = defaultdict(int)
            
            for color_name, ranges in color_ranges.items():
                # Cria máscara para a cor atual
                if color_name == 'vermelho':
                    mask1 = cv2.inRange(cell, ranges['lower1'], ranges['upper1'])
                    mask2 = cv2.inRange(cell, ranges['lower2'], ranges['upper2'])
                    mask = cv2.bitwise_or(mask1, mask2)
                else:
                    mask = cv2.inRange(cell, ranges['lower'], ranges['upper'])
                
                count = cv2.countNonZero(mask)
                color_counts[color_name] = count
                
                # Atualiza a máscara geral para esta cor
                color_masks[color_name][y_start:y_end, x_start:x_end] = mask
            
            # Determina a cor predominante
            if color_counts:
                predominant_color = max(color_counts.items(), key=lambda x: x[1])[0]
                if color_counts[predominant_color] > (0.05 * cell.size / 3):
                    center_x = x_start + cell_width // 2
                    center_y = y_start + cell_height // 2
                    cv2.circle(grid_frame, (center_x, center_y), 5, (0, 0, 0), -1)
                    cv2.putText(grid_frame, predominant_color[:3], 
                               (center_x - 15, center_y + 5), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)
    
    # Salva a imagem original com a grade
    cv2.imwrite(f"{output_dir}/original_grid.jpg", grid_frame)
    
    # Salva as máscaras de cada cor com a grade sobreposta
    for color_name, mask in color_masks.items():
        # Converte a máscara para BGR para desenhar em colorido
        mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        
        # Desenha a grade na máscara
        for i in range(1, rows):
            cv2.line(mask_bgr, (0, i * cell_height), (width, i * cell_height), (0, 0, 255), 1)
        for j in range(1, cols):
            cv2.line(mask_bgr, (j * cell_width, 0), (j * cell_width, height), (0, 0, 255), 1)
        
        # Salva a máscara com a grade
        cv2.imwrite(f"{output_dir}/mask_{color_name}.jpg", mask_bgr)
    
    # Mostra uma visualização rápida (opcional)
    cv2.imwrite(f'{output_dir}/Visualização.png', grid_frame)
    
if __name__ == "__main__":
    analisar_cores_com_mascaras()
