# Fire Detection Model Setup Guide

## Tổng quan
Hệ thống đã được tích hợp tính năng phát hiện lửa (Fire Detection) sử dụng YOLO model.

## Cách sử dụng

### Option 1: Sử dụng Custom Fire Detection Model (Khuyến nghị)

1. **Tải model fire detection đã được train:**
   - Tìm kiếm model fire detection trên:
     - Roboflow: https://universe.roboflow.com/search?q=fire%20detection
     - Ultralytics Hub: https://hub.ultralytics.com/
     - GitHub: Tìm "fire detection yolov8"
   
2. **Đặt model vào thư mục backend:**
   ```bash
   cd backend
   # Tải model về (ví dụ)
   wget https://example.com/fire_detection.pt
   # Hoặc copy file đã tải
   cp /path/to/fire_detection.pt ./fire_detection.pt
   ```

3. **Model sẽ tự động được load khi khởi động:**
   - Hệ thống sẽ tìm file `fire_detection.pt` trong thư mục backend
   - Nếu tìm thấy, sẽ sử dụng model này cho fire detection
   - Nếu không tìm thấy, sẽ fallback về YOLO standard (khả năng phát hiện lửa hạn chế)

### Option 2: Train Model riêng

1. **Chuẩn bị dataset:**
   - Thu thập ảnh có lửa và không có lửa
   - Label dataset sử dụng tools như Roboflow, LabelImg
   - Export dataset ở định dạng YOLOv8

2. **Train model:**
   ```python
   from ultralytics import YOLO
   
   # Load pretrained model
   model = YOLO('yolov8n.pt')
   
   # Train on fire dataset
   results = model.train(
       data='fire_dataset/data.yaml',
       epochs=100,
       imgsz=640,
       batch=16,
       name='fire_detection'
   )
   
   # Export trained model
   model.export(format='pt')
   ```

3. **Copy model đã train vào backend:**
   ```bash
   cp runs/detect/fire_detection/weights/best.pt backend/fire_detection.pt
   ```

### Option 3: Sử dụng Pretrained Model từ Ultralytics

Một số model có sẵn:
- `yolov8n.pt` - Nano (nhanh nhất, độ chính xác thấp)
- `yolov8s.pt` - Small
- `yolov8m.pt` - Medium
- `yolov8l.pt` - Large
- `yolov8x.pt` - Extra Large (chính xác nhất, chậm nhất)

## Cấu hình

### Backend Settings
File: `backend/camera_stream.py`

```python
# Điều chỉnh confidence threshold
fire_results = self.fire_yolo(frame_to_process, conf=0.3, verbose=False)

# Điều chỉnh cooldown giữa các alerts (giây)
self.fire_alert_cooldown = 10
```

### Class ID Configuration
Nếu sử dụng custom model, cần điều chỉnh class_id trong `camera_stream.py`:

```python
# Line ~280
if 'fire' in class_name or class_id == 0:  # Adjust class_id based on your model
```

Thay `class_id == 0` bằng ID của class "fire" trong model của bạn.

## Bật/Tắt Fire Detection

1. Vào **Settings** (Thiết lập)
2. Tìm toggle **"Phát hiện lửa"** (Fire Detection)
3. Bật/tắt theo nhu cầu
4. Nhấn **"Lưu tất cả thay đổi"**

## Kiểm tra hoạt động

1. Khởi động hệ thống
2. Kiểm tra logs backend:
   ```bash
   tail -f logs/backend.log
   ```
   
3. Tìm dòng:
   - `"Custom fire detection model loaded"` - Model custom đã load
   - `"Using standard YOLO for fire detection"` - Đang dùng fallback

4. Khi phát hiện lửa:
   - Màn hình camera sẽ hiển thị khung đỏ với label "🔥 LỬA PHÁT HIỆN"
   - Dashboard sẽ hiển thị cảnh báo
   - Chuông báo động sẽ kêu (nếu bật)
   - Log console: `[FIRE ALERT] Fire detected at ...`

## Recommended Fire Detection Models

### Free Models:
1. **Fire-Detection-YOLOv8** (GitHub)
   - https://github.com/spacewalk01/yolov8-fire-detection
   
2. **Roboflow Fire Dataset**
   - https://universe.roboflow.com/fire-detection-qpdjy/fire-detection-system

### Commercial Models:
- Ultralytics HUB (có phí)
- Custom training service

## Troubleshooting

### Model không load được:
```
ERROR: Could not load fire_detection.pt
```
**Giải pháp:**
- Kiểm tra file có tồn tại: `ls -la backend/fire_detection.pt`
- Kiểm tra quyền đọc file
- Đảm bảo file là YOLOv8 format (.pt)

### Không phát hiện được lửa:
**Giải pháp:**
- Giảm confidence threshold (từ 0.3 xuống 0.2)
- Kiểm tra class_id có đúng không
- Thử với model khác có độ chính xác cao hơn
- Đảm bảo lighting tốt trong camera

### False positives (báo nhầm):
**Giải pháp:**
- Tăng confidence threshold (từ 0.3 lên 0.4-0.5)
- Train lại model với dataset tốt hơn
- Tăng fire_alert_cooldown để giảm spam alerts

## Performance Tips

1. **Tối ưu tốc độ:**
   - Dùng model nano (yolov8n)
   - Giảm resolution: `det_size=(320, 320)`

2. **Tối ưu độ chính xác:**
   - Dùng model large (yolov8l)
   - Tăng resolution: `det_size=(640, 640)`
   - Train custom model với dataset lớn

3. **Cân bằng:**
   - Dùng yolov8s hoặc yolov8m
   - Resolution 416x416 hoặc 512x512
