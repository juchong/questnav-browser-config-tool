# QuestNav Browser Configuration Tool

A modern web-based tool for automatically configuring Meta Quest 2 and Quest 3 headsets using predefined ADB commands. Built with React, TypeScript, Node.js, and WebUSB technology.

## Supported Platforms

This tool works on all platforms where WebUSB is supported in Chromium browsers:

- ✅ **Windows** - Works on Windows 10+ with Chrome, Edge, or other Chromium browsers
- ✅ **macOS** - Works on Mac with Chrome or Edge
- ✅ **Linux** - Works on most Linux distributions with Chrome or Edge
- ✅ **Android** - Works on Android phones with Chrome v112+

**Important**: WebUSB requires **HTTPS** in production. For local development, `localhost` works over HTTP.

See [PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md) for detailed platform information.

## Features

### Core Functionality
- **One-Click Configuration**: Apply complete Quest configurations with a single button click
- **WebUSB Integration**: Direct browser-to-device communication using modern WebADB technology
- **Device Validation**: Automatically detects and validates Quest 2 and Quest 3 headsets
- **Real-time Progress**: Visual feedback with countdown timers during command execution
- **Smart Error Handling**: Contextual help with troubleshooting steps for common issues

### User Interface
- **Authentication Status Display**: Beautiful card-based progress indicator with:
  - Visual countdown timer during authentication
  - Reference image of USB debugging permission dialog
  - Helpful tips and reminders
  - Stage-specific styling (connecting, authenticating, etc.)
- **Error Help System**: Structured error messages with:
  - Icon-coded warnings vs errors
  - Step-by-step troubleshooting guides
  - Technical details toggle
  - Retry and dismiss actions

### Administration
- **Admin Interface**: Web-based UI for managing configuration profiles
- **Execution Logging**: Track configuration history and success rates
- **Profile Management**: Create, edit, and delete configuration profiles

### Deployment
- **Docker Ready**: Easy deployment with Docker Compose
- **HTTPS Support**: Nginx reverse proxy configuration included

## Technology Stack

- **Frontend**: React 18 + Vite + TypeScript
- **WebADB**: @yume-chan/adb v2.3.1 (Tango ADB - modern, actively maintained)
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (no external dependencies)
- **Deployment**: Docker + Docker Compose + Nginx

Based on the [Tango ADB](https://tangoadb.dev/) implementation (formerly ya-webadb).

## Prerequisites

### For Users

**Platform Requirements:**
- **Windows**: Windows 10 or later with Chrome, Edge, Brave, or Opera
- **macOS**: Chrome or Edge browser
- **Linux**: Most distributions with Chrome or Edge
- **Android**: Chrome v112+ (most Android phones from 2020+)

**Hardware:**
- Meta Quest 2 or Quest 3 headset with Developer Mode enabled
- USB-C cable (high-quality cable recommended)
- For Android: Phone must support USB OTG (most modern phones do)

**Note**: This tool is designed specifically for Quest 2 and Quest 3 headsets. Other Quest models or Android devices will be detected and a helpful message will be displayed.

### For Developers
- Node.js 20 LTS (recommended) - **Node.js 24+ may have native module compilation issues**
- npm (included with Node.js)
- (Optional) Docker and Docker Compose for containerized deployment

## Quick Start

### Option 1: Automated Setup (Recommended)

**Windows (PowerShell):**
```powershell
.\start-dev.ps1
```

**macOS/Linux:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

These scripts will:
- Check for Node.js installation
- Install dependencies for both frontend and backend
- Start both servers in separate terminal windows
- Open your browser automatically

### Option 2: Manual Setup

#### Development Mode

1. **Clone the repository**
```bash
git clone <repository-url>
cd questnav-browser-config-tool
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Start the backend server** (Terminal 1)
```bash
cd backend
npm run dev
```

5. **Start the frontend development server** (Terminal 2)
```bash
cd frontend
npm run dev
```

6. **Open your browser**
Navigate to `http://localhost:5173`

### Production Deployment with Docker

1. **Build and start the containers**
```bash
docker-compose up -d
```

2. **Access the application**
Navigate to `http://localhost:3000`

3. **Stop the containers**
```bash
docker-compose down
```

4. **View logs**
```bash
docker-compose logs -f questnav-app
```

## Usage Guide

### First-Time Setup

1. **Enable Developer Mode on Quest** (one-time setup)
   - Create a developer account at [Meta Quest Developer Center](https://developer.oculus.com/)
   - Install the Meta Quest mobile app on your phone
   - Navigate to Menu → Devices → Your Quest → Developer Mode and toggle it on
   - Restart your Quest headset

2. **Prepare Your Connection**
   - **Android**: Ensure your phone supports USB OTG (most modern phones do)
   - **Desktop**: Use a high-quality USB-C cable
   - **All Platforms**: Close any other apps that might use ADB (SideQuest, Meta Quest Developer Hub, etc.)

### Connecting and Configuring

1. **Connect Your Quest**
   - Connect your Quest 2/3 to your device via USB-C cable
   - Open the web app in Chrome (or Edge)
   - Click "Connect Quest"
   - Select your Quest device from the browser popup

2. **First Connection Authentication**
   - Put on your Quest headset
   - You'll see an "Allow USB debugging?" dialog
   - **Important**: Check "Always allow from this computer"
   - Tap "OK" or "Allow"
   - The web app shows a reference image and countdown timer

3. **Apply Configuration**
   - Once connected, select a configuration profile
   - Review the commands that will be executed
   - Click "Apply Configuration"
   - Monitor the real-time progress indicator
   - Wait for completion confirmation

### Connection Status Indicators

The app provides clear visual feedback:
- **🔌 Connecting**: Establishing USB connection
- **📱 Authenticating**: Waiting for Quest permission (with countdown timer)
- **✅ Connected**: Ready to configure
- **⚠️ Error**: Issue detected with troubleshooting steps

### Platform-Specific Tips

**Android:**
- Use a USB-C to USB-C cable or adapter
- Enable "OTG" mode if your phone has this setting
- Keep screen on during configuration
- Grant USB permissions when Chrome prompts

**macOS:**
- Use the standard USB-C cable from your Quest
- Quit Meta Quest Developer Hub if running
- USB 3.0 ports (blue) work best

**Linux:**
- May require udev rules (see Troubleshooting section)
- Run `sudo usermod -aG plugdev $USER` and re-login
- Avoid USB hubs - connect directly

**Windows:**
- Close SideQuest and Meta Quest Developer Hub
- End any `adb.exe` processes in Task Manager
- Try different USB ports if issues occur

### Managing Configuration Profiles (Admin)

1. Click "Admin Panel" in the top navigation
2. **Create New Profile**:
   - Click "Create New Profile"
   - Enter a name and description
   - Add commands with descriptions and categories
   - Click "Save Profile"
3. **Edit Profile**: Click "Edit" on any existing profile
4. **Delete Profile**: Click "Delete" (with confirmation)
5. View execution statistics at the top of the admin panel

## Configuration Profiles

### Default Profile: Quest Performance Optimization

The tool includes a default configuration profile that optimizes Quest performance:

- **Refresh Rate**: 120Hz for smoothest experience
- **Performance**: Maximum CPU and GPU levels
- **Display**: Disabled foveation for clearest image
- **Privacy**: Disabled telemetry services
- **System**: Guardian pause enabled

### Creating Custom Profiles

You can create custom profiles through the Admin Panel with commands in these categories:

- **refresh_rate**: Display refresh rate settings
- **performance**: CPU/GPU performance levels
- **display**: Resolution and visual quality settings
- **privacy**: Telemetry and tracking controls
- **system**: System-level configurations

## ADB Commands Reference

### Common Quest Commands

**Refresh Rate**
```bash
setprop debug.oculus.refreshRate [72|80|90|120]
```

**Performance Levels**
```bash
setprop debug.oculus.cpuLevel [0-4]
setprop debug.oculus.gpuLevel [0-4]
```

**Resolution**
```bash
setprop debug.oculus.textureWidth [width]
setprop debug.oculus.textureHeight [height]
```

**Foveation**
```bash
setprop debug.oculus.foveation.level [0-4]
setprop debug.oculus.foveation.dynamic [0|1]
```

**Disable Telemetry**
```bash
pm disable com.oculus.unifiedtelemetry
pm disable com.oculus.gatekeeperservice
pm disable com.oculus.notification_proxy
```

**Guardian Control**
```bash
setprop debug.oculus.guardian_pause [0|1]
```

## API Documentation

### Public Endpoints

- `GET /api/profiles` - List all configuration profiles
- `GET /api/profiles/:id` - Get specific profile details
- `POST /api/logs` - Log execution results
- `GET /api/health` - Health check endpoint

### Admin Endpoints

- `POST /api/admin/profiles` - Create new profile
- `PUT /api/admin/profiles/:id` - Update existing profile
- `DELETE /api/admin/profiles/:id` - Delete profile
- `GET /api/admin/logs` - View execution logs
- `GET /api/admin/logs/profile/:id` - View logs for specific profile
- `GET /api/admin/stats` - Get execution statistics

## Troubleshooting

The app provides contextual error messages with troubleshooting steps. Below are additional details for common issues.

### Browser Compatibility

**"WebUSB is not supported"**
- ✅ **Solution**: Use Chrome, Edge, Brave, or Opera (Chromium-based browsers)
- ❌ **Not supported**: Safari, Firefox (they don't support WebUSB)
- **Android**: Ensure Chrome is updated to v112 or later
- **Desktop**: Use the latest version of your Chromium browser

### Device Detection

**"Incompatible Device Selected" (with device name shown)**
- **Cause**: You selected a device that isn't Quest 2 or Quest 3
- **Solution**: 
  - Disconnect other Android devices (phones, tablets, Quest Pro, Quest 1)
  - Connect only your Quest 2 or Quest 3
  - Retry connection
- **Supported**: "Quest 2", "Quest 3", "Quest 3S"

**"No device selected" or Connection Cancelled**
1. Click "Connect Quest" again
2. When browser shows device picker, select your Quest
3. Click "Connect" in the browser popup
4. Ensure Quest is connected via USB and powered on

**"Device Not Found"**
1. Check USB cable is firmly connected
2. Try a different USB cable (some are charge-only)
3. Try a different USB port
4. Ensure Quest is powered on and unlocked
5. Enable USB debugging in Quest Settings > System > Developer
6. Avoid USB hubs - connect directly

### Authentication & Permission

**"Access Denied" or "Authentication Failed"**
1. Put on your Quest headset
2. Look for "Allow USB debugging?" dialog
3. Check "Always allow from this computer"
4. Tap "Allow" or "OK"
5. If dialog doesn't appear, restart your Quest
6. Ensure Developer Mode is enabled

**Authentication Timeout (3 minutes)**
- The app waits up to 3 minutes for you to accept the prompt
- Make sure to put on your headset and respond to the dialog
- Check that Quest isn't in sleep mode

### Device Busy

**"Device In Use" or "Another program is using your Quest"**
1. Click "Disconnect" and wait 2-3 seconds
2. Try refreshing the page (F5) to clear browser state
3. Close these programs if running:
   - SideQuest
   - Meta Quest Developer Hub
   - Any ADB command-line tools
4. **Windows**: Open Task Manager → End all `adb.exe` processes
5. Unplug Quest, wait 3 seconds, plug back in
6. As last resort, reboot your Quest headset

### Platform-Specific Issues

**Android**

*"Device not detected"*
- Verify phone supports USB OTG (check specifications)
- Try different USB cable (charge-only cables don't work)
- Enable "OTG" or "USB Host Mode" in phone settings
- Close the Meta Quest mobile app

*"Permission denied"*
- Grant USB permissions when Chrome prompts
- Check Developer Options are enabled on phone
- Restart phone if issues persist

**macOS**

*"Cannot claim interface"*
- Quit Meta Quest Developer Hub
- Close any terminal windows running ADB
- Check Activity Monitor for any `adb` processes

*"Connection lost"*
- Use official USB-C cable or high-quality alternative
- Avoid adapters if possible
- Try different USB-C ports

**Linux**

*"Access denied" or permission errors*
```bash
# Add your user to plugdev group
sudo usermod -aG plugdev $USER

# Install Android udev rules
sudo wget -O /etc/udev/rules.d/51-android.rules \
  https://raw.githubusercontent.com/M0Rf30/android-udev-rules/main/51-android.rules
sudo chmod a+r /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules

# Log out and back in for changes to take effect
```

**Windows**

*Build/compilation errors during setup*
- Use Node.js 20 LTS (download from https://nodejs.org/)
- Avoid Node.js 21, 22, 24+ which have compilation issues
- Alternatively, use Docker deployment to avoid local compilation
- Ensure Windows Build Tools are installed (npm install --global windows-build-tools)

### During Configuration

**"Connection lost" while executing commands**
- Check USB cable is firmly connected
- Use a higher quality USB cable
- Avoid moving the cable during execution
- Connect directly to computer (not through hub)

**Commands fail or have no effect**
- Verify Quest is still connected (check status)
- Some commands require specific firmware versions
- Check Admin Panel execution logs for error details
- Reboot Quest if settings seem stuck

### Getting More Help

1. Check the **Error Help** cards in the app - they provide specific troubleshooting steps
2. Click "Technical Details" in error messages for more information
3. Review the [PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md) for platform-specific guidance
4. Open browser console (F12) for detailed error logs
5. Check the Admin Panel for execution history and error patterns

## Security Considerations

### Current Implementation
- **No Authentication**: Public access by default (as specified in requirements)
- **Command Validation**: Backend validates command structure
- **Rate Limiting**: API calls are rate-limited to prevent abuse
- **HTTPS Required**: WebUSB only works over HTTPS in production

### Adding Authentication (Future)
The architecture supports adding authentication:
1. Add authentication middleware to Express routes
2. Implement JWT token system
3. Add login UI to frontend
4. Update CORS configuration

## Development

### Project Structure
```
questnav-browser-config-tool/
├── frontend/              # React + Vite frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── AdminPanel.tsx
│   │   │   ├── AuthenticationStatus.tsx  # USB debugging auth display
│   │   │   ├── ConfigurationPanel.tsx
│   │   │   ├── ConnectionStatus.tsx
│   │   │   ├── ErrorHelp.tsx             # Contextual error help
│   │   │   └── ProgressDisplay.tsx
│   │   ├── services/      # API and ADB services
│   │   │   ├── adbService.ts             # WebUSB/ADB integration
│   │   │   └── apiService.ts             # Backend API client
│   │   ├── assets/        # Static assets
│   │   │   └── quest-usb-debug-dialog.png  # Reference image
│   │   ├── types.ts       # TypeScript type definitions
│   │   └── index.css      # Global styles with responsive design
│   └── dist/              # Build output (generated)
├── backend/               # Node.js + Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   │   ├── admin.ts   # Admin endpoints
│   │   │   ├── profiles.ts  # Profile endpoints
│   │   │   └── logs.ts    # Logging endpoints
│   │   ├── services/      # Business logic
│   │   │   └── database.ts  # SQLite operations
│   │   ├── models/        # Type definitions
│   │   │   └── types.ts
│   │   └── server.ts      # Express app setup
│   └── data/              # SQLite database storage
│       └── questnav.db    # Application database
├── docker/                # Docker configuration
│   └── nginx.conf         # Nginx reverse proxy config
├── docker-compose.yml     # Container orchestration
├── Dockerfile             # Multi-stage Docker build
├── setup.bat              # Windows setup script
├── setup.sh               # Unix setup script
├── start-dev.ps1          # Windows dev server launcher
└── start-dev.sh           # Unix dev server launcher
```

### Key Files

- **`frontend/src/services/adbService.ts`**: WebUSB/ADB integration with error handling
- **`frontend/src/components/ErrorHelp.tsx`**: Structured error messages with troubleshooting
- **`frontend/src/components/AuthenticationStatus.tsx`**: Beautiful authentication progress display
- **`backend/src/services/database.ts`**: SQLite database operations and schema
- **`.gitignore`**: Excludes `node_modules/`, `dist/`, `*.db`, and build artifacts

### Building for Production

**Backend**
```bash
cd backend
npm run build
npm start
```

**Frontend**
```bash
cd frontend
npm run build
# Output in frontend/dist/
```

### Type Checking
```bash
# Backend
cd backend
npm run typecheck

# Frontend  
cd frontend
npm run typecheck
```

### Code Quality

The codebase follows these principles:
- **TypeScript Strict Mode**: Full type safety across frontend and backend
- **No Dead Code**: Regular cleanup of unused imports, functions, and files
- **Separation of Concerns**: Clear boundaries between UI, business logic, and data
- **Error Handling**: Structured error messages with user-friendly troubleshooting
- **Responsive Design**: Mobile-first CSS with breakpoints for all screen sizes
- **Accessibility**: Proper ARIA labels, alt text, and keyboard navigation

### Recent Improvements

- ✅ **Structured Error Handling**: All errors use consistent format with icons, descriptions, and troubleshooting steps
- ✅ **Authentication Status Display**: Visual countdown timer and reference image during Quest authentication
- ✅ **Device Validation**: Automatic detection of Quest 2/3 with friendly warnings for incompatible devices
- ✅ **Responsive Images**: USB debugging dialog image scales automatically across devices
- ✅ **Clean Architecture**: Removed dead code, consolidated dependencies, optimized build output
- ✅ **Improved UX**: Cancel connection feature, better loading states, clearer progress indicators

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Follow the existing code style**:
   - Use TypeScript strict mode
   - Add proper type definitions
   - Include error handling
   - Write clear, descriptive commit messages
4. **Test thoroughly**:
   - Test on multiple platforms if possible
   - Verify error scenarios
   - Check responsive design
5. **Update documentation** if needed
6. **Submit a pull request**

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Documentation

- **[README.md](README.md)** - This file: Overview and setup
- **[QUICKSTART.md](QUICKSTART.md)** - Quick reference for getting started
- **[PLATFORM_SUPPORT.md](PLATFORM_SUPPORT.md)** - Detailed platform compatibility information
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide with HTTPS setup
- **[SECURITY.md](SECURITY.md)** - Security considerations and best practices
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines
- **[frontend/src/assets/IMAGE_GUIDE.md](frontend/src/assets/IMAGE_GUIDE.md)** - Guide for adding USB debugging dialog image

## References

- [Web-ADB-Menu](https://github.com/twhlynch/Web-ADB-Menu) - Original inspiration
- [@yume-chan/adb](https://github.com/yume-chan/ya-webadb) - Modern WebADB implementation
- [WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) - Browser USB access
- [Meta Quest Developer Center](https://developer.oculus.com/) - Quest developer resources

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## Disclaimer

This tool modifies system properties on your Meta Quest device. While the default configurations are safe and commonly used, use at your own risk. Always ensure you understand what commands are being executed before applying a configuration.

