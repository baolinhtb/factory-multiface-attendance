# Hướng dẫn Deploy Trên Orange Pi 5 Max (NPU RK3588)

Orange Pi 5 Max sử dụng chip **Rockchip RK3588** với bộ tăng tốc **NPU 6TOPS**, cho phép chạy AI nhanh gấp 20-30 lần so với chạy trên CPU.

Để tận dụng sức mạnh này, bạn KHÔNG THỂ chỉ chạy file `yolov8n.pt` (PyTorch) thông thường. Bạn phải thực hiện quy trình "chuyển đổi" mô hình sang định dạng `.rknn` chuyên dụng.

---

## 🚀 Quy trình Nhanh (Quick Start)

Nếu bạn muốn chạy ngay lập tức mà chưa convert model:
1.  **Chuyển Camera sang `Sub Stream`**:
    *   Vào `Quản lý Camera` trên Web.
    *   Sửa URL RTSP thêm `&subtype=1` vào cuối.
    *   **Kết quả**: Tốc độ tăng gấp 3-4 lần, độ trễ giảm xuống < 0.5s.
    
2.  **Tối ưu Code (Đã tự động)**:
    *   Code backend đã được cập nhật để tự nhận diện `Orange Pi` (aarch64) và tối ưu hóa luồng CPU.

---

## ⚡ Quy trình Nâng cao: Sử dụng NPU (RKNN)

Để đạt tốc độ tối đa (Real-time 30-60 FPS nhận diện), bạn cần làm theo các bước sau:

### Bước 1: Chuẩn bị Môi trường Convert (trên PC/Mac)
Bạn cần máy tính chạy Ubuntu (hoặc Docker) x86_64 để convert model.
1.  Cài đặt `rknn-toolkit2` từ Rockchip.
2.  Tải model YOLOv8 (file `.pt` hoặc `.onnx`).
3.  Chạy script convert sang `.rknn`.

### Bước 2: Cài đặt trên Orange Pi 5
Trên Orange Pi, cài thư viện Python để gọi NPU:

```bash
# Cài đặt RKNN Toolkit Lite 2
pip install rknn-toolkit-lite2
```
*Lưu ý: Môi trường Orange Pi OS (Ubuntu 22.04) thường đã có sẵn hoặc cài từ file wheel do hãng cung cấp.*

### Bước 3: Cấu hình Backend
1.  Copy file model đã convert (ví dụ `yolov8n.rknn`) vào thư mục `backend/models/`.
2.  Hệ thống sẽ tự động phát hiện file `.rknn` và ưu tiên sử dụng NPU thay vì CPU.

---

### Mẹo Tối ưu Khác
1.  **Tản nhiệt**: Orange Pi 5 Max rất mạnh nhưng nóng. Hãy gắn quạt tản nhiệt để không bị giảm xung (throttle).
2.  **Nguồn điện**: Sử dụng nguồn chuẩn PD 30W trở lên để đảm bảo NPU hoạt động ổn định.
