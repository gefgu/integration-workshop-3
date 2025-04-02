import cv2
import numpy as np
import matplotlib.pyplot as plt

# Load image
image = cv2.imread("../color_analysis_output/grade.png")
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)  # Convert BGR to RGB for Matplotlib

gamma = 1/2.2
lookUpTable = np.empty((1,256), np.uint8)
for i in range(256):
    lookUpTable[0,i] = np.clip(pow(i / 255.0, gamma) * 255.0, 0, 255)

image = cv2.LUT(image, lookUpTable)

# Callback for mouse clicks
def on_click(event):
    if event.xdata is not None and event.ydata is not None:
        x = int(event.xdata)
        y = int(event.ydata)

        rgb = image[y, x]
        hsv = cv2.cvtColor(np.uint8([[rgb]]), cv2.COLOR_RGB2HSV)[0][0]

        print(f"--- Pixel at ({x}, {y}) ---")
        print(f"HSV: {hsv}")

# Display the image
fig, ax = plt.subplots()
ax.imshow(image)
ax.set_title("Click anywhere to pick a color!")
fig.canvas.mpl_connect('button_press_event', on_click)
plt.axis('off')
plt.show()
