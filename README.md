# Quest Navigation Browser Configuration Tool

A modern web-based tool for automatically configuring Meta Quest headsets using predefined ADB commands. Built with React, TypeScript, Node.js, and WebUSB technology.

## Features

- **One-Click Configuration**: Apply complete Quest configurations with a single button click
- **WebUSB Integration**: Direct browser-to-device communication using modern WebADB technology
- **Admin Interface**: Web-based UI for managing configuration profiles
- **Real-time Progress**: Visual feedback during command execution
- **Execution Logging**: Track configuration history and success rates
- **Docker Ready**: Easy deployment with Docker Compose

## Technology Stack

- **Frontend**: React 18 + Vite + TypeScript
- **WebADB**: @yume-chan/adb packages (modern, actively maintained)
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (no external dependencies)
- **Deployment**: Docker + Docker Compose

## Prerequisites

### For Users
- A Chromium-based browser (Chrome, Edge, Brave, Opera)
- Meta Quest headset with Developer Mode enabled
- USB cable to connect Quest to computer

### For Developers
- Node.js 20 LTS (recommended) - **Node.js 24+ may have native module compilation issues**
- npm or yarn
- (Optional) Docker and Docker Compose for containerized deployment

## Quick Start

### Development Mode

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

4. **Create environment file**
```bash
cp .env.example .env
# Edit .env if needed (defaults are fine for development)
```

5. **Start the backend server** (Terminal 1)
```bash
cd backend
npm run dev
```

6. **Start the frontend development server** (Terminal 2)
```bash
cd frontend
npm run dev
```

7. **Open your browser**
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

### Enabling Developer Mode on Quest

1. Create a developer account at [Meta Quest Developer Center](https://developer.oculus.com/)
2. Install the Meta Quest mobile app on your phone
3. Open the app and navigate to Menu → Devices → Your Quest
4. Select "Developer Mode" and toggle it on
5. Restart your Quest headset

### Connecting Your Quest

1. Connect your Quest to your computer via USB cable
2. Put on your headset - you should see a prompt asking to "Allow USB debugging"
3. Check "Always allow from this computer" and tap OK
4. In the web interface, click "Connect Quest"
5. Select your Quest device from the browser prompt

### Applying a Configuration

1. Ensure your Quest is connected (green status indicator)
2. Select a configuration profile from the dropdown
3. Review the commands that will be executed
4. Click "Apply Configuration"
5. Wait for the progress bar to complete

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

### "WebUSB is not supported"
- Use a Chromium-based browser (Chrome, Edge, Brave, Opera)
- Safari and Firefox do not support WebUSB

### "No device selected" or Connection Failed
1. Ensure Developer Mode is enabled on your Quest
2. Check that your Quest is connected via USB
3. Look for the "Allow USB debugging" prompt on your Quest headset
4. Try unplugging and reconnecting the USB cable
5. Try a different USB port or cable
6. Restart your Quest headset
7. Close other ADB programs (SideQuest, etc.)

### Commands Not Working
- Verify your Quest is still connected (check status indicator)
- Some commands require specific Quest models or firmware versions
- Check the execution logs in the Admin Panel for error details

### "Connection lost" During Execution
- Ensure USB cable is firmly connected
- Try a higher quality USB cable
- Avoid using USB hubs - connect directly to computer

### Node.js Installation Issues (Windows)
If `better-sqlite3` fails to compile:
1. **Use Node.js 20 LTS** (not 21, 22, 24+) - Download from https://nodejs.org/
2. Install "Desktop development with C++" workload in Visual Studio 2022
3. Or use the Docker deployment method which avoids local compilation

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
├── frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── services/   # API and ADB services
│   │   └── types.ts    # TypeScript types
├── backend/            # Node.js + Express backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── services/   # Database service
│   │   └── models/     # Type definitions
├── docker/             # Docker configuration
└── docker-compose.yml  # Container orchestration
```

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

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

