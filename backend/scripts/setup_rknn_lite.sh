#!/bin/bash
# Install RKNN Toolkit Lite 2 for Orange Pi 5 (Ubuntu 20.04/22.04)

echo "Starting Orange Pi 5 NPU Setup..."
if [ "$(uname -m)" != "aarch64" ]; then
    echo "⚠️ This script is intended for Orange Pi 5 (aarch64)."
    echo "You seem to be running on $(uname -m). Continue? (y/n)"
    read answer
    if [ "$answer" != "y" ]; then exit 1; fi
fi

# 1. Update system dependencies
sudo apt-get update
sudo apt-get install -y python3-dev python3-pip cmake
sudo apt-get install -y libopencv-dev python3-opencv

# 2. Check Python version (RKNN Lite usually supports 3.8/3.9/3.10)
python3 --version

# 3. Install RKNN Toolkit Lite 2
# Note: Usually this needs the specific .whl from Rockchip GitHub or Orange Pi repos.
# We will try to clone and install for Python 3.10 or 3.8 based on typical Ubuntu version.

if pip3 list | grep -F rknn-toolkit-lite2 > /dev/null; then
    echo "✅ rknn-toolkit-lite2 is already installed."
else
    echo "Downloading rknn-toolkit-lite2..."
    git clone https://github.com/rockchip-linux/rknn-toolkit2
    cd rknn-toolkit2/rknn-toolkit-lite2/packages
    
    # Try install matching wheel
    # e.g. rknn_toolkit_lite2-2.0.0b0-cp310-cp310-linux_aarch64.whl
    pip3 install rknn_toolkit_lite2*.whl
    
    if [ $? -eq 0 ]; then
        echo "✅ Installation successful!"
    else
        echo "❌ Automated installation failed."
        echo "Please manually install the wheel from 'rknn-toolkit2/rknn-toolkit-lite2/packages'"
        exit 1
    fi
fi

echo "NPU Setup Complete."
