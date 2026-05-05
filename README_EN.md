# SG AUTO TRADING (Used Car Trading Platform)

A full-stack web application built with `React + Vite + Node.js + Express + Sequelize (SQLite)`, supporting direct sales, auctions, admin car management, user management, and password reset flows.

## 1. Feature Overview

- Public frontend: home, car listing, car details, loan calculator, agent, login/signup
- Auction mode: enabled only from auction entry and controlled by admin switch
- User system: signup/login, bid tracking, forgot/reset password
- Company admin panel:
  - Vehicle library & car management (CRUD, filter, pagination, status)
  - Registered user management (search, role update, delete)
  - System settings (auction switch, email-related settings)

## 2. Tech Stack

- Frontend: `React`, `Vite`, `TailwindCSS`
- Backend: `Node.js`, `Express`
- Database: `SQLite` (`backend/database.sqlite`)
- ORM: `Sequelize`
- Auth: `JWT`

## 3. Local Development

### 3.1 Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3.2 Backend Environment Variables (`backend/.env`)

```env
PORT=5000
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h
ALLOW_PUBLIC_REGISTER=true
AUCTION_ENABLED=false
DEFAULT_SELLER_EMAIL=admin@sgautotrading.local
DEFAULT_SELLER_PASSWORD=Admin@123456
```

### 3.3 Run Services

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:5000`

## 4. Routes

- Public routes:
  - `/`
  - `/cars`
  - `/cars/:id`
  - `/auction`
  - `/loan-calculator`
  - `/agent`
  - `/login`
  - `/signup`
  - `/forgot-password`
- Auth required:
  - `/tracking`
- Seller admin routes:
  - `/admin/cars`
  - `/admin/users`

## 5. Core Business Rules

- Default listing route (`/cars`) shows direct-sale vehicles only.
- Auction route (`/auction`) shows auction vehicles only when auction is enabled.
- When auction is disabled:
  - Home page shows: `No auction vehicles at the moment, stay tuned!`
  - Bid API rejects bid requests.

## 6. Main APIs

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### Cars

- `GET /api/cars`
- `GET /api/cars/brands`
- `GET /api/cars/:id`
- `POST /api/cars` (seller)
- `PUT /api/cars/:id` (seller)
- `DELETE /api/cars/:id` (seller)

Important `GET /api/cars` params:

- `entry=sale|auction`
- `includeAuction=1` (admin full inventory)
- `search`, `status`
- `limit`, `offset`
- `sortBy`, `sortOrder`

### Bids

- `POST /api/bids`
- `GET /api/bids/car/:carId`
- `GET /api/bids/me`

### Settings

- `GET /api/settings/public`
- `GET /api/settings` (seller)
- `PUT /api/settings/auction-enabled` (seller)

### Admin User Management (seller)

- `GET /api/admin/users`
- `PUT /api/admin/users/:id/role`
- `DELETE /api/admin/users/:id`

## 7. Email Service Notes

- Forgot password relies on SMTP configuration.
- Once SMTP is configured in admin settings, email verification/reset flow works.
- If SMTP is not configured, `forgot-password` may fail (feature logic is already implemented).

## 8. Production Deployment (Current)

- Server: `154.12.28.145`
- Access:
  - `http://154.12.28.145`
  - `https://154.12.28.145` (currently self-signed certificate)
- Process manager: `pm2` (process name: `sg-auto-backend`)
- Reverse proxy: `nginx`

## 9. Default Admin Account

- Email: `admin@sgautotrading.local`
- Password: `Admin@123456`

> Please change the default admin password immediately after first deployment.
