
# Hệ thống Phát hiện Cháy & Khói (Fire & Smoke Detection)

## 1. Mô hình sử dụng
Sử dụng mô hình YOLO (phiên bản 8/11) đã được huấn luyện riêng để nhận diện các vùng có lửa (fire) và khói (smoke).

## 2. Cơ chế nhận diện
- **Tiền xử lý**: Frame hình ảnh được resize về kích thước tiêu chuẩn (640px) để đảm bảo tốc độ xử lý ổn định.
- **Phân loại**:
    - `Fire`: Nhận diện dựa trên màu sắc và hình dáng đặc trưng của ngọn lửa với độ tin cậy (`min_confidence`) mặc định 0.5.
    - `Smoke`: Nhận diện các vùng khói xám, trắng hoặc đen với ngưỡng tin cậy cao hơn (`smoke_confidence` = 0.75) để tránh nhầm lẫn với các vật thể khác.

## 3. Hiển thị & Cảnh báo
- **Visual Overlay**: Khi phát hiện, AI sẽ vẽ một vùng phủ màu đỏ (cho lửa) hoặc xám (cho khói) với độ trong suốt 20% giúp người vận hành dễ dàng quan sát nhưng không làm mất chi tiết hình ảnh.
- **Bounding Box**: Vẽ khung bao quanh vùng cháy với các góc được làm đậm (corner length) để tăng tính thẩm mỹ và dễ quan sát.
- **Thanh trạng thái**: Hiển thị trạng thái hiện tại (Fire/Smoke/No Detection) và các ngưỡng tin cậy đang áp dụng ngay dưới đáy camera.

## 4. Tích hợp hệ thống
Hệ thống được gọi định kỳ (mặc định mỗi 10 frames) trong `CameraStream.py` để tiết kiệm tài nguyên CPU/GPU nhưng vẫn đảm bảo thời gian phản hồi cảnh báo < 1 giây.
