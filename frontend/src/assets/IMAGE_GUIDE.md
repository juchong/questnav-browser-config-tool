# Adding the Quest USB Debugging Dialog Image

## Quick Start

To add the USB debugging dialog image to your app:

1. **Obtain or create the image** (see options below)
2. **Save it as:** `frontend/src/assets/quest-usb-debug-dialog.png`
3. **Rebuild:** `npm run build` (from the frontend folder)
4. **Done!** The image will now appear during authentication

## Image Requirements

- **Filename:** Must be exactly `quest-usb-debug-dialog.png`
- **Location:** `frontend/src/assets/` folder
- **Format:** PNG (supports transparency)
- **Source dimensions:** 683 x 867 pixels (portrait orientation) or similar
- **Display size:** Automatically scales to fit screen:
  - Mobile (< 480px): 100% width
  - Tablet (481-767px): Max 350px wide
  - Desktop (768px+): Max 400px wide
- **Aspect ratio:** Preserved automatically
- **Content:** Should show the Quest USB debugging permission dialog

## How to Obtain the Screenshot

### Option 1: Take Your Own Screenshot (Recommended)

1. Connect your Quest headset via USB to your computer
2. When the "Allow USB debugging?" dialog appears in your headset:
   - Press **Oculus/Meta button** + **right trigger** to take a screenshot
3. The screenshot will be saved in your Quest's gallery
4. Transfer it to your computer:
   - Connect Quest to PC
   - Navigate to: `Quest > Internal Storage > Oculus > Screenshots`
   - Copy the image to your computer
5. Crop and optimize the image (remove unnecessary borders)
6. Save as `quest-usb-debug-dialog.png` in `frontend/src/assets/`

### Option 2: Use Stock Image

- Search Meta's developer documentation for official screenshots
- Look for "Quest USB debugging dialog" in Meta Quest Developer docs
- Ensure you have rights to use the image

### Option 3: Create a Mockup

Use an image editor to create a mockup showing:
- "Allow USB debugging?" title text
- RSA key fingerprint display
- "Always allow from this computer" checkbox
- "Cancel" and "OK" buttons
- Quest UI styling (dark theme)

## What the Image Should Show

The Quest USB debugging dialog includes:

```
┌───────────────────────────────────┐
│  Allow USB debugging?             │
│                                   │
│  The computer's RSA key           │
│  fingerprint is:                  │
│  XX:XX:XX:XX:XX:...               │
│                                   │
│  ☐ Always allow from this         │
│     computer                      │
│                                   │
│  [Cancel]            [OK]         │
└───────────────────────────────────┘
```

## Fallback Behavior

**Don't have an image yet?** No problem!

- The app will work fine without the image
- The authentication dialog will still display all the important information
- The image section will be automatically hidden if the file is missing
- Users will still see the timer, tips, and cancel button

## Testing

After adding the image:

1. Run the development server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Connect to a Quest device to trigger the authentication flow

3. The image should appear between the timer and the tip section

## Troubleshooting

**Image not showing?**
- Check the filename is exactly: `quest-usb-debug-dialog.png` (case-sensitive)
- Verify location: `frontend/src/assets/quest-usb-debug-dialog.png`
- Clear browser cache and reload
- Check browser console (F12) for any errors
- Rebuild the project: `npm run build`

**Image too large/small?**
- The component automatically scales the image responsively
- Source image: 683 x 867 pixels works perfectly
- Maximum display width varies by screen size:
  - Mobile: Full width
  - Tablet: 350px
  - Desktop: 400px
- Maintains aspect ratio automatically
- Portrait orientation (taller than wide) is ideal

## File Structure

```
frontend/
  src/
    assets/
      README.md                          ← Instructions
      quest-usb-debug-dialog.png         ← Your image goes here
      quest-usb-debug-dialog.png.placeholder  ← Remove after adding real image
    components/
      AuthenticationStatus.tsx           ← Component that displays the image
```

## Example Code

The image is loaded dynamically in `AuthenticationStatus.tsx`:

```typescript
const usbDebugImage = new URL('../assets/quest-usb-debug-dialog.png', import.meta.url).href;

// Display with error handling
<img 
  src={usbDebugImage} 
  alt="Quest USB debugging permission dialog"
  onError={(e) => e.currentTarget.style.display = 'none'}
/>
```

This approach:
- ✅ Works with Vite's asset bundling
- ✅ Optimizes the image automatically
- ✅ Includes the image in production builds
- ✅ Gracefully handles missing images
- ✅ Provides proper caching headers

