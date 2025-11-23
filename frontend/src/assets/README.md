# Assets Folder

This folder contains static assets used by the QuestNav Configuration Tool.

## Required Images

### quest-usb-debug-dialog.png

**Purpose:** Shows users what the USB debugging permission dialog looks like on their Quest headset.

**Requirements:**
- A screenshot of the Meta Quest USB debugging dialog
- The dialog should show:
  - "Allow USB debugging?" title
  - The RSA key fingerprint
  - "Always allow from this computer" checkbox
  - "Cancel" and "OK" buttons
- Recommended dimensions: 500-800px wide
- Format: PNG with transparency (if possible)

**How to obtain:**
1. Connect your Quest headset to your computer via USB
2. When the USB debugging dialog appears in your headset
3. Take a screenshot (press Oculus button + trigger on right controller)
4. Transfer the screenshot from Quest to your computer
5. Crop and optimize the image
6. Save it as `quest-usb-debug-dialog.png` in this folder

**Alternative:**
If you don't have a screenshot, you can:
- Search online for "Quest USB debugging dialog"
- Use a stock image from Meta's developer documentation
- Create a mockup showing the key elements

**Note:** The component will gracefully hide the image if it's not found, so the app will still work without it.

