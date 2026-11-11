"""V4L2 controls absent from OpenCV's public capture property list."""
from __future__ import annotations

import fcntl
import os
import struct

# struct v4l2_control { __u32 id; __s32 value; }, Linux videodev2.h.
V4L2_CID_POWER_LINE_FREQUENCY = 0x00980918
VIDIOC_G_CTRL = 0xC008561B
VIDIOC_S_CTRL = 0xC008561C


def set_power_line_frequency(camera_index: int, value: int) -> int:
    """Command a V4L2 menu value and return readback for logging only."""
    descriptor = os.open(f'/dev/video{camera_index}', os.O_RDWR | os.O_NONBLOCK)
    try:
        request = bytearray(struct.pack('=Ii', V4L2_CID_POWER_LINE_FREQUENCY, int(value)))
        fcntl.ioctl(descriptor, VIDIOC_S_CTRL, request, True)
        fcntl.ioctl(descriptor, VIDIOC_G_CTRL, request, True)
        return struct.unpack('=Ii', request)[1]
    finally:
        os.close(descriptor)
