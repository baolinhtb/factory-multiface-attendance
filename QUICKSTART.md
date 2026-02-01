# 🚀 SmartCore - Hướng dẫn sử dụng nhanh

## Khởi động hệ thống

```bash
./start.sh
```

Sau khi chạy lệnh trên, hệ thống sẽ:
1. ✅ Khởi động Backend (FastAPI) trên port 8000
2. ✅ Khởi động Frontend (React + Vite) trên port 3000
3. ✅ Tự động kiểm tra health của các service
4. ✅ Hiển thị thông tin đăng nhập và URL truy cập

## Truy cập hệ thống

Mở trình duyệt và vào: **http://localhost:3000**

**Đăng nhập mặc định:**
- Username: `admin`
- Password: `admin123`

## Kiểm tra trạng thái

```bash
./status.sh
```

Lệnh này sẽ hiển thị:
- ✅ Trạng thái Backend (Running/Stopped)
- ✅ Trạng thái Frontend (Running/Stopped)
- ✅ Thông tin Database
- ✅ Thông tin Logs
- ✅ Health checks (API responding)

## Dừng hệ thống

```bash
./stop.sh
```

Lệnh này sẽ:
1. ✅ Dừng Frontend gracefully
2. ✅ Dừng Backend gracefully
3. ✅ Dọn dẹp orphaned processes
4. ✅ Xóa PID files

## Xem logs

```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs
tail -f logs/frontend.log
```

## Các tính năng chính

### 1. Dashboard (Tổng quan)
- 📹 Video stream trực tiếp
- 🚨 Cảnh báo real-time
- 📊 Thống kê vi phạm điện thoại

### 2. Quản lý tài khoản (Admin only)
- ➕ Thêm user mới
- 🗑️ Xóa user
- 👤 Phân quyền Admin/User

### 3. Cài đặt hệ thống (Admin only)
- 📷 Thay đổi nguồn camera
- 🎭 Bật/tắt hiển thị tuổi & giới tính
- 📱 Bật/tắt phát hiện điện thoại
- 🔔 Bật/tắt chuông báo
- 👤 Đăng ký khuôn mặt nhân viên

## Troubleshooting

### Lỗi: Port already in use

```bash
# Kiểm tra process đang dùng port
lsof -i :8000  # Backend
lsof -i :3000  # Frontend

# Dừng hệ thống
./stop.sh
```

### Lỗi: Backend không khởi động

```bash
cd backend
source venv/bin/activate
python main.py
# Xem lỗi chi tiết
```

### Lỗi: Frontend không build

```bash
cd frontend
rm -rf node_modules
npm install --legacy-peer-deps
npm run dev
```

### Lỗi: Database

```bash
# Xóa và tạo lại
rm backend/data/attendance.db
./start.sh
```

## Cấu trúc thư mục quan trọng

```
.
├── start.sh          # 🚀 Khởi động
├── stop.sh           # 🛑 Dừng
├── status.sh         # 📊 Kiểm tra
├── backend/          # Python FastAPI
├── frontend/         # React + TypeScript
└── logs/             # Log files
```

## Liên hệ & Hỗ trợ

- 📖 Xem README.vi.md để biết chi tiết đầy đủ
- 🐛 Báo lỗi: Tạo issue trên GitHub
- 💬 Hỗ trợ: Contact team SmartCore

---

**Chúc bạn sử dụng hiệu quả! 🎉**
