# PLAN-ticket-queue.md

# Hệ thống Điều tiết Hàng đợi Mua vé (Virtual Queue Ticket Booking)

> **Tài liệu nguồn:** `plan.md` (PRD đã duyệt)
> **Ngày tạo:** 2026-03-05
> **Trạng thái:** PLANNING

---

## 📌 Phase 1: Context Analysis (The "Why")

### Vấn đề cốt lõi

Khi sự kiện hot mở bán, hàng chục nghìn người truy cập đồng thời → **server quá tải**, **ghế bị bán trùng (overselling)**, **trải nghiệm người dùng tệ**.

### Mục tiêu

| Mục tiêu              | Chỉ số cụ thể                                              |
| :-------------------- | :--------------------------------------------------------- |
| Kiểm soát lưu lượng   | ≤ 100 người đồng thời trong khu vực thanh toán             |
| Công bằng FIFO        | Người vào trước (timestamp thấp hơn) được phục vụ trước    |
| Chịu tải              | ≥ 10,000 người xếp hàng đồng thời                          |
| Không overselling     | Transaction ACID đảm bảo 1 ghế = 1 người                   |
| Trải nghiệm real-time | Cập nhật vị trí hàng đợi qua WebSocket, không reload trang |

### Người dùng mục tiêu

- **Primary**: Người mua vé (end-user) — muốn mua vé nhanh, công bằng.
- **Secondary**: Admin/Ban tổ chức — muốn hệ thống ổn định, không crash.

---

## 📋 Phase 2: User Stories & Acceptance Criteria

### Epic 1: Xác thực & Tài khoản

**US-01:** Đăng ký / Đăng nhập

```
As a người mua vé,
I want to đăng ký và đăng nhập bằng Email hoặc SĐT,
So that tôi có thể giữ vị trí hàng đợi gắn với tài khoản của mình.
```

**AC (Gherkin):**

```gherkin
Given tôi chưa có tài khoản
When tôi điền Email + Password và nhấn "Đăng ký"
Then hệ thống tạo tài khoản và tự động đăng nhập
And gửi email xác nhận nếu cần

Given tôi đã có tài khoản
When tôi yêu cầu mua vé
Then hệ thống chỉ cho phép 1 QueueToken duy nhất tại một thời điểm
```

---

### Epic 2: Hàng đợi ảo (Waiting Room)

**US-02:** Vào hàng đợi

```
As a người mua vé,
I want to nhận số thứ tự tự động khi nhấn "Mua vé",
So that tôi biết mình đang ở vị trí nào trong hàng.
```

**AC:**

```gherkin
Given số người trong khu vực thanh toán < 100
When tôi nhấn "Mua vé"
Then hệ thống cho tôi vào thẳng trang chọn ghế

Given số người trong khu vực thanh toán >= 100
When tôi nhấn "Mua vé"
Then hệ thống thêm tôi vào Redis Sorted Set với score = Unix Timestamp hiện tại
And trả về QueueToken và số thứ tự của tôi

Given tôi đang trong hàng đợi
When trình duyệt của tôi không gửi heartbeat trong 30 giây
Then hệ thống tự động xóa QueueToken của tôi và chuyển slot cho người tiếp theo
```

**US-03:** Xem vị trí hàng đợi real-time

```
As a người đang chờ,
I want to thấy vị trí của mình cập nhật liên tục,
So that tôi biết khi nào đến lượt mà không cần F5.
```

**AC:**

```gherkin
Given tôi đang trong Waiting Room
When có người phía trước thanh toán xong hoặc timeout
Then WebSocket đẩy cập nhật số thứ tự mới của tôi trong < 2 giây
And Circular Progress Bar trên UI cập nhật tương ứng

Given tôi tải lại trang (F5)
When hệ thống đọc QueueToken từ localStorage
Then vị trí hàng đợi của tôi được khôi phục đúng
And tôi KHÔNG bị đẩy về cuối hàng
```

---

### Epic 3: Chọn ghế & Thanh toán

**US-04:** Giữ ghế

```
As a người vừa được vào trang chọn ghế,
I want to có 10 phút để xác nhận và thanh toán,
So that không ai khác lấy ghế của tôi trong khi tôi đang điền thông tin.
```

**AC:**

```gherkin
Given tôi chọn ghế A1
When tôi nhấn "Chọn ghế"
Then hệ thống lock ghế A1 với status = PENDING trong DB (10 phút)
And countdown timer 10:00 bắt đầu trên UI

Given timer về 0:00
When thanh toán chưa hoàn tất
Then hệ thống giải phóng ghế A1 (status = AVAILABLE)
And redirect tôi về trang chủ với thông báo "Phiên làm việc đã hết hạn"
And mở slot trong khu vực thanh toán cho người tiếp theo
```

**US-05:** Không bán quá số lượng (Anti-overselling)

```
As hệ thống,
I want to đảm bảo chỉ 1 người mua được 1 ghế,
So that không bao giờ xảy ra conflict.
```

**AC:**

```gherkin
Given ghế A1 đang PENDING (người dùng A đặt)
When người dùng B cũng cố chọn ghế A1
Then DB transaction (SELECT FOR UPDATE) từ chối
And ghế A1 hiển thị màu xám (disabled) cho người dùng B
```

---

### MoSCoW Prioritization

| Priority   | Feature                                                               |
| :--------- | :-------------------------------------------------------------------- |
| **Must**   | Hàng đợi Redis FIFO, WebSocket real-time, Heartbeat, Anti-overselling |
| **Must**   | Seat lock (Pending) 10 phút, Timeout redirect, Auth cơ bản            |
| **Should** | Countdown timer UI, Toast notifications, Persist F5                   |
| **Should** | Pinch-to-zoom mobile, Payment gateway integration (VNPay/Momo)        |
| **Could**  | Thông báo "Vé hết", Admin dashboard real-time                         |
| **Won't**  | Mobile native app (v1 chỉ web)                                        |

---

## 🏗️ Phase 3: Technical Blueprint

### Tech Stack (đã định trong PRD + mở rộng)

| Layer         | Technology                    | Lý do chọn                                            |
| :------------ | :---------------------------- | :---------------------------------------------------- |
| **Runtime**   | Node.js (NestJS)              | Async I/O tốt, ecosystem Socket.io native             |
| **Queue**     | Redis Sorted Sets             | Score = Timestamp → FIFO tuyệt đối, O(log N) insert   |
| **WebSocket** | Socket.io                     | Fallback HTTP polling tự động, room management        |
| **Database**  | PostgreSQL                    | ACID transactions, `SELECT FOR UPDATE` chống oversell |
| **Cache**     | Redis                         | Đếm số lượng người trong khu vực thanh toán           |
| **Frontend**  | Next.js 14 (App Router)       | SSR + client WebSocket, TypeScript                    |
| **Auth**      | JWT + Redis (token blacklist) | Stateless + khả năng revoke                           |
| **Seat Map**  | SVG tương tác                 | Lightweight, zoom-friendly, dynamic coloring          |

### Cấu trúc thư mục đề xuất

```
ticket-booking/
├── apps/
│   ├── api/                      # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/             # Module: đăng ký, đăng nhập, JWT
│   │   │   ├── queue/            # Module: hàng đợi Redis, heartbeat
│   │   │   ├── seat/             # Module: booking lock, seat map
│   │   │   ├── payment/          # Module: VNPay/Momo integration
│   │   │   └── gateway/          # WebSocket Gateway (Socket.io)
│   │   └── prisma/               # Schema PostgreSQL
│   └── web/                      # Next.js Frontend
│       ├── app/
│       │   ├── (auth)/           # Login / Register pages
│       │   ├── waiting-room/     # Waiting Room UI
│       │   └── seat-selection/   # Seat Map + Checkout
│       └── components/
│           ├── CircularProgress/ # Animated queue progress bar
│           ├── SeatMap/          # SVG seat map
│           └── CountdownTimer/   # 10-minute timer
├── docker-compose.yml            # Redis + PostgreSQL local
└── docs/
    └── PLAN-ticket-queue.md      # This file
```

### Data Schema chính

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sale_start_at TIMESTAMPTZ,
  total_seats INT NOT NULL
);

-- Seats
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  seat_code VARCHAR(10) NOT NULL,       -- e.g. "A1", "B12"
  status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE | PENDING | SOLD
  locked_by UUID REFERENCES users(id),
  locked_until TIMESTAMPTZ,
  UNIQUE(event_id, seat_code)
);

-- Tickets (confirmed purchases)
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  seat_id UUID REFERENCES seats(id),
  event_id UUID REFERENCES events(id),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  payment_ref VARCHAR(100)
);
```

### Redis Key Design

```
queue:{event_id}          → Sorted Set: member=user_id, score=timestamp
active_count:{event_id}   → Counter: số người đang trong khu vực thanh toán
heartbeat:{user_id}       → String với TTL 30s: duy trì slot trong hàng
queue_token:{user_id}     → String: QueueToken JWT cho user này
```

---

## 📅 Phase 4: Task Orchestration (Sprint Breakdown)

### Sprint 1: Foundation & Auth (Tuần 1-2)

| Task | Agent        | Skills                  | INPUT                   | OUTPUT                                             | VERIFY                                                |
| :--- | :----------- | :---------------------- | :---------------------- | :------------------------------------------------- | :---------------------------------------------------- |
| T1.1 | backend-dev  | nodejs-backend-patterns | Yêu cầu auth            | NestJS app + Auth module (register/login JWT)      | POST /auth/register trả 201, POST /auth/login trả JWT |
| T1.2 | db-admin     | database-architect      | Schema thiết kế         | Prisma schema + migration cho users, events, seats | `npx prisma migrate dev` chạy thành công              |
| T1.3 | devops       | docker-expert           | docker-compose template | docker-compose.yml với Redis + PostgreSQL          | `docker compose up` → Redis :6379, PG :5432           |
| T1.4 | frontend-dev | frontend-developer      | Design spec             | Next.js project setup + Login/Register pages       | UI render đúng, gọi API login thành công              |

---

### Sprint 2: Queue Engine (Tuần 3-4) ⭐ Core

| Task | Agent        | Skills                                     | INPUT             | OUTPUT                                                             | VERIFY                                          |
| :--- | :----------- | :----------------------------------------- | :---------------- | :----------------------------------------------------------------- | :---------------------------------------------- |
| T2.1 | backend-dev  | nodejs-backend-patterns, bullmq-specialist | Redis design      | Queue Service: `joinQueue()`, `getPosition()`, `removeFromQueue()` | Unit test: FIFO order đúng với 1000 mock users  |
| T2.2 | backend-dev  | nodejs-backend-patterns                    | Queue Service     | Heartbeat Service: gửi ping mỗi 5s, xóa sau 30s không ping         | Test: dừng ping → user bị xóa sau ~35s          |
| T2.3 | backend-dev  | nodejs-backend-patterns                    | Queue + Heartbeat | Throttle Service: giữ `active_count` ≤ 100, tự động "nhả" hàng     | Test: 150 users join → chỉ 100 được vào, 50 chờ |
| T2.4 | backend-dev  | nodejs-backend-patterns                    | Throttle Service  | WebSocket Gateway: emit `queue:update` khi vị trí thay đổi         | Test: vị trí cập nhật trong < 2 giây            |
| T2.5 | frontend-dev | frontend-developer                         | WebSocket events  | Waiting Room UI: CircularProgress + số thứ tự + ước tính thời gian | F5 → vị trí được restore, không về 0            |

---

### Sprint 3: Seat Selection & Anti-overselling (Tuần 5-6) ⭐ Critical

| Task | Agent        | Skills                  | INPUT                 | OUTPUT                                                         | VERIFY                                                              |
| :--- | :----------- | :---------------------- | :-------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------ |
| T3.1 | backend-dev  | database-optimizer      | Seat schema           | Seat Service: `lockSeat()` với `SELECT FOR UPDATE` transaction | Concurrent test: 50 requests cùng lock A1 → chỉ 1 thành công        |
| T3.2 | backend-dev  | nodejs-backend-patterns | Seat Service          | Expiry Worker: quét và giải phóng PENDING seats quá 10 phút    | Cron test: ghế PENDING quá hạn → status → AVAILABLE                 |
| T3.3 | frontend-dev | frontend-developer      | SVG seat map template | SeatMap component: màu AVAILABLE/PENDING/SOLD, click để chọn   | Click ghế available → highlight purple, ghế sold → không click được |
| T3.4 | frontend-dev | frontend-developer      | CountdownTimer design | CountdownTimer component: 10:00 đếm ngược, hết → redirect      | Timer về 0 → redirect về trang chủ với toast                        |

---

### Sprint 4: Payment & Polish (Tuần 7-8)

| Task | Agent        | Skills                  | INPUT           | OUTPUT                                                           | VERIFY                                                  |
| :--- | :----------- | :---------------------- | :-------------- | :--------------------------------------------------------------- | :------------------------------------------------------ |
| T4.1 | backend-dev  | api-design-principles   | VNPay/Momo docs | Payment Service: tạo link thanh toán, xác nhận callback          | Sandbox test: thanh toán thành công → ghế status = SOLD |
| T4.2 | backend-dev  | nodejs-backend-patterns | Edge cases spec | Rate Limiting ở API Gateway (100 req/s per IP)                   | Load test: 200 req/s → 429 Too Many Requests            |
| T4.3 | frontend-dev | frontend-developer      | Toast spec      | Thông báo: "Sắp đến lượt" (STT < 50), "Hết hạn", "Vé đã bán hết" | Kiểm tra thủ công từng trạng thái                       |
| T4.4 | frontend-dev | mobile-design           | Responsive spec | Pinch-to-zoom cho SVG seat map trên mobile                       | Test trên Chrome DevTools Mobile mode                   |

---

## ✅ Checklist Nghiệm Thu (Acceptance Criteria tổng thể)

```
[ ] Chịu tải ≥ 10,000 người trong hàng đợi (load test với k6/Artillery)
[ ] Không bao giờ > 100 người trong khu vực thanh toán
[ ] FIFO đúng: timestamp thấp hơn → vào trước
[ ] Anti-overselling: concurrent 50 requests lock cùng 1 ghế → chỉ 1 thành công
[ ] F5 → vị trí hàng đợi được giữ nguyên
[ ] Heartbeat timeout 30s → slot bị thu hồi
[ ] Countdown 10 phút → redirect và giải phóng ghế
[ ] Mobile responsive: seat map zoom được bằng ngón tay
[ ] Dark mode UI với Neon Purple (#BC13FE) accent
```

---

## 🗺️ Roadmap tổng quan

```
Tuần 1-2:  [Sprint 1] Foundation  → Auth + DB + Docker
Tuần 3-4:  [Sprint 2] Queue       → Redis + WS + Throttle  ⭐
Tuần 5-6:  [Sprint 3] Seats       → Lock + SVG + Anti-oversell ⭐
Tuần 7-8:  [Sprint 4] Payment     → VNPay + Polish + Load test
```

---

_Plan được tạo bởi Antigravity · Dựa trên PRD: plan.md_
