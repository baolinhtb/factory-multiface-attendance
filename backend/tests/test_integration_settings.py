
from fastapi.testclient import TestClient
from api.main import app
import pytest
from api.main import app
from api import auth
import pytest

# Mock Auth
def mock_get_current_user():
    return {"username": "test", "id": 1, "role": "admin"}

def mock_get_admin_user():
    return {"username": "admin", "id": 1, "role": "admin"}

app.dependency_overrides[auth.get_current_user] = mock_get_current_user
app.dependency_overrides[auth.get_admin_user] = mock_get_admin_user

client = TestClient(app)

def test_create_camera_with_valid_settings():
    """Test creating a camera with valid custom settings."""
    payload = {
        "name": "Integration Test Cam",
        "type": "usb",
        "source": "0",
        "is_active": 1,
        "description": "Test Camera",
        "settings": {
            "face_recognition_threshold": 0.55,
            "enable_fire_det": True
        }
    }
    response = client.post("/cameras", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Camera added"
    cam_id = data["id"]
    
    # Retrieve and verify
    get_res = client.get("/cameras")
    cameras = get_res.json()
    my_cam = next((c for c in cameras if c["id"] == cam_id), None)
    assert my_cam is not None
    assert my_cam["name"] == "Integration Test Cam"
    # Settings should be a dict if the Pydantic response model parses it, 
    # OR it might be a JSON string if the API model for response defines it as such.
    # Let's check api/main.py response model. It usually uses CameraRow which might output settings as dict if handled.
    # But wait, database stores TEXT. API needs to parse it?
    # Our update to database.py `get_all_cameras` handles parsing.
    assert isinstance(my_cam["settings"], dict)
    assert my_cam["settings"]["face_recognition_threshold"] == 0.55

def test_create_camera_invalid_settings_value():
    """Test validation: threshold > 1.0 should fail."""
    payload = {
        "name": "Invalid Cam",
        "type": "usb",
        "source": "0",
        "settings": {
            "face_recognition_threshold": 1.5 
        }
    }
    response = client.post("/cameras", json=payload)
    # FastApi Pydantic validation error is usually 422
    assert response.status_code == 422

def test_update_camera_settings_bulk():
    """Test bulk update endpoint."""
    # Create two cameras
    c1 = client.post("/cameras", json={"name": "Bulk1", "type": "usb", "source": "1"}).json()
    c2 = client.post("/cameras", json={"name": "Bulk2", "type": "usb", "source": "2"}).json()
    
    ids = [c1["id"], c2["id"]]
    
    bulk_payload = {
        "camera_ids": ids,
        "settings": {
            "phone_detection_confidence": 0.88,
            "enable_pose_det": False
        }
    }
    
    res = client.post("/cameras/bulk-settings", json=bulk_payload)
    assert res.status_code == 200
    
    # Verify updates
    get_res = client.get("/cameras")
    cameras = get_res.json()
    
    cam1 = next(c for c in cameras if c["id"] == c1["id"])
    cam2 = next(c for c in cameras if c["id"] == c2["id"])
    
    assert cam1["settings"]["phone_detection_confidence"] == 0.88
    assert cam2["settings"]["phone_detection_confidence"] == 0.88
    assert cam1["settings"]["enable_pose_det"] is False

def test_extra_fields_allowed():
    """Test that extra fields in settings are allowed."""
    payload = {
        "name": "Extra Fields Cam",
        "type": "usb",
        "source": "0",
        "settings": {
            "custom_weird_setting": "foobar",
            "face_recognition_threshold": 0.45
        }
    }
    response = client.post("/cameras", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Fetch back
    get_res = client.get("/cameras")
    cameras = get_res.json()
    my_cam = next(c for c in cameras if c["id"] == data["id"])
    
    assert "custom_weird_setting" in my_cam["settings"]
    assert my_cam["settings"]["custom_weird_setting"] == "foobar"
