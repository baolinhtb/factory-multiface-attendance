
# Hệ thống Nhận diện Khuôn mặt & Chấm công (Face Attendance)

## 1. Công nghệ lõi
Sử dụng thư viện **InsightFace** - một trong những bộ công cụ nhận diện khuôn mặt mạnh mẽ và chính xác nhất hiện nay.

## 2. Quy trình xử lý
1.  **Phát hiện (Detection)**: Sử dụng mô hình RetinaFace để tìm vị trí khuôn mặt trong frame.
2.  **Trích xuất đặc trưng (Feature Extraction)**: Chuyển đổi hình ảnh khuôn mặt thành một vector đặc trưng (Embedding) 512 chiều.
3.  **Nhận dạng (Identification)**:
    *   So sánh vector đặc trung vừa trích xuất với cơ sở dữ liệu nhân viên (đã được lưu trong `FaceRecognizer`).
    *   Sử dụng độ đo Cosine Similarity để tìm khuôn mặt giống nhất.
    *   Ngưỡng mặc định: `0.45`. Nếu độ tương đồng thấp hơn ngưỡng này, người dùng sẽ được đánh dấu là "Người lạ".

## 3. Ghi nhận chấm công (Attendance Logging)
- **Tự động hóa**: Khi nhận diện đúng nhân viên, hệ thống sẽ kiểm tra trạng thái hiện diện.
- **Log Vào/Ra**: Tự động ghi log "Vào" (`enter`) khi thấy mặt và log "Ra" (`leave`) nếu nhân viên rời khỏi khung hình quá 10 giây.
- **Chống trùng lặp**: Log chấm công (`log_attendance`) được giới hạn tần suất (mặc định 10 giây/lần) để tránh rác dữ liệu trong DB.

## 4. Tích hợp Tư thế (Pose Integration)
Hệ thống sử dụng thuật toán **Hybrid Assignment** để kết quả nhận diện khuôn mặt bám theo khung xương AI. Điều này giúp hệ thống vẫn biết nhân viên đó là ai ngay cả khi họ quay lưng lại hoặc cúi xuống, miễn là ID tracking của Pose vẫn được giữ vững.
