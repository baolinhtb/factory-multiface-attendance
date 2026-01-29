# SmartFactory: AI-Powered Face Attendance & Security System

A comprehensive AI monitoring system designed for factory environments. It tracks employee attendance via facial recognition, predicts demographics (age/gender), detects workplace violations (phone usage), and provides real-time audio-visual alerts.

## 🚀 Key Features

- **Multi-Face Recognition**: Real-time identification of registered employees using **InsightFace**.
- **Secured Web Portal**: Modern **React + TypeScript** dashboard with JWT authentication.
- **RBAC (Role-Based Access Control)**:
  - **Admin**: Full control over user management, system settings, and camera configuration.
  - **General User**: Access to live monitoring and attendance statistics.
- **Dynamic System Settings**: Change camera sources (USB/RTSP) and toggle AI features (Phone Detection, Age/Gender display, Alarm sound) via the UI.
- **Demographic Analysis**: Automatic prediction of **Age** and **Gender** for every detected face.
- **Violation Monitoring**: 
  - **Phone Detection**: Detects mobile phone usage using **YOLOv8**.
  - **Unknown Person Alerts**: Identifies non-registered individuals.
- **Violation Tracking**: Persistent statistics of cumulative violation time per user.
- **Real-time Alerts**: Adaptive audio warnings and visual indicators.

## 🛠 Tech Stack

- **Backend**: Python 3.10+, FastAPI, PyJWT, passlib[bcrypt], OpenCV, InsightFace, YOLOv8.
- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Axios.
- **Database**: SQLite (Centralized storage for users, settings, and face embeddings).
- **Image Processing**: Pillow (PIL) for high-quality Unicode text rendering on video frames.

## 📋 Prerequisites

- **Python 3.10+**
- **Webcam** or IP Camera source.
- **Build Tools**: Standard C++ Build Tools (required for installing InsightFace/ONNX dependencies).

## ⚙️ Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd "factory multiface attendance app"
   ```

2. **Setup Virtual Environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Initialize Models**:
   The first time the application runs, it will automatically download necessary models (InsightFace Buffalo_L and YOLOv8n). This may take several minutes depending on your internet speed.

## 🏃 Usage

1. **Start the Backend**:
   Navigate to the `backend` directory and run:
   ```bash
   python main.py
   ```
   The backend server will start at `http://127.0.0.1:8000`.

2. **Open the Dashboard**:
   Open the `frontend/index.html` file in any modern web browser (Google Chrome or Microsoft Edge recommended).

3. **Register Employees**:
   - Enter the full name in the "Đăng Ký Nhân Viên" section.
   - Select a clear, well-lit portrait photo.
   - Click the "ĐĂNG KÝ" button.

4. **Monitoring & Alerts**:
   - The live video stream identifies registered employees.
   - Violation alerts for "Unknown Persons" or "Phone Usage" are logged immediately.
   - View the cumulative usage time in the **"Top Vi Phạm ĐT"** statistics column.

## 📁 Project Structure

```text
├── backend/
│   ├── main.py            # FastAPI entry point & WebSocket server
│   ├── camera_stream.py    # Core AI logic (Recognition, YOLO, DemoG)
│   ├── database.py        # SQLite Database management
│   ├── attendance.db      # Auto-generated database file
│   └── requirements.txt   # Python dependencies
├── frontend/
│   └── index.html         # Unified web interface (Video + Logs + Stats)
└── README.md              # English Documentation
```

## ⚠️ Important Notes
- **Audio Activation**: Modern browsers block auto-playing audio. Please click the **"Máy báo: BẬT"** button on the dashboard to enable warnings.
- **Lighting**: For best recognition results, ensure faces are well-lit and facing the camera directly during registration.
- **Sensitivity**: Phone detection is tuned to a low confidence threshold (0.15) to catch quick movements; adjust in `camera_stream.py` if needed.

---
*Developed as part of the SmartCore AI Factory Attendance Solution.*

## 🗺 Development Roadmap & Status

Below is the implementation status following the initial project plan:

### ✅ Phase 1: Core Foundation (Completed)
- [x] **Real-time Multiface Detection**: High-performance detection using InsightFace.
- [x] **Employee Recognition**: Accurate matching against stored vector embeddings.
- [x] **Vietnamese Support**: Full localization of UI and video text overlays.
- [x] **Photo Registration**: Simple web-based interface for enrolling new staff.

### ✅ Phase 2: Advanced Monitoring (Completed)
- [x] **Demographic Prediction**: Real-time Age and Gender estimation.
- [x] **Security Alerts**: Instant detection of unauthorized/unknown personnel.
- [x] **Violation Detection**: AI-driven mobile phone usage monitoring (YOLOv8).
- [x] **Usage Analytics**: Persistent tracking of cumulative violation time.
- [x] **Audio Alert System**: Web Audio API integration for immediate on-site feedback.

### 🚀 Phase 3: Future Enhancements (Planned)
- [ ] **Attendance Records**: Automated logs for entry/exit times with daily reporting.
- [ ] **HR Export Tools**: Export violation and attendance data to CSV/Excel formats.
- [ ] **Liveness Detection**: Anti-spoofing technology to prevent bypass using photos/videos.
- [ ] **User Management**: Admin portal to edit, deactivate, or delete employee profiles.
- [ ] **Multi-Camera Support**: Unified dashboard for monitoring multiple factory zones.
- [ ] **Enterprise Database**: Migration path from SQLite to PostgreSQL for high-scale environments.
