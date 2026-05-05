# SG AUTO TRADING（二手车交易平台）

基于 `React + Vite + Node.js + Express + Sequelize(SQLite)` 的前后端分离项目，支持直售、竞拍、后台车辆管理、用户管理、忘记密码等功能。

## 1. 功能概览

- 公共前台：主页、车辆列表、详情、贷款计算、Agent、登录/注册
- 竞拍模式：仅从竞拍入口进入时启用，且受后台开关控制
- 用户体系：注册、登录、个人竞拍跟踪、忘记密码/重置密码
- 公司后台：
  - 车辆库与车辆管理（增删改查、筛选、分页、状态管理）
  - 注册用户管理（查询、改角色、删除）
  - 系统设置（竞拍开关、邮件相关配置）

## 2. 技术栈

- 前端：`React`、`Vite`、`TailwindCSS`
- 后端：`Node.js`、`Express`
- 数据库：`SQLite`（`backend/database.sqlite`）
- ORM：`Sequelize`
- 认证：`JWT`

## 3. 本地开发启动

### 3.1 安装依赖

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3.2 后端环境变量（`backend/.env`）

```env
PORT=5000
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h
ALLOW_PUBLIC_REGISTER=true
AUCTION_ENABLED=false
DEFAULT_SELLER_EMAIL=admin@sgautotrading.local
DEFAULT_SELLER_PASSWORD=Admin@123456
```

### 3.3 启动服务

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:5000`

## 4. 路由说明

- 前台：
  - `/`
  - `/cars`
  - `/cars/:id`
  - `/auction`
  - `/loan-calculator`
  - `/agent`
  - `/login`
  - `/signup`
  - `/forgot-password`
- 需登录：
  - `/tracking`
- 管理后台（seller）：
  - `/admin/cars`
  - `/admin/users`

## 5. 核心业务规则

- 默认入口（`/cars`）只展示直售车辆
- 竞拍入口（`/auction`）仅在竞拍开关开启时展示竞拍车辆
- 竞拍开关关闭时：
  - 首页显示：`No auction vehicles at the moment, stay tuned!`
  - 出价接口拒绝请求

## 6. 主要 API

### 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### 车辆

- `GET /api/cars`
- `GET /api/cars/brands`
- `GET /api/cars/:id`
- `POST /api/cars`（seller）
- `PUT /api/cars/:id`（seller）
- `DELETE /api/cars/:id`（seller）

`GET /api/cars` 关键参数：

- `entry=sale|auction`
- `includeAuction=1`（后台管理全量）
- `search`、`status`
- `limit`、`offset`
- `sortBy`、`sortOrder`

### 竞拍

- `POST /api/bids`
- `GET /api/bids/car/:carId`
- `GET /api/bids/me`

### 系统设置

- `GET /api/settings/public`
- `GET /api/settings`（seller）
- `PUT /api/settings/auction-enabled`（seller）

### 后台用户管理（seller）

- `GET /api/admin/users`
- `PUT /api/admin/users/:id/role`
- `DELETE /api/admin/users/:id`

## 7. 邮箱服务说明

- 忘记密码邮件依赖 SMTP 配置
- 客户在后台配置好 SMTP 后，即可使用邮箱验证/重置流程
- 未配置 SMTP 时，`forgot-password` 会失败（服务功能已就绪）

## 8. 生产部署（当前）

- 服务器：`154.12.28.145`
- 访问地址：
  - `http://154.12.28.145`
  - `https://154.12.28.145`（当前为自签证书）
- 进程守护：`pm2`（进程名：`sg-auto-backend`）
- 反向代理：`nginx`

## 9. 默认管理账号

- Email：`admin@sgautotrading.local`
- Password：`Admin@123456`

> 首次上线后请立即修改默认管理员密码。
