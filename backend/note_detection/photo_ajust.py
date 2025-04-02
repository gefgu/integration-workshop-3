import cv2 as cv
import numpy as np
import matplotlib.pyplot as plt

image = cv.imread('a.jpg')
image = cv.cvtColor(image, cv.COLOR_BGR2RGB)

gray = cv.cvtColor(image, cv.COLOR_RGB2GRAY)
blur = cv.GaussianBlur(gray, (11, 11), 0)

_, thresholded = cv.threshold(blur, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
# plt.imshow(thresholded)
# plt.title('Thresholded')
# plt.axis('off')
# plt.show()

edged = cv.Canny(blur, 50, 200)
# plt.imshow(edged)
# plt.title('Edges')
# plt.axis('off')
# plt.show()

def find_contours():
    contours, _ = cv.findContours(edged, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv.contourArea, reverse=True)

    contourned = image.copy()
    cv.drawContours(contourned, contours, -1, (0,255,0), 3)

    plt.imshow(contourned)
    plt.title('Contourned')
    plt.axis('off')
    plt.show()

def hough_circles():
    plt.imshow(thresholded)
    plt.show()
    circles = cv.HoughCircles(gray, cv.HOUGH_GRADIENT_ALT, 1, 50, param1=500, param2=0.4, minRadius=0, maxRadius=10)

    circles = np.uint16(np.around(circles))

    cimg = image.copy()
    for i in circles[0,:]:
        # draw the outer circle
        cv.circle(cimg,(i[0],i[1]),i[2],(0,255,0),2)
        # draw the center of the circle
        cv.circle(cimg,(i[0],i[1]),2,(0,0,255),3)

    plt.imshow(cimg)
    plt.axis('off')
    plt.show()


hough_circles()
