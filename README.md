# Auto Auction Website

A full-stack used car auction platform built with React, Node.js, Express, and MySQL.

## Features

- 🚗 Car Listings with Brand Filtering
- 🔍 Search Functionality
- 💰 Loan Calculator
- 🔨 Auction/Bidding System
- 👤 User Authentication (Login/Signup)
- 📊 Bid Tracking
- 📱 Responsive Design

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: MySQL + Sequelize ORM
- **Authentication**: JWT

## Getting Started

### Prerequisites

- Node.js (v16+)
- MySQL (v8+)

### Installation

1. **Clone the repository**

2. **Setup Database**
   - Create a MySQL database named `auto_auction`
   - Update `.env` with your MySQL credentials

3. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start Backend** (from /backend directory)
   ```bash
   npm run dev
   ```
   Server will run on http://localhost:5000

2. **Start Frontend** (from /frontend directory)
   ```bash
   npm run dev
   ```
   App will run on http://localhost:3000

### Environment Variables

Backend `.env` file:
```
PORT=5000
JWT_SECRET=your_secret_key_here
ALLOW_PUBLIC_REGISTER=true
AUCTION_ENABLED=false
DEFAULT_SELLER_EMAIL=admin@sgautotrading.local
DEFAULT_SELLER_PASSWORD=Admin@123456
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/      # Database configuration
│   │   ├── models/      # Sequelize models (User, Car, Bid)
│   │   ├── routes/     # API routes (auth, cars, bids, loan)
│   │   ├── middleware/   # Auth middleware
│   │   └── index.js     # Entry point
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/   # Reusable components (Header, Footer, CarCard)
    │   ├── pages/        # Page components
    │   ├── context/      # React context
    │   └── App.jsx       # Main app component
    └── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register public buyer user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Reset password by email

### Cars
- `GET /api/cars` - List all cars (with filters)
- `GET /api/cars/brands` - Get unique brands
- `GET /api/cars/:id` - Get car details
- `POST /api/cars` - Create car (seller role required)
- `PUT /api/cars/:id` - Update car (seller role required)
- `DELETE /api/cars/:id` - Delete car (seller role required)

### Bids
- `POST /api/bids` - Place a bid (requires auth)
- `GET /api/bids/car/:carId` - Get bids for a car
- `GET /api/bids/me` - Get current user's bid tracking (requires auth)

### Loan Calculator
- `POST /api/loan/calculate` - Calculate monthly payment

### Agent
- `GET /api/agent` - Get agent list

### Settings
- `GET /api/settings/public` - Get public feature flags
- `GET /api/settings` - Get admin settings (seller auth required)
- `PUT /api/settings/auction-enabled` - Enable/disable auction globally (seller auth required)

### Admin (Seller Only)
- `GET /api/admin/users` - List registered users with search/filter/sort/paging
- `PUT /api/admin/users/:id/role` - Update user role (`buyer`/`seller`)
- `DELETE /api/admin/users/:id` - Delete a user account

`GET /api/cars` behavior:
- Default (`entry=sale` or omitted): direct-sale vehicles only (no auction cars).
- Auction entry (`entry=auction`): auction vehicles only, when `AUCTION_ENABLED=true`.
- Admin listing can use `includeAuction=1` to manage all statuses.

## Seller/Admin API Usage

To manage vehicles, login as a `seller` user:

1. Public frontend users can register buyer accounts.
2. A default seller will be auto-created if none exists.
3. Login seller and get JWT token:
   - `POST /api/auth/login`
4. Use `Authorization: Bearer <token>` on:
   - `POST /api/cars`
   - `PUT /api/cars/:id`
   - `DELETE /api/cars/:id`
   - `GET /api/settings`
   - `PUT /api/settings/auction-enabled`

`GET /api/cars` supports:
- `search` (brand/model keyword)
- `status` (`available|auction|sold`)
- `limit`, `offset`
- `sortBy` (`createdAt|price|year|mileage|brand`)
- `sortOrder` (`ASC|DESC`)

## Pages

1. `/` - Home page
2. `/cars` - Car listing with filters
3. `/auction` - Auction entry listing (only when auction enabled)
4. `/cars/:id` - Car detail page
5. `/login` - User login
6. `/signup` - Public user registration
7. `/forgot-password` - Reset forgotten password
8. `/loan-calculator` - Loan calculator
9. `/tracking` - User's bid tracking
10. `/admin/cars` - Seller vehicle library/management
11. `/admin/users` - Seller registered user management

## License

MIT
