import cv2 as cv
import numpy as np
import pytest

from visao.markers import marker_homography


@pytest.mark.skipif(not hasattr(cv, 'aruco'), reason='OpenCV ArUco unavailable')
def test_four_markers_and_missing_marker():
    dictionary = cv.aruco.getPredefinedDictionary(cv.aruco.DICT_4X4_50)
    image = np.full((400, 600, 3), 255, np.uint8)
    points = [(50, 50), (450, 50), (450, 250), (50, 250)]
    anchors = {0: (0, 0), 1: (10, 0), 2: (10, 5), 3: (0, 5)}
    for identifier, (x, y) in enumerate(points):
        marker = cv.aruco.generateImageMarker(dictionary, identifier, 80)
        image[y:y + 80, x:x + 80] = cv.cvtColor(marker, cv.COLOR_GRAY2BGR)
    h = marker_homography(image, anchors)
    assert h is not None
    mapped = cv.perspectiveTransform(np.float32([list(anchors.values())]), h)[0]
    np.testing.assert_allclose(mapped, np.float32([(x + 39.5, y + 39.5) for x, y in points]), atol=1)
    image[250:330, 50:130] = 255
    assert marker_homography(image, anchors) is None
