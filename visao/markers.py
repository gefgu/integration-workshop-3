"""Experimental ArUco calibration proposal; never enables itself in the bench."""
import cv2 as cv
import numpy as np


def marker_homography(image, anchors):
    """Return model-to-image homography for four explicitly configured marker centers.

    `anchors` maps four unique marker IDs to their known (column, row) locations.
    Missing markers or unreliable geometry return None. The normal grid tracker
    must still validate any proposal before it is used.
    """
    if len(anchors) != 4 or not hasattr(cv, 'aruco'):
        return None
    dictionary = cv.aruco.getPredefinedDictionary(cv.aruco.DICT_4X4_50)
    corners, ids, _ = cv.aruco.ArucoDetector(dictionary).detectMarkers(image)
    if ids is None:
        return None
    detected = {}
    for marker, identifier in zip(corners, ids.flatten()):
        identifier = int(identifier)
        if identifier in detected:
            return None
        detected[identifier] = np.asarray(marker).reshape(4, 2).mean(axis=0)
    if any(identifier not in detected for identifier in anchors):
        return None
    model = np.float32([anchors[k] for k in anchors])
    target = np.float32([detected[k] for k in anchors])
    if not cv.isContourConvex(cv.convexHull(model)) or cv.contourArea(cv.convexHull(model)) < 1:
        return None
    if cv.contourArea(cv.convexHull(target)) < 100:
        return None
    h = cv.findHomography(model, target, 0)[0]
    if h is None or not np.isfinite(h).all() or abs(np.linalg.det(h)) < 1e-9:
        return None
    return h
