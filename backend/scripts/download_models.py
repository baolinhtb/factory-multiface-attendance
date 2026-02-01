
import os
import requests
import shutil

# YOLO26 Models - Official release v8.4.0 from https://github.com/ultralytics/ultralytics
MODELS = {
    "yolo26n.pt": "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26n.pt",
    "yolo26n-pose.pt": "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26n-pose.pt"
}

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")

def download_file(url, target_path):
    print(f"Downloading {url} to {target_path}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(target_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"✓ Downloaded {target_path}")
        return True
    except Exception as e:
        print(f"❌ Error downloading {target_path}: {e}")
        return False

def main():
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
        print(f"Created directory: {MODELS_DIR}")

    print("--- Downloading YOLO26 Models ---")
    print("Note: Downloading latest YOLO11 models and configuring as YOLO26...")
    
    for filename, url in MODELS.items():
        target_path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(target_path):
            print(f"ℹ️ {filename} already exists. Skipping.")
        else:
            download_file(url, target_path)

    print("\n✓ Model setup complete!")
    print(f"Models are located in: {MODELS_DIR}")

if __name__ == "__main__":
    main()
