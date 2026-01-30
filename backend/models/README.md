# AI Models Directory

Thư mục này chứa các AI models được sử dụng trong hệ thống.

## Cấu trúc:

```
models/
├── README.md                 # File này
├── yolov8n.pt               # YOLO model cho object detection (phone)
├── fire_detection.pt        # Custom fire detection model
└── face_recognition/        # Face recognition models (InsightFace)
```

## Models hiện tại:

### 1. YOLO26 (Object Detection)
- **File**: `yolo26n.pt`
- **Mục đích**: Phát hiện điện thoại (phone detection)
- **Download**: Tự động tải (hoặc dùng script `download_models.py`)

### 2. YOLO26-Pose (Pose Detection)
- **File**: `yolo26n-pose.pt`
- **Mục đích**: Phát hiện tư thế không an toàn
- **Download**: Tự động tải (hoặc dùng script `download_models.py`)

### 3. Fire Detection Model
- **File**: `fire_detection.pt`
- **Mục đích**: Phát hiện lửa (fire detection)
- **Download**: Cần tải thủ công hoặc train riêng
- **Hướng dẫn**: Xem `../FIRE_DETECTION_SETUP.md`

### 3. InsightFace (Face Recognition)
- **Thư mục**: `~/.insightface/` (auto-download)
- **Model**: buffalo_l
- **Mục đích**: Nhận diện khuôn mặt nhân viên
- **Source**: InsightFace

## Cách thêm model mới:

1. **Tải model về thư mục này:**
   ```bash
   cd backend/models
   wget https://example.com/your_model.pt
   ```

2. **Cập nhật `camera_stream.py`:**
   ```python
   self.your_model = YOLO('models/your_model.pt')
   ```

3. **Cập nhật file này** để document model mới

## Lưu ý:

- ⚠️ **Không commit** các file model (.pt) vào Git (đã thêm vào .gitignore)
- 📦 Models thường rất lớn (>100MB)
- 🔄 Sử dụng Git LFS hoặc external storage nếu cần share
- 📝 Document rõ ràng source và version của mỗi model
