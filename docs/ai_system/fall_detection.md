
# Hệ thống Phát hiện Ngã (Fall Detection)

## 1. Nguyên lý hoạt động
Hệ thống sử dụng mô hình YOLO Pose để trích xuất 17 điểm khung xương trên cơ thể người, sau đó phân tích các thông số hình học và động lực học để đưa ra quyết định.

## 2. Các chỉ số phân tích
- **Góc nghiêng thân mình (Posture Angle)**: Tính góc tạo bởi đường thẳng nối giữa Trung điểm Vai và Trung điểm Hông với trục dọc.
    - `STANDING`: < 30°
    - `BENDING`: 30° - 60°
    - `LYING`: > 60°
- **Vận tốc rơi (Impact Velocity)**: Tính toán sự thay đổi vị trí của hông trong khoảng thời gian ngắn (200ms). Nếu vận tốc vượt ngưỡng (500 px/s), AI coi đây là một cú va chạm mạnh.
- **Thời gian chuyển trạng thái (Transition Time)**: Theo dõi lịch sử trạng thái trong vòng 2 giây. Nếu chuyển từ Đứng sang Nằm trong < 1.5 giây, AI đánh giá là có dấu hiệu ngã.

## 3. Trạng thái cảnh báo (Logic Machine)
- **NORMAL**: Trạng thái bình thường.
- **RESTING**: Người dùng nằm xuống một cách chậm rãi (ví dụ nghỉ ngơi).
- **PRE_ALARM**: Phát hiện cú rơi nhanh hoặc va chạm mạnh. Hệ thống sẽ đợi 3 giây (Inactivity Duration) để kiểm tra xem người đó có cử động hay đứng dậy không.
- **ALARM**: Nếu sau 3 giây người dùng vẫn nằm yên tại vị trí đó, cảnh báo chính thức được kích hoạt.

## 4. Tùy chỉnh thông số
Các thông số này có thể được điều chỉnh trong file `core/fall_detector.py`:
- `INACTIVITY_DURATION`: 3.0s (Thời gian chờ xác nhận ngã)
- `FALL_TRANSITION_MAX_TIME`: 1.5s (Ngưỡng thời gian rơi nhanh)
- `HIGH_IMPACT_VELOCITY_THRESHOLD`: 500 px/s (Ngưỡng va chạm mạnh)
