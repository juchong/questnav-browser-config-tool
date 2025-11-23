# Quest Navigation Browser Configuration Tool

## Project Overview

This project is a web-based tool for automatically configuring Meta Quest headsets using ADB commands through the browser via WebUSB.

## Key Technologies

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript  
- **Database**: SQLite
- **WebADB**: @yume-chan/adb (modern TypeScript implementation)
- **Deployment**: Docker + Docker Compose

## Quick Reference

### Development
```bash
# Setup
./setup.sh  # or setup.bat on Windows

# Start backend
cd backend && npm run dev

# Start frontend  
cd frontend && npm run dev
```

### Production
```bash
docker-compose up -d
```

### Key Files
- `backend/src/server.ts` - Express server
- `backend/src/services/database.ts` - SQLite database layer
- `frontend/src/App.tsx` - Main React application
- `frontend/src/services/adbService.ts` - WebUSB/ADB integration
- `docker-compose.yml` - Production deployment

### Important URLs
- Development: http://localhost:5173 (frontend) + http://localhost:3000 (backend)
- Production: http://localhost:3000 (served from backend)
- API: /api/profiles, /api/admin, /api/logs
- Health: /api/health

## Architecture

### User Flow
1. User visits site → Frontend loads
2. User connects Quest → WebUSB permission → ADB connection established
3. User selects profile → Frontend fetches from backend API
4. User applies config → Frontend executes ADB commands via WebUSB
5. Results logged → Backend stores execution history

### Admin Flow
1. Admin opens admin panel
2. Creates/edits configuration profiles
3. Backend validates and stores in SQLite
4. Profiles immediately available to users

## Development Notes

- WebUSB only works in Chromium browsers (Chrome, Edge, Brave)
- WebUSB requires HTTPS in production (localhost is exempt)
- Default profile created automatically on first run
- Database persists in Docker volume for production
- No authentication by design (can be added later)

## Useful Commands

```bash
# Type checking
cd backend && npm run typecheck
cd frontend && npm run typecheck

# Build for production
cd backend && npm run build
cd frontend && npm run build

# Docker operations
docker-compose logs -f
docker-compose down -v  # Remove volumes
docker-compose build --no-cache

# Database backup
docker exec questnav-browser-config cat /app/data/questnav.db > backup.db
```

## See Also

- README.md - Full documentation
- DEPLOYMENT.md - Production deployment guide
- SECURITY.md - Security considerations
- CONTRIBUTING.md - How to contribute

