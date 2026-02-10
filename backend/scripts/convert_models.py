import os
import sys
import shutil
import argparse
import torch
import onnx
from ultralytics import YOLO

# This script must run on x86_64 host (PC/Mac/Docker)
# Prereqs: pip install ultralytics torch onnx onnxruntime rknn-toolkit2

try:
    from rknn.api import RKNN
    RKNN_AVAILABLE = True
except ImportError:
    RKNN_AVAILABLE = False
    print("WARNING: rknn-toolkit2 NOT found.")
    print("Cannot proceed with .rknn conversion.")
    print("Please install rknn-toolkit2 (x86_64 Linux).")
    print("Usually: docker run -it --rm --privileged -v $(pwd):/workspace rockchip/rknn-toolkit2:latest-cp38 /bin/bash")
    import sys
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Convert YOLOv8 .pt to Rockchip .rknn")
    parser.add_argument("--model", type=str, required=True, help="Path to .pt model")
    parser.add_argument("--platform", type=str, default="rk3588", help="Target platform (rk3588)")
    parser.add_argument("--optimize", action="store_true", help="Try to quantize to i8")
    args = parser.parse_args()
    
    model_path = args.model
    model_name = os.path.splitext(os.path.basename(model_path))[0]
    onnx_path = f"{model_name}.onnx"
    rknn_path = f"{model_name}.rknn"
    
    # 1. Export PT -> ONNX
    print(f"Step 1: Exporting {model_path} to ONNX...")
    model = YOLO(model_path)
    # Simplify=True is crucial for RKNN compatibility
    # Opset=12 or 11 is usually safest for RKNN
    model.export(format="onnx", opset=12, simplify=True)
    
    if not os.path.exists(onnx_path):
        # Maybe ultralytics exported to different path? Check default
        # Ultralytics usually saves to same dir as pt
        onnx_path = os.path.splitext(model_path)[0] + ".onnx"
    
    if not os.path.exists(onnx_path):
        print(f"ERROR: Export failing. Cannot find {onnx_path}")
        return

    # 2. Convert ONNX -> RKNN
    print(f"Step 2: Converting {onnx_path} to RKNN ({args.platform})...")
    
    rknn = RKNN(verbose=True)
    
    # Config for RK3588
    rknn.config(target_platform=args.platform, optimization_level=3)
    
    print("Loading ONNX model (can check inputs)...")
    # For YOLOv8n (640x640), input is usually 'images' -> [1, 3, 640, 640]
    ret = rknn.load_onnx(model=onnx_path)
    if ret != 0:
        print("Load ONNX failed!")
        return

    print("Building RKNN model...")
    # do_quantization=False for FP16 (safer/easier first step). Only do True if you have dataset.txt for calibration.
    ret = rknn.build(do_quantization=False)
    if ret != 0:
        print("Build RKNN failed!")
        return

    print(f"Exporting to {rknn_path}...")
    ret = rknn.export_rknn(rknn_path)
    if ret != 0:
        print("Export RKNN failed!")
        return
        
    rknn.release()
    print("------------------------------------------------")
    print(f"SUCCESS! Model saved to: {rknn_path}")
    print("Now copy this file to 'backend/models/' on your Orange Pi 5.")
    print("------------------------------------------------")

if __name__ == "__main__":
    main()
