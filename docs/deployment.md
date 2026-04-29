# Deployment Guide

## Important

This starter stores data in `data/library-data.json`. For a demo deployment, use a host with persistent disk storage. For production, migrate the data model to PostgreSQL using `docs/database-schema.sql`.

## Environment Variables

```bash
NODE_ENV=production
PORT=4173
HOST=0.0.0.0
AUTH_SECRET=<generate-a-long-random-secret>
```

`AUTH_SECRET` must be changed before public deployment.

## Option 1: VPS Deployment

Use any Ubuntu VPS.

```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
HOST=0.0.0.0 PORT=4173 AUTH_SECRET="replace-this" npm start
```

For a real deployment, run it with a process manager such as PM2 and put Nginx in front with HTTPS.

## Option 2: Platform With Persistent Disk

Use a Node web service with:

- Build command: `npm install`
- Start command: `npm start`
- Environment: Node.js
- Persistent disk mounted to the project folder or `data/`

Set:

```bash
HOST=0.0.0.0
NODE_ENV=production
AUTH_SECRET=<long-random-secret>
```

## Not Recommended For This Starter

Pure serverless hosting is not a good fit for the current JSON-file database because serverless filesystems are usually temporary. Use PostgreSQL first if deploying to a serverless platform.

## Production Checklist

- Replace local JSON storage with PostgreSQL
- Store photos in S3 or Cloudinary
- Use HTTPS
- Use a strong `AUTH_SECRET`
- Change all demo passwords
- Add daily encrypted backups
- Connect SMS and WhatsApp provider credentials
- Add real PDF receipt generation on the server
- Add rate limiting and login attempt lockout
