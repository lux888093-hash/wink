# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

红酒扫码小程序 (Hongjiu Estate Wine QR-code Mini Program) — a WeChat mini program for a winery that delivers exclusive per-bottle content via QR codes, plus a public storefront and membership system. The server is Express + native WeChat mini program frontend.

## Commands

### Server
```bash
cd server && npm install     # install deps
cd server && npm run dev     # start with --watch (auto-restart on changes)
cd server && npm start       # start without watch
```
Server runs on `http://127.0.0.1:3100` (configurable via `PORT` env var).

### Mini Program
Open `miniprogram/` directory in WeChat DevTools. Disable "request合法域名校验" for local development. Entry page: `pages/home/index`.

### Audio assets
Audio files are served from two directories (first match wins):
- `miniprogram/assets/audio/` — bundled with mini program
- `music/` — local library outside mini program

## Architecture

### Two-part system
1. **`server/`** — Express backend serving REST API (`/api/*`), admin SPA (`/admin/`), and static audio files
2. **`miniprogram/`** — WeChat native mini program frontend (no build step, no framework)

### Server services layer (`server/services/`)
All business logic lives in service modules under `server/services/`:
- **`store.js`** (~2700 lines) — the core domain layer: all CRUD operations, order flow, membership, QR code consumption, admin operations. Functions are imported directly into `index.js` route handlers.
- **`db.js`** — data persistence abstraction. Uses `pg-mem` (in-memory PostgreSQL) by default. Falls back to real PostgreSQL via `db-postgres-worker.js` when `DATABASE_URL` or PG* env vars are set. Runtime data snapshots to `server/data/db-snapshot.json`.
- **`demo-data.js`** — seed data factory (`createSeedStore()`) with demo wines, tracks, products, users, and admin account
- **`config.js`** — all runtime configuration parsed from env vars with sensible defaults
- **`security.js`** — scrypt password hashing (with legacy SHA-256 auto-upgrade), HMAC session tokens, request IDs
- **`miniapp-auth.js`** — WeChat `code2Session` login + HMAC-signed Bearer tokens for mini program users. Falls back to demo user when WeChat credentials absent.
- **`wechat-pay.js`** — WeChat Pay JSAPI integration (RSA signing, AEAD_AES_256_GCM decryption, callback verification). Falls back to mock payment when credentials absent.
- **`wechat.js`** — WeChat access token caching and mini program QR code generation

### Server routing (`server/index.js`)
~980-line monolithic route file. All routes are defined inline with Express handlers. Key route groups:
- `/api/redeem/*` — QR code scan & consume flow
- `/api/store/*` — public storefront (home, products, cart, orders)
- `/api/payments/*` — order payment, WeChat Pay callbacks
- `/api/auth/*` — mini program user login/session
- `/api/member/*` — membership, track unlock, download signing
- `/api/admin/*` — admin dashboard (protected by `x-admin-token` header)
- Rate limiting middleware defined inline (login rate limit, general write rate limit)

### Database schema (`server/db/schema.sql`)
Generic key-value-ish tables with `id text primary key`, `label`, `status`, `ref1`/`ref2`, `sort_order`, `time1`/`time2`, and `payload jsonb`. Tables: `app_state`, `wineries`, `wines`, `tracks`, `download_assets`, `codes`, `products`, `skus`, `orders`, `order_items`, `users`, `admin_sessions`, `memberships`, `download_logs`, `audit_logs`.

### Mini program structure
- **`app.js`** — App entry: bootstraps user session (auto WeChat login with demo fallback), manages global state (userId, token, authMode, experience, cart)
- **`utils/api.js`** — HTTP request wrapper that auto-attaches Bearer token or demo-user header
- **`utils/session.js`** — QR code consumption helper
- **`utils/format.js`** — seconds-to-mm:ss formatter
- **`components/`** — reusable tab bar components (`boutique-tabbar`, `editorial-tabbar`)
- **`pages/`** — each page is a directory with `.js`/`.wxml`/`.wxss`/`.json` files

### Graceful degradation
The system runs in demo mode without any external services:
- No PostgreSQL → `pg-mem` in-memory store with JSON snapshot persistence
- No WeChat AppID/Secret → demo user with `x-demo-user-id` header
- No WeChat Pay certificates → mock payment (auto-success)
- No object storage → local file serving for audio downloads

### Admin panel (`server/public/admin/`)
Vanilla JS SPA served at `/admin/`. Authenticates via `x-admin-token` header. Default credentials: `curator` / `Curator!2026`.

## Key patterns

- **Admin auth**: `x-admin-token` header, validated against HMAC-hashed session tokens stored in DB
- **Mini program auth**: `Authorization: Bearer <token>` header, HMAC-signed JWT-like tokens issued on WeChat login
- **Data flow**: `store.js` functions → `db.js` (load/save store) → `pg-mem` or real PostgreSQL
- **Idempotency**: Order creation and payment pre-order use idempotency keys to prevent duplicates
- **Audio resolution**: Request handler in `index.js` checks `miniprogram/assets/audio/` then `music/` directory
