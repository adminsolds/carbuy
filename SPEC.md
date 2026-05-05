# Auto Auction Website - Project Specification

## 1. Project Overview

**Project Name**: Auto Auction Website
**Project Type**: Full-stack Web Application
**Core Functionality**: Used car listing platform with auction/bidding system, loan calculator, and user management
**Target Users**: Car buyers, sellers, and bidders in Malaysia/International market
**Reference Site**: https://jojieautogarage.com

---

## 2. Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + React Router v6
- **Backend**: Node.js + Express
- **Database**: SQLite via Sequelize ORM (portable, no MySQL installation required)
- **Authentication**: JWT (jsonwebtoken) with bcryptjs for password hashing
- **File Upload**: Multer (for future image upload support)

---

## 3. Features & Priorities

### P0 - Core Features
1. **Home Page** - Hero banner, brand showcase, latest deals, search panel
2. **Car Listing** - Grid view with brand filter, status filter, keyword search, pagination
3. **Car Detail Page** - Full specifications, image gallery, auction timer, loan calculator
4. **Auction System** - Place bids, bid history, highest bid, auction timer, status tracking
5. **Responsive Design** - Mobile-first, works on all devices

### P1 - Important Features
6. **User Login/Register** - JWT auth, profile management, password change
7. **Loan Calculator** - Real-time monthly payment calculation
8. **Tracking Page** - User's bid history with win/loss status
9. **Admin Cars Management** - Create, edit, soft-delete vehicles
10. **Admin Users Management** - View, toggle role, activate/deactivate users

### P2 - Nice to Have
11. **Agent Page** - Information about agents
12. **Password Reset** - Forgot password flow

---

## 4. UI/UX Design Direction

- **Visual Style**: Modern, professional, clean automotive aesthetic
- **Color Scheme**:
  - Primary: Deep Blue (#1E3A5F)
  - Secondary: Gold/Amber (#D4A84B)
  - Background: Light Gray (#F5F5F5)
  - Text: Dark Gray (#333333)
- **Layout**:
  - Header: Logo + Navigation (Home, Stock, Auction, Loan Calculator, Tracking, Agent, Login/Signup)
  - Footer: Links + Copyright
- **Typography**: Sans-serif fonts, clear hierarchy

---

## 5. Data Models

### User
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| email | STRING(255) | NOT NULL, UNIQUE |
| password | STRING(255) | NOT NULL |
| name | STRING(100) | NOT NULL |
| phone | STRING(30) | NULL |
| role | ENUM('buyer','seller') | DEFAULT 'buyer' |
| avatar_url | STRING(500) | NULL |
| email_verified | BOOLEAN | DEFAULT false |
| is_active | BOOLEAN | DEFAULT true |
| ic_passport | STRING(50) | NULL |
| gender | ENUM('Male','Female','Other') | NULL |
| company_name | STRING(200) | NULL |
| company_phone | STRING(30) | NULL |
| tin_number | STRING(50) | NULL |
| address_street | STRING(255) | NULL |
| address_zip | STRING(20) | NULL |
| address_city | STRING(100) | NULL |
| address_state | STRING(100) | NULL |
| address_country | STRING(100) | NULL |
| reset_token | STRING(100) | NULL |
| reset_token_expires | DATETIME | NULL |
| createdAt | DATETIME | AUTO |
| updatedAt | DATETIME | AUTO |

**Indexes**: email, role, is_active

### Car
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| brand | STRING(50) | NOT NULL |
| model | STRING(100) | NOT NULL |
| year | INTEGER | NOT NULL |
| mileage | INTEGER | NOT NULL |
| color | STRING(30) | NULL |
| price | DECIMAL(12,2) | NOT NULL |
| description | TEXT | NULL |
| images | JSON | DEFAULT [] |
| auction_end_time | DATETIME | NULL |
| starting_bid | DECIMAL(12,2) | NULL |
| status | ENUM('available','sold','auction') | DEFAULT 'available' |
| transmission | STRING(30) | NULL |
| fuel_type | STRING(20) | NULL |
| engine_cc | INTEGER | NULL |
| chassis_no | STRING(50) | NULL |
| registration_expiry | DATE | NULL |
| owners_count | INTEGER | NULL |
| road_tax_expire | DATE | NULL |
| repaired | ENUM('yes','no') | DEFAULT 'no' |
| seller_id | INTEGER | FK -> users.id, NULL |
| is_deleted | BOOLEAN | DEFAULT false |
| createdAt | DATETIME | AUTO |
| updatedAt | DATETIME | AUTO |

**Indexes**: brand, status, year, price, seller_id, is_deleted, auction_end_time

### Bid
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| car_id | INTEGER | NOT NULL, FK -> cars.id |
| user_id | INTEGER | NOT NULL, FK -> users.id |
| amount | DECIMAL(12,2) | NOT NULL |
| is_winning | BOOLEAN | DEFAULT false |
| status | ENUM('pending','outbid','won','lost') | DEFAULT 'pending' |
| createdAt | DATETIME | AUTO |
| updatedAt | DATETIME | AUTO |

**Indexes**: car_id, user_id, status, is_winning, (car_id, amount)

### AppSetting
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| key | STRING(100) | UNIQUE, NOT NULL |
| value | TEXT | NULL |
| updatedAt | DATETIME | AUTO |

### Agent
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| code | STRING(50) | UNIQUE, NOT NULL |
| name | STRING(200) | NOT NULL |
| email | STRING(255) | NULL |
| phone | STRING(50) | NULL |
| company | STRING(200) | NULL |
| address | TEXT | NULL |
| is_active | BOOLEAN | DEFAULT true |
| notes | TEXT | NULL |
| createdAt | DATETIME | AUTO |
| updatedAt | DATETIME | AUTO |

**Indexes**: code (unique), is_active

### Order
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO_INCREMENT |
| order_no | STRING(50) | UNIQUE, NOT NULL |
| user_id | INTEGER | FK -> users.id |
| car_id | INTEGER | FK -> cars.id |
| agent_id | INTEGER | FK -> agents.id, NULL |
| order_type | ENUM('purchase','auction_win') | DEFAULT 'purchase' |
| amount | DECIMAL(12,2) | NOT NULL |
| deposit_paid | DECIMAL(12,2) | DEFAULT 0 |
| status | ENUM('pending','deposit_paid','paid','processing','shipped','delivered','completed','cancelled','refunded') | DEFAULT 'pending' |
| buyer_name | STRING(200) | NULL |
| buyer_email | STRING(255) | NULL |
| buyer_phone | STRING(50) | NULL |
| delivery_address | TEXT | NULL |
| notes | TEXT | NULL |
| paid_at | DATETIME | NULL |
| delivered_at | DATETIME | NULL |
| createdAt | DATETIME | AUTO |
| updatedAt | DATETIME | AUTO |

**Indexes**: order_no (unique), user_id, car_id, status, order_type

**Order Status State Machine**:
```
pending → deposit_paid | cancelled
deposit_paid → paid | cancelled
paid → processing | cancelled
processing → shipped | cancelled
shipped → delivered | cancelled
delivered → completed
cancelled → refunded
completed → (terminal)
refunded → (terminal)
```

When order is created, car status changes to 'sold'.
When order is cancelled or refunded, car status reverts to 'available'.

---

## 6. API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /register | No | Register new user |
| POST | /login | No | Login user |
| POST | /forgot-password | No | Request password reset email (sends token link) |
| POST | /reset-password | No | Reset password with valid token |
| POST | /change-password | Yes | Change password while logged in |
| GET | /me | Yes | Get current user profile |
| PUT | /profile | Yes | Update user profile |

### Cars (`/api/cars`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | No | List cars (filters: brand, search, status, min/max_price, min/max_year, sort, pagination) |
| GET | /brands | No | Get distinct brand list |
| GET | /:id | No | Get single car with highest bid and count |
| POST | / | Yes (seller) | Create new car |
| PUT | /:id | Yes (seller) | Update car |
| DELETE | /:id | Yes (seller) | Soft-delete car |

### Bids (`/api/bids`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | / | Yes | Place a bid |
| GET | /car/:carId | No | Get bids for a specific car |
| GET | /me | Yes | Get current user's bid history with status |

### Loan (`/api/loan`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /calculate | No | Calculate monthly payment |

### Agent (`/api/agent`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | No | List/search agents (filters: search, is_active) |
| GET | /admin/list | Yes (seller) | Paginated admin list with filters |
| GET | /:id | Yes (seller) | Get single agent |
| POST | / | Yes (seller) | Create new agent |
| PUT | /:id | Yes (seller) | Update agent |
| DELETE | /:id | Yes (seller) | Delete agent |

### Orders (`/api/orders`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | / | Yes | Create order (frontend: buy a car) |
| GET | /me | Yes | Current user's orders |
| GET | /admin/list | Yes (seller) | Paginated admin list with filters |
| GET | /:id | Yes (seller) | Get single order |
| PUT | /:id/status | Yes (seller) | Update order status (state machine) |
| PUT | /:id | Yes (seller) | Update order details (agent, address, notes) |
| GET | /admin/stats | Yes (seller) | Order statistics by status + total revenue |

### Settings (`/api/settings`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | Yes (seller) | Get app settings (auction + SMTP config) |
| PUT | /auction-enabled | Yes (seller) | Toggle auction system |
| PUT | /smtp | Yes (seller) | Update SMTP email settings |
| POST | /smtp/test | Yes (seller) | Send test email to current user |

### Admin (`/api/admin`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /users | Yes (seller) | Paginated user list with filters |
| PUT | /users/:id/role | Yes (seller) | Update user role |
| PUT | /users/:id/active | Yes (seller) | Toggle user active status |
| DELETE | /users/:id | Yes (seller) | Delete user |
| GET | /stats | Yes (seller) | Dashboard statistics |

---

## 7. Pages

| Route | Component | Auth Required |
|-------|-----------|--------------|
| / | Home | No |
| /cars | CarListing | No |
| /auction | CarListing (auctionMode) | No |
| /cars/:id | CarDetail | No |
| /login | Login | No |
| /signup | Signup | No |
| /forgot-password | ForgotPassword | No |
| /reset-password | ResetPassword | No |
| /loan-calculator | LoanCalculator | No |
| /tracking | Tracking | Yes |
| /agent | Agent | No |
| /admin/cars | AdminCars | Yes (seller) |
| /admin/users | AdminUsers | Yes (seller) |

---

## 8. Project Structure

```
F:\汽车网站\
├── SPEC.md
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js       # Sequelize SQLite config
│   │   ├── models/
│   │   │   ├── index.js          # Model associations
│   │   │   ├── User.js
│   │   │   ├── Car.js
│   │   │   ├── Bid.js
│   │   │   ├── AppSetting.js
│   │   │   ├── Agent.js
│   │   │   └── Order.js
│   │   ├── routes/
│   │   │   ├── auth.js           # Auth: register, login, forgot-password, change-password, profile
│   │   │   ├── cars.js           # Cars CRUD, listing, filtering, search
│   │   │   ├── bids.js           # Place bid, car bids, user bid history
│   │   │   ├── loan.js           # Loan calculator
│   │   │   ├── agent.js          # Agent CRUD + frontend search
│   │   │   ├── settings.js       # App settings (auction toggle)
│   │   │   ├── admin.js          # Admin: user management, stats
│   │   │   └── orders.js         # Order management + state machine
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification middleware
│   │   │   └── authorize.js      # Role authorization middleware
│   │   ├── services/
│   │   │   └── settingsService.js # App settings helpers
│   │   └── index.js              # Express entry point + seed data
│   └── package.json
│
└── frontend/
    └── src/
        ├── App.jsx               # Route definitions
        ├── main.jsx             # React entry point
        ├── context/
        │   └── AuthContext.jsx   # Auth state management
        ├── lib/
        │   └── api.js            # Axios instance with interceptors
        ├── components/
        │   ├── Header.jsx
        │   ├── Footer.jsx
        │   ├── CarCard.jsx
        │   └── *.css
        └── pages/
            ├── Home.jsx
            ├── CarListing.jsx
            ├── CarDetail.jsx
            ├── Login.jsx
            ├── Signup.jsx
            ├── ForgotPassword.jsx
            ├── LoanCalculator.jsx
            ├── Tracking.jsx
            ├── Agent.jsx
            ├── AdminCars.jsx
            ├── AdminUsers.jsx
            └── *.css
```

---

## 9. Database Schema Summary

### Entity Relationships

```
User (seller) 1──M Car
User (buyer)  1──M Bid
Car           1──M Bid
Agent         1──M Order
User (buyer)  1──M Order
Car           1──M Order

User roles: buyer | seller
Car status: available | sold | auction
Bid status: pending | outbid | won | lost
Order status: pending → deposit_paid → paid → processing → shipped → delivered → completed
```

### Key Improvements from Original

1. **Car model** — Added: transmission, fuel_type, engine_cc, chassis_no, registration_expiry, owners_count, road_tax_expire, seller_id, is_deleted (soft delete), comprehensive indexes
2. **User model** — Added: avatar_url, email_verified, is_active; full profile fields: ic_passport, gender, company_name, company_phone, tin_number, address_street/city/state/country; improved index on email
3. **Bid model** — Added: is_winning flag, status field (pending/outbid/won/lost), composite index on (car_id, amount) for efficient top-bid queries
4. **Agent model** — Created: code (unique), name, email, phone, company, address, is_active, notes. Full CRUD via `/api/agent` routes. Public search via `/api/agent`.
5. **Order model** — Created: order_no (unique), order_type, amount, deposit_paid, status state machine (9 statuses), buyer info, delivery address, timestamps. Linked to User, Car, Agent.
6. **Cars route** — Extended filtering (price range, year range), proper pagination, computed highest_bid per car, soft delete, seller reference, auto-generated chassis number
7. **Auth route** — Password strength validation, email normalization, /me and /profile endpoints, /change-password endpoint, active account check; full profile fields accepted on register and profile update
8. **Admin route** — Active/inactive toggle, comprehensive dashboard stats endpoint, pagination improvements; admin user list includes all profile fields
9. **Bids route** — Auto-marks previous bids of same user for same car as "outbid" on new bid placement; proper status computation in /me endpoint
10. **Agent route** — Full Sequelize-based CRUD with public search endpoint for frontend, admin paginated list for management panel
11. **Orders route** — Order creation on car purchase (marks car as sold), state machine prevents invalid transitions, cancelled/refunded orders release car back to available, full order stats endpoint
12. **Admin SPA** — Complete redesign with sidebar navigation (Inventory, Auction, Agents, Orders, Users, Settings), tab-based sections, stat cards, toast notifications, full CRUD for all modules
13. **Frontend Tracking page** — Updated to show both orders (with progress indicator) and bids in tabbed interface

---

## 10. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 5000 | Server port |
| JWT_SECRET | dev_secret_change_me | JWT signing secret |
| JWT_EXPIRES_IN | 24h | JWT token expiry |
| ALLOW_PUBLIC_REGISTER | true | Enable/disable public registration |
| DEFAULT_SELLER_EMAIL | admin@sgautotrading.local | Default seller account email |
| DEFAULT_SELLER_PASSWORD | Admin@123456 | Default seller account password |