import cv2
import numpy as np

from note_detection.note_detection import create_range_mask
from note_detection.warp_perspective import warp_perspective_to_rect

class Calibration:
    def __init__(self):
        points = []

    def generate_calibration(self, frame):
        #frame = frame[:-100, 200:-440]

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        black_mask = create_range_mask(hsv, 'black')

        cv2.imwrite('black_mask.png', black_mask)

        contours, _ = cv2.findContours(black_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)

        top_left_contour = None
        min_sum_xy = float('inf')  # For top-left: min(x+y)

        top_right_contour = None
        max_diff_xy_tr = -float('inf') # For top-right: max((x+w)-y)

        bottom_left_contour = None
        min_diff_xy_bl = float('inf')  # For bottom-left: min(x-(y+h))
        
        bottom_right_contour = None
        max_sum_xy_br = -float('inf') # For bottom-right: max((x+w)+(y+h))

        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.055 * peri, True)
            area = cv2.contourArea(c)
            if len(approx) == 4 and 200 <= area <= 700:
                x,y,w,h = cv2.boundingRect(approx)

                # Top-left check: smallest (x+y)
                current_sum_tl = x + y
                if current_sum_tl < min_sum_xy:
                    min_sum_xy = current_sum_tl
                    top_left_contour = (x, y, w, h)

                # Top-right check: largest ((x+w)-y)
                current_diff_tr = (x + w) - y
                if current_diff_tr > max_diff_xy_tr:
                    max_diff_xy_tr = current_diff_tr
                    top_right_contour = (x, y, w, h)
                
                # Bottom-left check: smallest (x-(y+h))
                current_diff_bl = x - (y + h) 
                if current_diff_bl < min_diff_xy_bl: # We want to minimize x and maximize y+h, so x-(y+h) should be minimal
                    min_diff_xy_bl = current_diff_bl
                    bottom_left_contour = (x, y, w, h)

                # Bottom-right check: largest ((x+w)+(y+h))
                current_sum_br = (x + w) + (y + h)
                if current_sum_br > max_sum_xy_br:
                    max_sum_xy_br = current_sum_br
                    bottom_right_contour = (x, y, w, h)


        outimg = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    
        x, y, w, h = top_left_contour
        top_left = (x, y)
        cv2.rectangle(outimg, (x,y), (x+w,y+h), (36,255,12), 2)

        x, y, w, h = top_right_contour
        top_right = (x + w, y)
        cv2.rectangle(outimg, (x,y), (x+w,y+h), (36,255,12), 2)

        x, y, w, h = bottom_left_contour
        bottom_left = (x, y + h)
        cv2.rectangle(outimg, (x,y), (x+w,y+h), (36,255,12), 2)

        x, y, w, h = bottom_right_contour
        bottom_right = (x+w, y + h)
        cv2.rectangle(outimg, (x,y), (x+w,y+h), (36,255,12), 2)

        cv2.imwrite('calib.png', outimg)

        self.points = [top_left, bottom_left, bottom_right, top_right]
    
    def apply_calibration(self, frame):
        return warp_perspective_to_rect(frame, self.points)


if __name__ == '__main__':
    frame = cv2.imread('board.jpg')
    frame = cv2.rotate(frame, cv2.ROTATE_180)
    frame = frame[:-10, 180:-240]

    calib = Calibration()
    calib.generate_calibration(frame)
    print(calib.points)
    img = calib.apply_calibration(frame)

    cv2.imwrite('board_calibed.png', img)

