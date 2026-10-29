import numpy as np
import cv2 as cv

def get_components_by_contours(image):
    """ retorna os componentes da imagem em uma lista"""

    # converte a imagem para escala de cinza:
    image_gray = cv.cvtColor(image, cv.COLOR_BGR2GRAY)
    cv.imwrite('bancada_teste_gray.jpeg', image_gray)

    #faz o threshold na imagem:
    ret, thresh = cv.threshold(image_gray, 127, 255, 0)
    cv.imwrite('bancada_teste_thresh.jpeg', thresh)

    contours, hierarchy = cv.findContours(thresh, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)
    cv.imwrite('bancada_teste_contours.jpeg', cv.drawContours(image.copy(), contours, -1, (0, 255, 0), 3))

    # assim a gente consegue ver +- qual o tamanho do contorno dos furos da protoboard e quais são
    # de fato os componentes:
    cont_novo = []
    area = []

    for i in range (len(contours)):
        tam = cv.arcLength(contours[i], True)

        if (tam > 26 and tam < 750):
            cont_novo.append(contours[i])
            area.append(cv.contourArea(contours[i]))
    return cont_novo, area

# def get_components_by_colors():
# #epsilon = 0.1*cv.arcLength(contours[0])


if __name__ == '__main__':
    image = cv.imread('bancada_teste.jpeg')
    componentes, areas = get_components_by_contours(image)
    cv.imwrite('bancada_teste_contours_filtered.jpeg', cv.drawContours(image.copy(), componentes, -1, (0, 255, 0), 3))

    for i in range(len(componentes)):
        print(f'Componente {i} - Area: {areas[i]}')