# QuestNav Configuration Tool - Deployment Guide

This guide covers deploying the QuestNav Configuration Tool in production environments.

## Prerequisites

- Docker and Docker Compose installed
- Domain name (for HTTPS)
- SSL certificate (for WebUSB to work)

## Deployment Options

### Option 1: Docker Compose (Recommended)

This is the simplest deployment method.

1. **Clone the repository**
```bash
git clone <repository-url>
cd questnav-browser-config-tool
```

2. **Build and start**
```bash
docker-compose up -d
```

3. **Access the application**
```
http://your-server-ip:3000
```

### Option 2: Docker Compose with HTTPS

WebUSB requires HTTPS in production. This setup uses nginx as a reverse proxy.

1. **Prepare SSL certificates**
Place your SSL certificate files in `docker/certs/`:
- `cert.pem` - SSL certificate
- `key.pem` - Private key

2. **Update docker-compose.yml**
Uncomment the nginx service section.

3. **Update nginx.conf**
- Set your domain name in `server_name`
- Uncomment the HTTPS server block
- Update certificate paths if needed

4. **Start the services**
```bash
docker-compose up -d
```

5. **Access the application**
```
https://your-domain.com
```

### Option 3: Behind a Reverse Proxy

If you already have nginx or another reverse proxy:

1. **Start only the app**
```bash
docker-compose up -d questnav-app
```

2. **Configure your reverse proxy**
Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

Create a `.env` file or set environment variables in docker-compose.yml:

```bash
# Server configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_PATH=/app/data/questnav.db

# CORS (set to your domain)
CORS_ORIGIN=https://your-domain.com

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

1. **Install Certbot**
```bash
sudo apt-get update
sudo apt-get install certbot
```

2. **Obtain certificate**
```bash
sudo certbot certonly --standalone -d your-domain.com
```

3. **Copy certificates to docker/certs/**
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/certs/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/certs/key.pem
sudo chmod 644 docker/certs/*
```

4. **Setup auto-renewal**
```bash
sudo crontab -e
# Add this line:
0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/docker/certs/cert.pem && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/docker/certs/key.pem && docker-compose restart nginx
```

## Database Backup

The SQLite database is stored in a Docker volume. To backup:

```bash
# Create backup directory
mkdir -p backups

# Backup database
docker exec questnav-browser-config cat /app/data/questnav.db > backups/questnav-$(date +%Y%m%d).db
```

To restore:
```bash
docker cp backups/questnav-YYYYMMDD.db questnav-browser-config:/app/data/questnav.db
docker-compose restart
```

## Monitoring

### Health Checks

The application includes a health check endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-23T..."}
```

### Viewing Logs

```bash
# All logs
docker-compose logs -f

# Application logs only
docker-compose logs -f questnav-app

# Last 100 lines
docker-compose logs --tail=100 questnav-app
```

### Resource Monitoring

```bash
# Container stats
docker stats questnav-browser-config

# Disk usage
docker system df
```

## Updating

1. **Pull latest changes**
```bash
git pull origin main
```

2. **Rebuild and restart**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

3. **Verify**
```bash
docker-compose ps
curl http://localhost:3000/api/health
```

## Security Best Practices

1. **Use HTTPS**: Always use SSL/TLS in production
2. **Firewall**: Only expose necessary ports (80, 443)
3. **Updates**: Keep Docker and dependencies updated
4. **Backups**: Regular database backups
5. **Rate Limiting**: Adjust limits based on your needs
6. **Monitoring**: Setup alerts for downtime or errors

## Troubleshooting

### Container won't start
```bash
docker-compose logs questnav-app
```

### Database issues
```bash
# Check database file
docker exec questnav-browser-config ls -la /app/data/

# Reset database (CAUTION: deletes all data)
docker-compose down -v
docker-compose up -d
```

### SSL certificate errors
- Ensure certificate files are readable
- Check certificate expiration
- Verify certificate matches domain
- Check nginx logs: `docker-compose logs nginx`

### WebUSB not working
- Ensure you're using HTTPS
- Verify certificate is valid (not self-signed in production)
- Check browser console for errors
- Test with `chrome://device-log/`

## Performance Tuning

### For High Traffic

1. **Increase rate limits** in `.env`:
```bash
RATE_LIMIT_MAX_REQUESTS=500
```

2. **Add more workers** (modify Dockerfile):
```dockerfile
CMD ["node", "--max-old-space-size=4096", "dist/server.js"]
```

3. **Use Docker Swarm or Kubernetes** for horizontal scaling

## Support

For deployment issues:
1. Check logs: `docker-compose logs`
2. Verify health: `curl http://localhost:3000/api/health`
3. Review this guide
4. Open an issue on GitHub with logs and configuration

