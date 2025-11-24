# QuestNav Browser Configuration Tool

A web-based tool for configuring Meta Quest 2/3 headsets via WebUSB. Apply ADB commands, install APKs, and manage device settings directly from your browser.

## Features

- **One-Click Configuration** - Apply complete device configurations instantly
- **APK Installation** - Install applications directly via browser
- **WebUSB/ADB** - Direct browser-to-device communication (no cables or desktop ADB needed)
- **Command Preview** - Expandable table view of all commands before execution
- **Dark/Light Theme** - System-aware theme toggle with persistent preferences
- **Admin Panel** - Manage profiles, view execution logs, control command visibility
- **Cross-Platform** - Works on Windows, macOS, Linux, and Android (Chrome/Edge)
- **Secure** - JWT authentication, rate limiting, bcrypt password hashing, IP-based CSP

## Quick Start

### Development

1. **Configure Admin Credentials**
   ```bash
   # Create backend/.env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
   ```

2. **Start Dev Servers**
   ```bash
   # Automated (Windows)
   .\scripts\start-dev.ps1
   
   # Automated (Linux/Mac)
   ./scripts/start-dev.sh
   
   # Manual
   cd backend && npm install && npm run dev  # Terminal 1
   cd frontend && npm install && npm run dev  # Terminal 2
   ```

3. **Open Browser**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

### Production (Docker)

1. **Set Environment Variables**
   ```bash
   # Create .env file
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   JWT_SECRET=your-random-secret
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **Deploy**
   ```bash
   docker-compose up -d
   ```

3. **Access**
   - App: http://localhost:3000
   - For HTTPS, uncomment nginx service in docker-compose.yml

## Project Structure

```
questnav-browser-config-tool/
├── backend/
│   ├── data/
│   │   ├── apks/           # Cached APK files
│   │   └── questnav.db     # SQLite database
│   ├── src/
│   │   ├── middleware/     # Auth middleware
│   │   ├── models/         # TypeScript types
│   │   ├── routes/         # API endpoints (auth, profiles, logs, apks)
│   │   ├── services/       # Business logic (database, APK, command processing)
│   │   ├── utils/          # Utilities (tracking parser)
│   │   └── server.ts       # Express app
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components (Admin, Config, Connection, etc.)
│   │   ├── services/       # API clients (adb, api, auth, github)
│   │   ├── utils/          # Browser fingerprinting
│   │   ├── App.tsx         # Main app component
│   │   └── types.ts        # TypeScript types
│   └── package.json
├── docker/
│   └── nginx.conf          # HTTPS reverse proxy config
├── scripts/
│   ├── start-dev.ps1       # Windows dev server launcher
│   └── start-dev.sh        # Unix dev server launcher
├── docker-compose.yml
└── Dockerfile
```

## Key Features Explained

### Command Preview
- Expandable table view showing all commands before execution
- Displays command category, description, and actual command text
- Includes QuestNav APK installation if enabled
- Filters hidden commands from user view

### APK Installation
- Downloads APKs from URLs and caches them server-side
- Streams to device via WebUSB (no CORS issues)
- Installs to `/data/local/tmp/` (correct SELinux context)
- Supports large files (tested with 79MB APKs)

### Theme Support
- Light and dark mode toggle
- Follows system preferences by default
- Persistent user preference stored in localStorage
- Theme-aware logo and UI components

### Success Celebration
- Confetti animation on successful configuration
- 100 pieces falling from top of screen
- Automatically clears when complete

### Per-Command Visibility
- Hide individual commands from users while still executing them
- Show diagnostic/config commands only to admins
- User-facing command count in progress display

### Enhanced Logging
- Full command execution history with results
- Browser fingerprinting for analytics
- Device serial/name tracking
- Detailed timing and error information
- 1MB request limit for large diagnostic outputs

### Authentication
- JWT-based session management
- bcrypt password hashing
- Rate limiting (5 login attempts per 15 min)
- Separate public/admin endpoints

## API Endpoints

### Public
- `GET /api/profiles` - Get active profile
- `POST /api/logs` - Log execution results
- `GET /api/apks/:hash` - Download cached APK

### Admin (Requires Auth)
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/admin/profiles` - List all profiles
- `POST /api/admin/profiles` - Create profile
- `PUT /api/admin/profiles/:id` - Update profile
- `DELETE /api/admin/profiles/:id` - Delete profile
- `PUT /api/admin/profiles/:id/activate` - Set active profile
- `GET /api/admin/logs` - View execution logs
- `GET /api/admin/stats` - Get statistics
- `POST /api/apks/cache` - Download and cache APK

## Requirements

### Users
- Chrome/Edge browser (Chromium-based)
- Meta Quest 2 or Quest 3 with Developer Mode enabled
- USB-C cable

### Developers
- Node.js 20 LTS
- npm 8+
- (Optional) Docker + Docker Compose

### Production
- HTTPS required for WebUSB
- Domain with SSL certificate
- 1GB RAM minimum
- 5GB storage for APK caching

## Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
# Required
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password
JWT_SECRET=random-64-char-hex

# Optional
PORT=3000
DATABASE_PATH=./data/questnav.db
APK_STORAGE_DIR=./data/apks
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Local Development (HTTP Support)
ALLOW_HTTP_LOCAL=true
LOCAL_SUBNETS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

**Docker** (`.env` in project root):
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password
JWT_SECRET=random-secret
CORS_ORIGIN=https://yourdomain.com
```

See `env.example` for detailed configuration options.

## Troubleshooting

### "WebUSB not supported"
- Use Chrome, Edge, or another Chromium browser
- Firefox and Safari don't support WebUSB

### "Access Denied"
1. Put on Quest headset
2. Accept "Allow USB debugging?" dialog
3. Check "Always allow from this computer"

### "Device In Use"
- Close SideQuest, Meta Quest Developer Hub, and other ADB tools
- Kill any `adb.exe` processes

### "Request Entity Too Large"
- Increase limit in `server.ts` if needed
- Default is 1MB for execution logs

### APK Installation Fails
- Check file is uploaded to `/data/local/tmp/` (not `/sdcard/`)
- Verify SELinux permissions
- Use `cmd package install` instead of `pm install`

## Security

- **Authentication**: JWT tokens with httpOnly cookies
- **Passwords**: bcrypt hashing (10 rounds)
- **Rate Limiting**: 100 requests per 15 minutes
- **Command Validation**: Server-side whitelist
- **IP-Based CSP**: Conditional Content Security Policy based on client IP
  - External traffic: Strict HTTPS enforcement
  - Local subnets: Optional HTTP support for development
- **HTTPS Required**: WebUSB only works over HTTPS in production
- **CORS**: Configurable origin restriction
- **SQL Injection**: Parameterized queries

## Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run dev servers
npm run dev  # In both backend/ and frontend/

# Build for production
npm run build  # In both directories

# Type checking
npm run typecheck

# Docker build
docker-compose build
```

## Technologies

- **Frontend**: React 18, Vite, TypeScript, Tango ADB (@yume-chan/adb), react-confetti
- **Backend**: Node.js, Express, TypeScript, SQLite (better-sqlite3), ip-range-check
- **Auth**: JWT (jsonwebtoken), bcrypt
- **Deployment**: Docker, Nginx
- **Security**: Helmet, express-rate-limit, cookie-parser

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow existing code style (TypeScript strict mode)
4. Test thoroughly
5. Submit pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - See LICENSE file for details

## Support

- Review troubleshooting section above
- Check existing GitHub issues
- Open new issue with detailed error information

## Disclaimer

This tool modifies system properties on your Meta Quest device. Use at your own risk. Understand commands before execution.
