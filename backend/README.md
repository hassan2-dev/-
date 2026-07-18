# Tofaha Backend

NestJS + Prisma + PostgreSQL API for the Tofaha grocery app.

## Stack

- NestJS 11
- Prisma + PostgreSQL
- JWT (access + refresh)
- OTP auth (SMS provider interface)
- Cloudflare R2 uploads (presigned)
- Swagger, validation, rate limiting, pino logging
- Docker / Coolify ready

## Quick start

```bash
cd backend
cp .env.example .env   # or use existing .env
npm install
npx prisma migrate dev --name init
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/api/v1/health`

## Auth (OTP)

1. `POST /api/v1/auth/otp/request` `{ "phone": "07801234567" }`
2. `POST /api/v1/auth/otp/verify` `{ "phone": "07801234567", "code": "123456" }`
3. Use `Authorization: Bearer <accessToken>`

With `OTP_DEV_MODE=true`, the code is logged and returned as `devCode`.

## Admin

Set `ADMIN_PHONES=0780...,0781...` — those numbers get `ADMIN` role on first OTP login.

## R2 uploads

Admin only: `POST /api/v1/uploads/presign` → put file to `uploadUrl` → store `publicUrl` on product/category.

## Coolify

1. New resource → Dockerfile
2. Set root directory to `backend` (or deploy this repo alone)
3. Add env vars from `.env.example`
4. Port `3000`
5. Health check path: `/api/v1/health`

## Firestore → Postgres (+ Bunny → R2)

One-time script (idempotent via `legacyId`):

```bash
cd backend
npm run migrate:firestore:dry      # preview counts / image list
npm run migrate:firestore          # data + images
npm run migrate:firestore:data     # data only
npm run migrate:firestore:images   # images only (DB must already have data)
```

Image rule: download OK → upload R2 → update URL; on any failure keep the old Bunny URL.
