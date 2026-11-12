# Camera identity and USB recovery

Use a persistent capture link instead of a changing `/dev/videoN` number:

```sh
../../.venv/bin/python -m bench_service \
  --camera /dev/v4l/by-id/usb-Jieli_Technology_USB_Composite_Device-video-index0 \
  --port 8765 --dev
```

Run from `bench/service`. `--camera 3` still works: at startup the service pins
that node to its matching `by-id` link, or a `by-path` link if no ID link exists.
An explicit persistent link also lets the service start before the camera is
plugged in. It never scans for a replacement camera after capture loss.

On read failure the service clears published pieces and the old debug image,
releases the capture, and retries the same persistent link once per second.
Each successful connection reapplies the commanded camera settings and creates
fresh calibration, band-value, confirmation and display-hold state. A backend
read can itself block before reporting failure; the one-second delay starts
after it returns. This does not repair a loose cable or USB power problem.

`--record` writes each reconnection into `reconnect-0001`, `reconnect-0002`, etc.
inside the recording directory. Each segment has its own `frames.jsonl` and can
be replayed separately. Existing frames are never overwritten.

The Jieli camera reports no unique serial number. With multiple identical
cameras, use the intended USB port's `/dev/v4l/by-path/...-video-index0` link.
A port link follows the port, so keep that camera connected to that port.
Use the capture node (`video-index0` here), not the metadata node.

Recovery across changed node numbers, missing-at-startup cameras, settings
reapplication, cleared stale state and recording segments are covered with
fakes. A deliberate physical unplug/replug verification remains pending.
