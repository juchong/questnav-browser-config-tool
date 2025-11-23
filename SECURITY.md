# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **DO NOT** open a public issue
2. Email the maintainers directly (if email is available) or create a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Security Considerations

### Current Implementation

This tool currently has **no authentication** by design (as per requirements). This means:

- Anyone with access to the URL can use the tool
- Admin functions are publicly accessible
- No user tracking or access control

### For Production Use

We recommend implementing:

1. **Authentication**
   - User login system
   - JWT tokens
   - Role-based access control

2. **HTTPS**
   - Required for WebUSB to work
   - Protects data in transit
   - Use valid SSL certificates (not self-signed)

3. **Network Security**
   - Use firewall rules
   - Restrict access by IP if possible
   - Use VPN for internal tools

4. **Input Validation**
   - Backend validates all inputs
   - SQL injection protection via prepared statements
   - XSS protection via React's default escaping

5. **Rate Limiting**
   - Implemented on API routes
   - Adjust limits in .env file
   - Consider implementing per-IP limits

### Known Security Limitations

1. **No Authentication**: Anyone can access the tool and admin functions
2. **ADB Command Execution**: Tool can execute any ADB command defined in profiles
3. **Public Admin**: No protection on profile creation/editing/deletion

### Best Practices for Users

1. Only use the tool on trusted networks
2. Keep your Quest connected only when actively configuring
3. Review commands before applying configurations
4. Use HTTPS in production environments
5. Regular backups of the database

## Secure Deployment Checklist

- [ ] HTTPS enabled with valid certificate
- [ ] Firewall configured
- [ ] Environment variables set properly
- [ ] Database backups configured
- [ ] Logs monitored regularly
- [ ] Docker images kept updated
- [ ] Rate limiting configured appropriately

## Third-Party Dependencies

We use several third-party packages. Security updates are applied regularly:

- Express.js - Web framework
- better-sqlite3 - Database
- @yume-chan/adb - WebADB implementation
- React - Frontend framework

Run `npm audit` in both frontend and backend directories to check for vulnerabilities.

## Disclosure Policy

When we receive a security report:

1. Confirm the issue within 48 hours
2. Work on a fix
3. Release a patch
4. Notify users of the vulnerability and fix
5. Credit the reporter (if they wish)

Thank you for helping keep this project secure!

