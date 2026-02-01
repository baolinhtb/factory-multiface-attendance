import sys
import os

print(f"Python Executable: {sys.executable}")
print(f"Python Version: {sys.version}")
print("Sys Path:")
for p in sys.path:
    print(f"  {p}")

try:
    import faiss
    print(f"FAISS imported successfully from: {faiss.__file__}")
except ImportError as e:
    print(f"FAISS Import Failed: {e}")

try:
    import numpy
    print(f"Numpy imported successfully from: {numpy.__file__}")
except ImportError as e:
    print(f"Numpy Import Failed: {e}")
