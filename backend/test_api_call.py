import requests
import json

# Test the API endpoint directly
BASE_URL = "http://127.0.0.1:8000"

# First login to get token
login_response = requests.post(f"{BASE_URL}/login", data={
    "username": "admin",
    "password": "admin123"
})

print("Login Response:", login_response.status_code)
if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    print("Token obtained successfully")
    
    # Test the calculate-attendance endpoint
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Single employee
    print("\n--- Test 1: Single Employee ---")
    response = requests.post(
        f"{BASE_URL}/calculate-attendance",
        params={
            "employee_id": "NV001",
            "start_date": "2026-01-29",
            "end_date": "2026-01-30"
        },
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
else:
    print("Login failed:", login_response.text)
