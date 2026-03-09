# 🎟️ Ticket Queue Booking System

Hệ thống mua vé trực tuyến với **hàng đợi ảo thông minh** — đảm bảo công bằng FIFO và không bán quá số lượng vé.

## Tech Stack

| Layer           | Tech                               |
| :-------------- | :--------------------------------- |
| **Backend API** | NestJS 11 + TypeScript             |
| **Database**    | PostgreSQL (Prisma ORM)            |
| **Queue**       | Redis Sorted Sets (FIFO)           |
| **Real-time**   | Socket.io WebSocket                |
| **Frontend**    | Next.js 16 + React 19 + Tailwind 4 |
| **Auth**        | JWT + bcrypt                       |

## Cấu trúc dự án

```
ticket-booking/
├── api/              # NestJS Backend (port 3000)
│   ├── prisma/       # Schema PostgreSQL
│   └── src/
│       ├── auth/     # Register, Login, JWT
│       ├── queue/    # Redis FIFO Queue
│       ├── seat/     # Seat lock (SELECT FOR UPDATE)
│       ├── gateway/  # WebSocket (Socket.io)
│       ├── common/   # Redis service
│       └── prisma/   # Prisma service
├── web/              # Next.js Frontend (port 3001)
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Homepage
│       │   ├── login/page.tsx        # Đăng nhập / Đăng ký
│       │   ├── waiting-room/page.tsx # Phòng chờ FIFO
│       │   └── seat-selection/page.tsx # Chọn ghế
│       └── components/
│           ├── WaitingRoom.tsx       # Queue UI + heartbeat
│           ├── SeatMap.tsx           # SVG seat map
│           └── CountdownTimer.tsx    # Đếm ngược 10 phút
└── docker-compose.yml  # PostgreSQL + Redis
```

## Hướng dẫn chạy (Local Dev)

### 1. Khởi động PostgreSQL & Redis

```bash
docker compose up -d
```

### 2. Cài đặt và chạy API

```bash
cd api
npm install
# Tạo DB schema
npx prisma migrate dev --name init
# Tạo Prisma Client
npx prisma generate
# Chạy dev server
npm run start:dev
```

API sẽ chạy tại **http://localhost:3000**

### 3. Cài đặt và chạy Web

```bash
cd web
npm install
npm run dev -- --port 3001
```

Web sẽ chạy tại **http://localhost:3001**

## API Endpoints

| Method | Endpoint                     | Mô tả               |
| :----- | :--------------------------- | :------------------ |
| `POST` | `/api/auth/register`         | Đăng ký             |
| `POST` | `/api/auth/login`            | Đăng nhập           |
| `POST` | `/api/queue/:eventId/join`   | Vào hàng đợi        |
| `GET`  | `/api/queue/:eventId/status` | Xem vị trí          |
| `POST` | `/api/queue/heartbeat`       | Duy trì slot        |
| `GET`  | `/api/seats/:eventId/map`    | Lấy sơ đồ ghế       |
| `POST` | `/api/seats/lock`            | Giữ ghế             |
| `POST` | `/api/seats/confirm`         | Xác nhận thanh toán |

## WebSocket Events

| Event (emit)      | Mô tả                           |
| :---------------- | :------------------------------ |
| `register`        | Đăng ký userId với socket       |
| `join_event_room` | Vào room của sự kiện            |
| `heartbeat`       | Ping giữ slot                   |
| `queue:enter`     | ← Server báo "Đến lượt bạn"     |
| `queue:update`    | ← Server cập nhật tổng hàng đợi |
| `queue:soon`      | ← Server báo "Sắp đến lượt"     |
| `queue:sold_out`  | ← Server báo vé hết             |

## Acceptance Criteria

- ✅ ≤ 100 người đồng thời trong khu vực thanh toán
- ✅ Người vào trước (FIFO timestamp) được phục vụ trước
- ✅ SELECT FOR UPDATE chống overselling
- ✅ F5 → giữ vị trí hàng đợi (localStorage + server token)
- ✅ Heartbeat 5s, timeout 30s → thu hồi slot
- ✅ CountdownTimer 10 phút → redirect khi hết giờ
- ✅ Dark mode + Neon Purple (#BC13FE) UI

---

_Built with ♥ by Antigravity — Virtual Queue Ticket Booking System_
