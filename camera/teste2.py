import cv2 as cv
import numpy as np


img = cv.imread('bancada_teste.jpeg')

thrd = cv.threshold(img, 127, 255, cv.THRESH_BINARY)[1]

# converte a img para hsv:
hsv_img = cv.cvtColor(thrd, cv.COLOR_BGR2HSV)

cv.imwrite('bancada_teste_trh.jpeg', thrd)
cv.imwrite('bancada_teste_hsv.jpeg', hsv_img)

