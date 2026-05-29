# 🐛 Error Log - ticket-booking

> Tập hợp tất cả lỗi xảy ra trong quá trình phát triển (Auto-generated).

---

## Thống kê nhanh
- **Tổng lỗi**: 2
- **Đã sửa**: 2

---

<!-- Errors sẽ được agent tự động ghi vào đây -->

### 1. Lỗi hàng đợi không tự động mời người tiếp theo khi treo máy (Queue Hang Idle Bug)
- **Lỗi**: Khi 1 trong 2 người dùng đang ở trang Chọn ghế/Thanh toán đóng tab hoặc mất kết nối (treo máy), người dùng thứ 3 đứng chờ ở hàng đợi không được tự động chuyển sang trang Chọn ghế, mà bị kẹt hiển thị số thứ tự `#0`.
- **Nguyên nhân**: 
  1. Số người hoạt động (`active_count`) được quản lý bằng biến đếm tăng/giảm đơn giản trong Redis. Khi nhịp tim (`heartbeat`) hết hạn, không có logic tự động giảm biến đếm này và kích hoạt `onUserLeft`.
  2. Phần frontend (`WaitingRoom` và `waiting-room/page.tsx`) chưa được đăng ký lắng nghe sự kiện WebSocket `queue:enter` và API Polling trả về `position: 0` khi người dùng đã được vào Active Zone nhưng giao diện không tự chuyển trang.
- **Giải pháp**:
  1. Thay đổi cấu trúc Active Zone từ biến đếm đơn giản sang Sorted Set `active_users:${eventId}` có tích hợp timestamp hết hạn của nhịp tim (heartbeat).
  2. Tạo Sorted Set `queue_heartbeats:${eventId}` để tự động theo dõi nhịp tim của người dùng đang xếp hàng.
  3. Viết `QueueScheduler` chạy nền mỗi 5 giây để quét dọn nhịp tim hết hạn của cả active zone và hàng đợi, rồi tự động pop người tiếp theo, gửi WebSocket `queue:enter`.
  4. Cập nhật frontend `waiting-room/page.tsx` và `WaitingRoom.tsx` để lắng nghe sự kiện WebSocket `queue:enter` và nhận diện cờ `entered: true` từ API Polling để tự động chuyển trang.
- **Phòng ngừa**: Luôn sử dụng cơ chế lưu trữ có cấu trúc (như Sorted Sets với score là expiration timestamp) khi thiết kế phòng chờ/hàng đợi động thay vì dùng các biến đếm đơn giản, đồng thời kết hợp cơ chế kiểm thử đa cửa sổ để phát hiện kịp thời các hành vi bất thường của người dùng ngoại tuyến.

### 2. Lỗi bất kỳ ai cũng vào được mà không cần hàng đợi (Active Users Expired Too Fast Bug)
- **Lỗi**: Sau khi triển khai QueueScheduler để quét dọn nhịp tim hết hạn, bất kỳ số lượng người dùng nào cũng có thể vào thẳng trang chọn ghế mà không phải xếp hàng (giới hạn `max_active=2` bị vô hiệu hóa).
- **Nguyên nhân**: Trang chọn ghế (`/seat-selection`) của Frontend không gửi tín hiệu nhịp tim (`heartbeat`) định kỳ lên server. Hệ quả là sau 30 giây khi người dùng vào trang chọn ghế, `QueueScheduler` quét và kết luận nhịp tim của họ đã hết hạn, tự động xóa họ khỏi danh sách `active_users` trên Redis. Slot hoạt động trống liên tục dẫn đến việc bất kỳ ai nhấn mua vé cũng được cho vào luôn mà không cần xếp hàng.
- **Giải pháp**: Bổ sung hook `useEffect` gửi heartbeat định kỳ mỗi 5 giây lên `/api/queue/heartbeat` tại component [seat-selection/page.tsx](file:///home/huy/Documents/freelance/ticket-booking/web/src/app/seat-selection/page.tsx#L85-L99) để duy trì sự sống của phiên làm việc khi người dùng đang thực hiện chọn ghế.
- **Phòng ngừa**: Khi thiết kế cơ chế dọn dẹp (Active Cleanup) dựa trên nhịp tim ở phía Server, tất cả các trang nằm trong vùng giới hạn (Active Zone) đều bắt buộc phải triển khai cơ chế gửi tín hiệu nhịp tim định kỳ lên Server.
