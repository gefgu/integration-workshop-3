import cv2
import numpy as np
import time
import matplotlib.pyplot as plt

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

def blob_detector(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    hue, saturation, value = cv2.split(hsv)

    params = cv2.SimpleBlobDetector_Params()
    params.filterByArea = True
    params.minArea = 3000
    params.maxArea = 35000
    params.filterByCircularity = True
    params.minCircularity = 0.2
    params.filterByConvexity = True
    params.minConvexity = 0.2
    params.filterByInertia = True
    params.minInertiaRatio = 0.01
    detector = cv2.SimpleBlobDetector_create(params)

    color_selection = (124, 120, 120) 
    color_range = (20, 120, 120)
    color_a = tuple(c - r for c, r in zip(color_selection, color_range))
    color_b = tuple(c + r for c, r in zip(color_selection, color_range))

    mask = cv2.inRange(hsv, color_a, color_b)
    masked = cv2.bitwise_and(image, image, mask=mask)
    plt.imshow(mask)
    plt.imshow(masked)
    plt.show()

    keypoints = detector.detect(image, mask=mask)

    cv2.drawKeypoints(masked, keypoints=keypoints, outImage=image, color=(255, 0, 0), flags=cv2.DRAW_MATCHES_FLAGS_DRAW_RICH_KEYPOINTS)

    # Show image with detected ellipses
    plt.imshow(image)
    plt.axis('off')
    plt.show()

def hough_circles(image):
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

    t0 = time.time()
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT_ALT, 1, 20, param1=500, param2=0.7, minRadius=10, maxRadius=50)
    print(f'{1/(time.time()-t0)}')

    circles = np.uint16(np.around(circles))

    cimg = image.copy()
    for i in circles[0,:]:
        # draw the outer circle
        cv2.circle(cimg,(i[0],i[1]),i[2],(0,255,0),2)
        # draw the center of the circle
        cv2.circle(cimg,(i[0],i[1]),2,(0,0,255),3)
    plt.imshow(cimg)
    plt.axis('off')
    plt.show()

    for i in circles[0,:]:
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.circle(mask, (i[0], i[1]), i[2], 255, -1)
        masked = cv2.bitwise_and(image, image, mask=mask)

        print('')

        for color_name, color_range in color_ranges.items():
            if color_name != 'vermelho':
                color_mask = cv2.inRange(masked, color_range['lower'], color_range['upper'])
                count = cv2.countNonZero(cv2.bitwise_and(mask, color_mask))
            else:
                color_mask = cv2.inRange(masked, color_range['lower1'], color_range['upper1'])
                count = cv2.countNonZero(cv2.bitwise_and(mask, color_mask))

                color_mask = cv2.inRange(masked, color_range['lower2'], color_range['upper2'])
                count += cv2.countNonZero(cv2.bitwise_and(mask, color_mask))

            print(f'{color_name}: {count}')

        plt.imshow(masked)
        plt.axis('off')
        plt.show()

image = cv2.imread('board.png')
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

hough_circles(image)
