import numpy as np
import cv2 as cv

LUMINOSIDADE = 60
CONTRASTE = 1.3
EPSILON = 0.5
RAIO_PIXELS = 9

def get_coords_sockets(image):
    """ mapeia todos os sockets da imagem. 
    será aplicada uma vez no início do processamento
    e sempre que necessário recalibrar (botão na interface gráfica?)"""
    image_gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
    
    blur = cv.GaussianBlur(image_gray, (5, 5), 0)

    thresh = cv.adaptiveThreshold(blur, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 25, 2)

    # tirar ruido:
    kernel = np.ones((3, 3), np.uint8)
    img_limpa = cv.morphologyEx(thresh, cv.MORPH_CLOSE, kernel)

    contornos, _ = cv.findContours(img_limpa.copy(), cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    
    resultado = image.copy()
    quadrados = []
    centros_aceitos = [] # lista de coordenadas dos sockets
    
    DISTANCIA_MINIMA = 15 

    for contorno in contornos:
        area = cv.contourArea(contorno)

        if area < 180 or area > 1500: #testado
            continue

        perimetro = cv.arcLength(contorno, True)

        epsilon = 0.05 * perimetro 
        aprox = cv.approxPolyDP(contorno, epsilon, True)

        if len(aprox) == 4 and cv.isContourConvex(aprox):
            x, y, w, h = cv.boundingRect(aprox)
            aspect_ratio = float(w) / h

            #deixa um limite do ratio para caso de deformaçao na img
            if 0.5 <= aspect_ratio <= 1.5:
                M = cv.moments(aprox)
                if M["m00"] != 0: #m00 = área; m10 = length(x)...
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    
                    # verifica se já existe um quadrado aceito muito perto deste centro
                    sobreposto = False
                    for (centro_x, centro_y) in centros_aceitos:
                        # distancia entre centros:
                        distancia = np.sqrt((cx - centro_x)**2 + (cy - centro_y)**2)
                        if distancia < DISTANCIA_MINIMA:
                            sobreposto = True
                            break
                            
                    # só desenha e salva se não estiver ocupando o lugar de outro
                    if not sobreposto:
                        centros_aceitos.append((cx, cy))
                        quadrados.append(aprox)
                        
                        # teste : tirar dps -> desenha o contorno aprovado
                        cv.drawContours(resultado, [aprox], -1, (0, 255, 0), 2)
                        
                        # Marca os vértices e o centro para debug
                        for ponto in aprox:
                            px, py = ponto[0]
                            cv.circle(resultado, (px, py), 3, (0, 0, 255), -1)
                        cv.circle(resultado, (cx, cy), 3, (255, 0, 0), -1)

    print(f"Quadrados encontrados (sem repetição): {len(quadrados)}")
    cv.imwrite('resultado_quadrados_filtrado.jpeg', resultado)

    # ORDENAÇÃO DO GRID ( PARA TESTE!!) de cima para baixo, da esquerda para a direita
    # Agrupa os Ys que estão próximos (margem de 20 pixels) e depois ordena pelo X
    centros_aceitos.sort(key=lambda pt: (pt[1] // 20, pt[0]))

    return centros_aceitos

def classifica_cor(media_hsv):
    """ classifica a cor pelo valor hsv."""
    ### AJUSTAR OS PARAMETROS DPS COM OS COMPONENTES REAIS

    h, s, v = media_hsv
        
    # checa a LUMINOSIDADE (preto == vazio)
    if v < 30:
        return "vazio"
        
    # baixa saturação == sem cor (branco)
    if s < 40:
        if v > 150:
            return "branco"  # jumper branco
        else:
            return "vazio"   # pode ser um reflexo cinza na placa; ajustar com componentes reais
            
    # analisa cor real (matiz)
    # VERMELHO (Fica nos dois extremos do espectro HSV)
    if (40 <= h <= 80) & (110 <= v <= 180):
        return "vermelho"
        
    # VERDE
    elif 40 <= h <= 85:
        return "verde"    # LED ou buzzers
        
    # AZUL
    elif 100 <= h <= 140:
        return "azul"     # resistor ou capacitor
        
    # AMARELO
    elif 20 <= h <= 35:
        return "amarelo"  # botão ou potenciômetros
        
    else:
        return f"NAO IDENTIFICADO (H={int(h)})"

def extrai_cor_sockets(image, centro_sockets):
    """ recebe uma iamgem e o ponto dela a ser analisado.
    tira uma media da cor dos pixels ao redor e retorna
    a cor correspondente"""

    infos_sockets = []

    # converte para hsv para extrair o canal da matiz
    hsv_img = cv.cvtColor(image, cv.COLOR_BGR2HSV);
    
    raio = RAIO_PIXELS
    altura, largura = hsv_img.shape[:2]

    imagem_debug = image.copy()
    num = 0

    for(x,y) in centro_sockets:
        # define os limites do quadrado garantindo que não saia da imagem
        y_inicio = max(0, y - raio)
        y_fim = min(altura, y + raio)
        x_inicio = max(0, x - raio)
        x_fim = min(largura, x + raio)
        
        regiao = hsv_img[y_inicio:y_fim, x_inicio:x_fim]

        ### PARA TESTE :
        # Desenha um retângulo branco na imagem de debug mostrando a área exata
        # de onde a cor está sendo extraída
        cv.rectangle(imagem_debug, (x_inicio, y_inicio), (x_fim, y_fim), (255, 255, 255), 1)

        num +=1
        if regiao.size > 0:
            media_hsv = cv.mean(regiao)[:3]
            #componente = classifica_componente()
            # teste:
            print(f"/n socket {num}:  media hsv = {media_hsv}")
            cor = classifica_cor(media_hsv)
            infos_sockets.append((x, y, cor))
        else:
            print("erro!!!!!")
    cv.imwrite('debug_areas_leitura.jpg', imagem_debug)
    return infos_sockets

if __name__ == '__main__':

    # acontece UMA VEZ (ou qndo for necessário recalibração):
    image = cv.imread('real_img/foto1.jpg') #imagem inicial SEM COMPONENTES (salva no inicio)
    matriz_centros = get_coords_sockets(image) #vai verificar a posição de todos os sockets


    # EM LOOP (ACONTECE EM NOVOS FRAMES):
    # dps de mapear as coordenadas uma vez, nao muda mais a regiao onde onserva cada socket.
    # então podemos olhar os novos frames (tempo real)
    image = cv.imread('real_img/pecas2.jpeg')
    matriz_final = extrai_cor_sockets(image, matriz_centros)

    #PARA TESTE:
    for (x,y,cor) in matriz_final:
        if cor != "vazio":
            print(f"centro: {x}, {y} -> componente {cor}")