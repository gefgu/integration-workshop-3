"""Capture raw, un-annotated stills from a camera at its best resolution.

Usage: python visao/fixtures/current/_capture_stills.py INDEX PREFIX [COUNT]
       python visao/fixtures/current/_capture_stills.py INDEX PREFIX --bracket

--bracket switches the camera to manual exposure with white balance locked and
saves one still per exposure value (V4L2 units of 100 microseconds), so that
resistor bands blown out by glare can be compared across exposures. It prints
the camera's previous settings; they are not restored on a UVC camera that
resets when closed, and the bench service re-locks its own on start.
"""
import sys
import time

import cv2 as cv

# On this camera 160 gives a mean frame brightness of ~6 and 320 gives ~16 (too dark);
# the auto-locked frame (~95, with clipped band tops) is around 1500.
EXPOSURES = (600, 700, 800, 900, 1000, 1100, 1300)

index, prefix = int(sys.argv[1]), sys.argv[2]
bracket = '--bracket' in sys.argv
count = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 3
if '--restore' in sys.argv:  # no stills: only put the camera back to auto exposure/WB
    count = 0
cap = cv.VideoCapture(index, cv.CAP_V4L2)
if not cap.isOpened():
    sys.exit('camera did not open')
cap.set(cv.CAP_PROP_FOURCC, cv.VideoWriter_fourcc(*'MJPG'))
cap.set(cv.CAP_PROP_FRAME_WIDTH, 1920)
cap.set(cv.CAP_PROP_FRAME_HEIGHT, 1080)
print('size', cap.get(cv.CAP_PROP_FRAME_WIDTH), cap.get(cv.CAP_PROP_FRAME_HEIGHT))
for _ in range(15):  # let exposure settle
    cap.read()
if bracket:
    print('auto exposure value', cap.get(cv.CAP_PROP_AUTO_EXPOSURE),
          'exposure', cap.get(cv.CAP_PROP_EXPOSURE), 'wb', cap.get(cv.CAP_PROP_AUTO_WB))
    cap.set(cv.CAP_PROP_AUTO_WB, 0)
    cap.set(cv.CAP_PROP_AUTO_EXPOSURE, 1)  # V4L2: 1 = manual
    for exposure in EXPOSURES:
        cap.set(cv.CAP_PROP_EXPOSURE, exposure)
        for _ in range(12):
            cap.read()
        ok, frame = cap.read()
        if not ok:
            sys.exit('read failed')
        name = f'{prefix}-exp{exposure}.jpg'
        cv.imwrite(name, frame, [cv.IMWRITE_JPEG_QUALITY, 95])
        print('saved', name, 'exposure now', cap.get(cv.CAP_PROP_EXPOSURE))
else:
    for i in range(1, count + 1):
        ok, frame = cap.read()
        if not ok:
            sys.exit('read failed')
        cv.imwrite(f'{prefix}-{i}.jpg', frame, [cv.IMWRITE_JPEG_QUALITY, 95])
        print('saved', f'{prefix}-{i}.jpg', frame.shape)
        time.sleep(.7)
if bracket or '--restore' in sys.argv:
    # UVC settings persist after the camera closes; leave auto exposure/WB as found so the
    # bench service's own settle-and-lock starts from the normal state.
    cap.set(cv.CAP_PROP_AUTO_EXPOSURE, 3)  # V4L2: 3 = aperture-priority auto
    cap.set(cv.CAP_PROP_AUTO_WB, 1)
    print('restored auto exposure/WB')
cap.release()
