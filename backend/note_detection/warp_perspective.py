import cv2
import numpy as np

def warp_perspective_to_rect(image, points):
    """
    Applies a perspective transform to warp the area defined by 4 points into a rectangle.

    Parameters:
    - image: Input image (numpy array)
    - points: List or array of 4 points (each as [x, y]) in any order

    Returns:
    - Warped rectangular image
    """

    # Convert to float32 numpy array
    pts = np.array(points, dtype="float32")

    # Order points: top-left, top-right, bottom-right, bottom-left
    def order_points(pts):
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1)

        rect[0] = pts[np.argmin(s)]      # top-left
        rect[2] = pts[np.argmax(s)]      # bottom-right
        rect[1] = pts[np.argmin(diff)]   # top-right
        rect[3] = pts[np.argmax(diff)]   # bottom-left

        return rect

    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Compute width and height of the new image
    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = int(max(widthA, widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = int(max(heightA, heightB))

    # Destination rectangle
    delta = 50
    dst = np.array([
        [delta, delta],
        [maxWidth - 1 - delta, delta],
        [maxWidth - 1 - delta, maxHeight - 1 - delta],
        [delta, maxHeight - 1 - delta]
    ], dtype="float32")

    # Compute the perspective transform matrix
    M = cv2.getPerspectiveTransform(rect, dst)

    # Apply the warp
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))

    return warped

if __name__ == '__main__':
    image = cv2.imread('board.png')
    points = [[100, 200], [400, 180], [420, 500], [120, 520]]  # your 4 points
    warped = warp_perspective_to_rect(image, points)
    cv2.imwrite('warped_board.png', warped)
