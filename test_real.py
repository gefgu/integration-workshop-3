import numpy as np
import cv2 as cv

LUMINOSIDADE = 60
CONTRASTE = 1.3
EPSILON = 0.5

def calibra_lumunosidade(image):
    """calibra a luminosidade da imagem"""
    #METODO 2:
    lab = cv.cvtColor(image, cv.COLOR_BGR2LAB)
    l, a, b = cv.split(lab)
    clahe = cv.createCLAHE(
    clipLimit=2.0,
    tileGridSize=(8, 8)
    )

    l_melhorado = clahe.apply(l)
    lab_melhorado = cv.merge((l_melhorado, a, b))
    resultado = cv.cvtColor(lab_melhorado, cv.COLOR_LAB2BGR)

    cv.imwrite('img_iluminada.jpeg', resultado)
    return image


# def get_contours(image):
#     """ retorna os componentes da imagem em uma lista"""

#     # converte a imagem para escala de cinza:
#     image_gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)

#     #faz o threshold na imagem:
#     thresh = cv.adaptiveThreshold(image_gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2)

#     kernel = np.ones((2, 2), np.uint8)

#     # Remove pequenos pontos brancos
#     img_limpa = cv.morphologyEx(
#         thresh, cv.MORPH_OPEN, kernel
#     )

#     # Fecha pequenos buracos e falhas
#     img_limpa = cv.morphologyEx(
#         img_limpa, cv.MORPH_CLOSE, kernel
#     )

#     num_labels, labels, stats, centroids = \
#     cv.connectedComponentsWithStats(thresh, 8)

#     img_limpa2 = np.zeros_like(thresh)

#     area_minima = 50

#     for i in range(1, num_labels):
#         area = stats[i, cv.CC_STAT_AREA]

#         if area >= area_minima:
#             img_limpa2[labels == i] = 255

#     cv.imshow("Threshold original", thresh)
#     cv.imshow("Threshold limpo", img_limpa)
#     cv.imshow("Threshold limpo2", img_limpa2)
#     cv.waitKey(0)
#     cv.destroyAllWindows()

#     cv.imwrite('imgthres.jpg', thresh)
#     contours, hierarchy = cv.findContours(thresh, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)
#     cv.imwrite('img1_contours.jpeg', cv.drawContours(image.copy(), contours, -1, (0, 255, 0), 3))


#     contornos, _ = cv.findContours(
#     img_limpa.copy(),
#     cv.RETR_EXTERNAL,
#     cv.CHAIN_APPROX_SIMPLE
# )
#     resultado = cv.cvtColor(img_limpa, cv.COLOR_GRAY2BGR)

#     quadrados = []

#     for contorno in contornos:

#         # Ignora regiões muito pequenas
#         area = cv.contourArea(contorno)

#         if area < 20:
#             continue

#         # Aproxima o contorno por um polígono
#         perimetro = cv.arcLength(contorno, True)
#         epsilon = 0.03 * perimetro

#         aprox = cv.approxPolyDP(
#             contorno,
#             epsilon,
#             True
#         )

#         # Quadrados e retângulos geralmente possuem 4 vértices
#         if len(aprox) == 4 and cv.isContourConvex(aprox):

#             quadrados.append(aprox)

#             cv.drawContours(
#                 resultado,
#                 [aprox],
#                 -1,
#                 (0, 255, 0),
#                 2
#             )

#             # Marca os vértices
#             for ponto in aprox:
#                 x, y = ponto[0]
#                 cv.circle(resultado, (x, y), 4, (0, 0, 255), -1)

#     print(f"Quadriláteros encontrados: {len(quadrados)}")

#     cv.imshow("Quadrados e retangulos", resultado)
#     cv.waitKey(0)
#     cv.destroyAllWindows()
#     # assim a gente consegue ver +- qual o tamanho do contorno dos furos da protoboard e quais são
#     # de fato os componentes:
#     # cont_novo = []
#     # area = []


#     # img_copia = image.copy()
#     # for i in range (len(contours)):
#     #     tam = cv.arcLength(contours[i], True)

#     #     if (tam > 26 and tam < 460):
#     #         cont_novo.append(contours[i])
#     #         area.append(cv.contourArea(contours[i]))

#     #         #aproxima polígono (para pegar quadradinho do socket):
#             #aprox = cv.approxPolyDP(i, EPSILON, True)
#             #cv.imwrite('contornoPolig.jpeg', cv.drawContours(img_copia, aprox, -1, (10, 130, 150), 3))
#     #cv.imwrite('img1_contoursDelimitado.jpeg', cv.drawContours(image.copy(), cont_novo, -1, (0, 255, 0), 3))
#     #return cont_novo, area

# # def get_components_by_colors():
# # #epsilon = 0.1*cv.arcLength(contours[0])

# def extrai_cor_socket(image, centro_socket):
#     #convertendo img para hsv: 
    
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
    
    return centros_aceitos

if __name__ == '__main__':

    image = cv.imread('real_img/pecas.jpeg')

    matriz_centros = get_coords_sockets(image)

