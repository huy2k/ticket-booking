# PRODUCT REQUIREMENT DOCUMENT (PRD): HỆ THỐNG ĐIỀU TIẾT HÀNG ĐỢI MUA VÉ (VIRTUAL QUEUE)

## 1. Mục tiêu dự án

Xây dựng hệ thống bán vé có khả năng kiểm soát lưu lượng truy cập, đảm bảo tính công bằng (FIFO) và duy trì sự ổn định của hệ thống bằng cách giới hạn số lượng người thanh toán cùng lúc.

---

## 2. Các tính năng chính (Core Features)

### 2.1. Quản lý tài khoản (Identity Management)

- **Đăng ký/Đăng nhập:** Hỗ trợ Email, Số điện thoại.
- **Xác thực:** Mỗi tài khoản chỉ được phép có **01 mã số đợi (Token)** duy nhất tại một thời điểm để chống spam.
- **Profile:** Lưu trữ lịch sử mua vé và trạng thái vé.

### 2.2. Cơ chế Hàng đợi ảo (Waiting Room & FIFO)

- **Cấp số thứ tự:** Khi người dùng nhấn "Mua vé", hệ thống kiểm tra số lượng người đang trong trang thanh toán.
  - Nếu `< 100`: Cho phép vào thẳng.
  - Nếu `>= 100`: Đưa vào hàng đợi Redis và cấp số thứ tự dựa trên thời gian (timestamp).
- **Cập nhật thời gian thực:** Sử dụng **WebSocket** để đẩy thông báo số thứ tự hiện tại của người dùng mà không cần tải lại trang.
- **Heartbeat Mechanism:** Trình duyệt gửi tín hiệu mỗi 5-10 giây để duy trì chỗ trong hàng. Nếu quá 30 giây không có tín hiệu, hệ thống tự động hủy số thứ tự đó.

### 2.3. Điều phối truy cập (Traffic Throttling)

- **Ngưỡng giới hạn (Threshold):** Duy trì cố định tối đa 100 người trong trang chọn ghế/thanh toán.
- **Cơ chế "Nhả" hàng:**
  - Khi 1 người hoàn tất thanh toán hoặc bị Timeout (hết thời gian), hệ thống lập tức mời người đứng đầu hàng đợi (Số thứ tự tiếp theo) vào.

### 2.4. Quy trình Mua vé & Thanh toán

- **Giữ ghế (Booking Lock):** Sau khi vào trang, người dùng có 5 phút để chọn ghế. Ghế đã chọn sẽ được khóa (Pending) trong 10 phút để chờ thanh toán.
- **Thanh toán:** Tích hợp cổng thanh toán (VNPay, Momo, v.v.).
- **Hết hạn (Timeout):** Nếu quá 15 phút từ lúc được vào trang mà không hoàn tất giao dịch, người dùng bị đẩy ra ngoài và phải xếp hàng lại từ đầu.

---

## 3. Yêu cầu kỹ thuật (Technical Specifications)

| Thành phần    | Công nghệ đề xuất          | Mô tả                                                                                     |
| :------------ | :------------------------- | :---------------------------------------------------------------------------------------- |
| **Hàng đợi**  | **Redis Sorted Sets**      | Lưu `User_ID` làm Member và `Timestamp` làm Score để đảm bảo thứ tự tuyệt đối.            |
| **Giao tiếp** | **WebSockets (Socket.io)** | Cập nhật vị trí hàng đợi và đẩy thông báo "Đến lượt bạn" ngay lập tức.                    |
| **Database**  | **PostgreSQL**             | Xử lý Transaction để đảm bảo tính ACID (không bao giờ xảy ra lỗi 2 người mua cùng 1 ghế). |
| **Backend**   | **Node.js / Go**           | Ngôn ngữ xử lý bất đồng bộ tốt để xử lý hàng ngàn kết nối chờ cùng lúc.                   |

---

## 4. Kịch bản xử lý lỗi (Edge Cases)

1. **Người dùng tải lại trang (F5):** Dựa vào Token lưu ở Cookie/LocalStorage và Server để giữ đúng vị trí cũ trong hàng đợi.
2. **Hệ thống quá tải đột ngột:** Áp dụng **Rate Limiting** ở tầng Gateway để chặn các request tấn công (DDoS) trước khi vào hàng đợi.
3. **Vé hết trong khi đang chờ:** Khi vé về 0, hệ thống tự động thông báo cho tất cả người dùng trong hàng đợi và đóng cổng.

---

## 5. Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] Hệ thống chịu tải được ít nhất 10,000 người truy cập cùng lúc vào hàng đợi.
- [ ] Đảm bảo không bao giờ có quá 100 người trong khu vực thanh toán.
- [ ] Người vào trước (dựa trên timestamp) phải được vào mua trước.
- [ ] Không xảy ra tình trạng bán quá số lượng vé thực tế (Overselling).

## 6. FRONTEND REQUIREMENT: TICKET QUEUEING UI/UX

### 1. Phong cách thiết kế (UI Style)

- **Theme:** Dark Mode (Nền đen/Xám đậm #121212).
- **Accent Color:** Neon Purple (#BC13FE) cho các nút bấm và trạng thái hoạt động.
- **Typography:** Font không chân hiện đại (Inter hoặc Roboto).

### 2. Các màn hình chính (Screens)

#### 2.1. Trang Hàng đợi (Waiting Room)

- **Cấu trúc:**
  - Header: Tên sự kiện & Thời gian đếm ngược đến lúc mở bán (nếu chưa đến giờ).
  - Center: Một **Circular Progress Bar** hiển thị số thứ tự.
  - Nội dung:
    - "Số thứ tự của bạn: **#1.250**"
    - "Phía trước bạn còn: **1.150** người."
    - "Thời gian chờ dự kiến: **15 phút**."
- **Hiệu ứng:** Animation sóng nhạc mờ chạy nền để báo hiệu hệ thống vẫn đang hoạt động, không bị treo.

#### 2.2. Trang Chọn ghế (Seat Selection)

- **Giao diện:** Sơ đồ SVG tương tác.
- **Phân loại màu ghế:**
  - Ghế trống: #E0E0E0 (Xám nhạt).
  - Ghế đang chọn: #BC13FE (Neon Purple).
  - Ghế đã bán: #424242 (Xám đậm - Disabled).
- **Tính năng:**
  - Floating bar: Hiển thị số lượng ghế đã chọn và nút "Thanh toán ngay".
  - Countdown Timer: Đồng hồ đếm ngược 10:00 hiển thị ở góc màn hình. Khi về 0:00, tự động đẩy về trang chủ.

#### 2.3. Xử lý logic & Interaction

- **WebSocket/Polling:** Tự động kết nối với API `/queue/status`. Khi nhận được trạng thái `ready`, thực hiện hiệu ứng chuyển cảnh mượt (Fade out) và chuyển hướng sang trang chọn ghế.
- **Persistence:** Lưu `QueueToken` vào `localStorage`. Nếu user F5, hệ thống phải giữ nguyên trạng thái hàng đợi, không bắt đầu lại từ đầu.
- **Thông báo (Toast):**
  - "Sắp đến lượt bạn, vui lòng chuẩn bị thông tin thanh toán!" (Khi STT < 50).
  - "Phiên làm việc đã hết hạn!" (Khi quá thời gian chọn ghế).

#### 2.4. Responsive

- Đảm bảo sơ đồ ghế có thể zoom bằng ngón tay trên Mobile (Pinch-to-zoom).
- Các nút bấm trên Mobile phải có kích thước tối thiểu 44px để dễ thao tác.
