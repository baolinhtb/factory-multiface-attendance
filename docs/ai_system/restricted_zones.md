
# Hệ thống Phát hiện Xâm nhập Vùng cấm (Restricted Zone Detection)

## 1. Nguyên lý hoạt động
Hệ thống cho phép người dùng định nghĩa các đa giác (polygons) không giới hạn số cạnh trên khung hình camera. Khi AI phát hiện có người bước chân vào các vùng này, một cảnh báo vi phạm sẽ được kích hoạt.

## 2. Các quy tắc nhận diện (Rules)
Để đảm bảo độ chính xác và tránh báo động giả, hệ thống áp dụng các quy tắc sau:

- **Dựa trên Vị trí Chân (Feet-based)**:
    - Điểm kích hoạt là **Mắt cá chân (Ankles)** của khung xương AI (Keypoints 15 và 16).
    - Nếu chân bị che khuất, hệ thống sẽ tự động sử dụng **điểm chính giữa cạnh dưới** của khung bao (Bounding Box) làm điểm thay thế.
- **Tọa độ Tương đối (Relative Coordinates)**:
    - Toàn bộ tọa độ vùng cấm được lưu dưới dạng tỉ lệ đại số (0.0 đến 1.0) so với khung hình.
    - Tại Frontend: `(click_x / canvas_width)`
    - Tại Backend: `(rel_x * processing_frame_width)`
    - Điều này giúp vùng cấm luôn chính xác tuyệt đối bất kể camera thay đổi độ phân giải (720p, 1080p, 4K) hay AI thực hiện resize ảnh để inference (1024px).
- **Cơ chế Duy trì (Temporal Buffer)**:
    - Một vi phạm chỉ được xác nhận nếu điểm chân nằm trong vùng cấm liên tục trong **5 khung hình** (khoảng 0.3 - 0.5 giây).
    - Cơ chế này giúp loại bỏ hoàn toàn các lỗi "nhảy" điểm (jitter) của AI đồng thời đảm bảo phản hồi nhanh chóng.
- **Tính thời gian thực và Minh bạch**:
    - Khi xóa bỏ vùng cấm trong cài đặt, toàn bộ trạng thái vi phạm cũ sẽ được reset ngay lập tức để tránh báo động giả sau khi gỡ bỏ.
    - Hệ thống sử dụng cơ chế so khớp đồng bộ giữa cấu hình Runtime và Logic AI.

## 3. Giao diện thiết lập (UI Editor)
Người dùng có thể thiết lập vùng cấm trực tiếp trong phần **Cài đặt Camera**:
- **Snapshot & Performance**: 
    - Chụp ảnh thực tế từ camera để làm nền vẽ thông qua endpoint `/snapshot`.
    - **Cơ chế Caching**: Snapshot được tích hợp bộ nhớ đệm (TTL 1.5s) giúp giảm tải CPU khi có nhiều yêu cầu đồng thời, đảm bảo không gây gián đoạn luồng xử lý AI chính.
    - **Low-Latency**: Quá trình trích xuất ảnh nền diễn ra bất đồng bộ, sử dụng buffer riêng để duy trì tốc độ khung hình ổn định cho việc giám sát.
- **Vẽ đa giác**: Nhấp chuột để tạo các đỉnh, vùng cấm sẽ tự động đóng kín.
- **Kéo thả**: Các đỉnh đã vẽ có thể được kéo thả để điều chỉnh chính xác vị trí.
- **Đa vùng**: Hỗ trợ vẽ nhiều vùng cấm khác nhau trên cùng một camera.

## 4. Hiển thị & Cảnh báo
- Trên màn hình giám sát, các vùng cấm được hiển thị bằng một lớp phủ màu đỏ mờ.
- Khi có vi phạm:
    - Khung bao quanh người vi phạm sẽ chuyển sang màu đỏ đậm.
    - Xuất hiện nhãn **"⚠️ VÙNG CẤM"** phía trên đầu người đó.
    - Hệ thống ghi nhận trạng thái vi phạm để có thể tích hợp với loa báo động hoặc thông báo về trung tâm.
