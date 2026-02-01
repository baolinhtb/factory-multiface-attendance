# SmartCore Factory AI Attendance System

Hệ thống giám sát nhà máy thông minh sử dụng AI để nhận diện khuôn mặt, phát hiện vi phạm sử dụng điện thoại, và quản lý chấm công tự động.

## 🚀 Quick Start (Khởi động nhanh)

### Cách 1: Sử dụng script tự động ⭐ (Khuyến nghị)

```bash
# Khởi động toàn bộ hệ thống (Backend + Frontend)
./start.sh

# Kiểm tra trạng thái hệ thống
./status.sh

# Dừng toàn bộ hệ thống
./stop.sh
```

### Cách 2: Khởi động thủ công

```bash
# Terminal 1 - Backend
cd backend
./venv/bin/python main.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 📋 Yêu cầu hệ thống

- **Python**: 3.10+
- **Node.js**: 16+ 
- **npm**: 8+
- **Camera**: Webcam hoặc camera IP (RTSP)
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB)
- **CPU**: Hỗ trợ AVX (cho ONNX Runtime)

## 🎯 Tính năng chính

- **Nhận diện khuôn mặt đa người**: Sử dụng **InsightFace** để nhận diện real-time
- **Dashboard hiện đại**: **React + TypeScript** với xác thực JWT
- **Phân quyền RBAC**:
  - **Admin**: Quản lý người dùng, cài đặt hệ thống, cấu hình camera
  - **User**: Xem giám sát trực tiếp và thống kê
- **Cài đặt động**: Thay đổi nguồn camera (USB/RTSP) và tính năng AI qua giao diện
- **Phân tích nhân khẩu học**: Dự đoán **Tuổi** và **Giới tính** tự động
- **Giám sát vi phạm**:
  - **Phát hiện điện thoại**: Sử dụng **YOLOv8**
  - **Cảnh báo người lạ**: Nhận diện người không đăng ký
- **Theo dõi vi phạm**: Thống kê thời gian vi phạm tích lũy
- **Cảnh báo real-time**: Âm thanh và hiệu ứng trực quan

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Authentication**: PyJWT, passlib[bcrypt]
- **AI Models**: 
  - InsightFace (Buffalo_L) - Nhận diện khuôn mặt
  - YOLOv8n - Phát hiện vật thể
- **Computer Vision**: OpenCV
- **Database**: SQLite

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Icons**: Lucide React
- **HTTP Client**: Axios
- **Routing**: React Router DOM

## ⚙️ Cài đặt

### 1. Clone repository

```bash
git clone <repo-url>
cd "factory multiface attendance app"
```

### 2. Cài đặt Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Cài đặt Frontend

```bash
cd ../frontend
npm install --legacy-peer-deps
```

### 4. Khởi động hệ thống

```bash
# Quay về thư mục gốc
cd ..

# Khởi động toàn bộ
./start.sh
```

## 📖 Hướng dẫn sử dụng

### Đăng nhập

1. Mở trình duyệt và truy cập: `http://localhost:3000`
2. Đăng nhập với tài khoản mặc định:
   - **Username**: `admin`
   - **Password**: `admin123`

### Đăng ký nhân viên

1. Vào menu **Cài đặt hệ thống**
2. Tìm phần **Đăng ký khuôn mặt mới**
3. Nhập họ tên nhân viên
4. Chọn ảnh chân dung rõ nét
5. Click **Đăng Ký Nhận Diện**

### Giám sát

- **Dashboard** hiển thị video stream trực tiếp
- Cảnh báo tự động khi phát hiện:
  - Người lạ (chưa đăng ký)
  - Sử dụng điện thoại
- Xem thống kê vi phạm ở panel bên phải

### Quản lý người dùng (Admin)

1. Vào menu **Quản lý tài khoản**
2. Thêm/xóa tài khoản hệ thống
3. Phân quyền Admin/User

### Cài đặt hệ thống (Admin)

- Thay đổi nguồn camera (0 cho webcam, hoặc URL RTSP)
- Bật/tắt hiển thị tuổi và giới tính
- Bật/tắt phát hiện điện thoại
- Bật/tắt chuông báo

## 📁 Cấu trúc dự án

```
├── backend/
│   ├── main.py              # File chạy chính (Wrapper)
│   ├── api/                 # Cấu hình API và xác thực
│   │   ├── main.py          # Khởi tạo FastAPI và các Routes
│   │   └── auth.py          # Xử lý JWT và phân quyền
│   ├── core/                # Thuật toán và Logic cốt lõi
│   │   ├── camera_stream.py # Xử lý luồng video và AI Pipeline
│   │   ├── face_recognizer.py # Nhận diện khuôn mặt (FAISS)
│   │   ├── fall_detector.py # Thuật toán phát hiện ngã
│   │   ├── fire_detector.py # Thuật toán phát hiện cháy
│   │   ├── attendance_calculator.py # Logic chấm công và tăng ca
│   │   └── ollama_chat.py   # Tích hợp AI Assistant (Ollama)
│   ├── db/                  # Tầng truy xuất dữ liệu
│   │   └── database.py      # Quản lý SQLite và Schema
│   ├── data/                # Nơi lưu trữ dữ liệu bền vững
│   │   └── attendance.db    # File cơ sở dữ liệu chính
│   ├── scripts/             # Các script bảo trì và công cụ
│   ├── models/              # Chứa các file trọng số AI (.pt)
│   └── requirements.txt     # Thư viện Python cần thiết
├── frontend/
│   └── src/                 # Source code React (TypeScript)
├── logs/                    # Nhật ký hệ thống
├── start.sh                 # 🚀 Script khởi động nhanh
├── stop.sh                  # 🛑 Script dừng hệ thống
└── status.sh                # 📊 Script kiểm tra trạng thái
```

## 🔧 Scripts

### start.sh
Khởi động toàn bộ hệ thống (backend + frontend) với health checks tự động.

**Features**:
- Kiểm tra virtual environment
- Kiểm tra node_modules
- Đợi backend khởi động hoàn tất
- Đợi frontend sẵn sàng
- Lưu PIDs để quản lý
- Hiển thị thông tin truy cập

### stop.sh
Dừng tất cả services một cách an toàn.

**Features**:
- Graceful shutdown (SIGTERM)
- Force kill nếu cần (SIGKILL)
- Dọn dẹp orphaned processes
- Xóa PID files

### status.sh
Kiểm tra trạng thái chi tiết của hệ thống.

**Features**:
- Kiểm tra PIDs
- Kiểm tra ports (8000, 3000)
- Health checks (HTTP requests)
- Thông tin database
- Thông tin logs

## 📊 Logs

Logs được lưu tự động trong thư mục `logs/`:

```bash
# Xem backend logs real-time
tail -f logs/backend.log

# Xem frontend logs real-time
tail -f logs/frontend.log
```

## ⚠️ Lưu ý quan trọng

- **Ánh sáng**: Đảm bảo khuôn mặt được chiếu sáng tốt khi đăng ký
- **Camera**: Webcam mặc định là ID 0, có thể thay đổi trong Settings
- **Browser**: Khuyến nghị Chrome hoặc Edge
- **Audio**: Click vào nút chuông để kích hoạt âm thanh cảnh báo
- **CORS**: Backend đã cấu hình CORS cho localhost:3000

## 🐛 Troubleshooting

### Backend không khởi động

```bash
# Kiểm tra Python version
python3 --version  # Cần >= 3.10

# Kiểm tra virtual environment
cd backend
source venv/bin/activate
pip list
```

### Frontend không build

```bash
# Xóa và cài lại dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Database bị lỗi

```bash
# Xóa và tạo lại database
rm backend/attendance.db
# Khởi động lại backend sẽ tự tạo database mới
```

### Port đã được sử dụng

```bash
# Kiểm tra process đang dùng port 8000
lsof -i :8000

# Kiểm tra process đang dùng port 3000
lsof -i :3000

# Kill process nếu cần
kill -9 <PID>
```

## 🗺 Roadmap

### ✅ Đã hoàn thành
- [x] Nhận diện khuôn mặt đa người
- [x] Phát hiện điện thoại
- [x] Dashboard React + TypeScript
- [x] JWT Authentication
- [x] RBAC (Admin/User)
- [x] Cài đặt động qua UI
- [x] WebSocket streaming
- [x] Cảnh báo real-time
- [x] Thống kê vi phạm
- [x] Scripts tự động hóa

### 🚀 Kế hoạch tương lai
- [ ] Liveness detection (chống giả mạo)
- [ ] Export báo cáo Excel/CSV
- [ ] Multi-camera support
- [ ] PostgreSQL migration
- [ ] Docker deployment
- [ ] Mobile app (React Native)
- [ ] Email notifications
- [ ] Attendance reports

## 📄 License

MIT License - Xem file LICENSE để biết thêm chi tiết.

## 👥 Contributors

Developed as part of the SmartCore AI Factory Attendance Solution.

---

**🎉 Chúc bạn sử dụng hệ thống hiệu quả!**

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ team support.
