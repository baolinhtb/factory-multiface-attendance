import cv2
import numpy as np
import os
import time

try:
    from rknnlite.api import RKNNLite
    RKNN_AVAILABLE = True
except ImportError:
    RKNN_AVAILABLE = False

class RKNNYolo:
    def __init__(self, model_path, conf_thres=0.25, iou_thres=0.45):
        if not RKNN_AVAILABLE:
            raise ImportError("rknnlite.api not found. Please install rknn-toolkit-lite2 on Orange Pi.")
            
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres
        self.target_size = (640, 640)
        
        # Initialize RKNN
        self.rknn = RKNNLite()
        
        print(f"[RKNN] Loading model: {model_path}")
        if self.rknn.load_rknn(model_path) != 0:
            raise Exception("Load RKNN model failed")
            
        if self.rknn.init_runtime(core_mask=RKNNLite.NPU_CORE_0) != 0:
            raise Exception("Init RKNN runtime failed")
            
        print("[RKNN] NPU Runtime Initialized!")
        
        # COCO Classes (80)
        self.classes = {0: 'person', 67: 'cell phone'} # We only care about these usually

    def preprocess(self, img):
        """
        Resize image to 640x640 with letterbox and normalize.
        """
        h, w = img.shape[:2]
        self.img_h, self.img_w = h, w
        
        # Letterbox
        scale = min(self.target_size[0] / h, self.target_size[1] / w)
        nw, nh = int(w * scale), int(h * scale)
        
        img_resized = cv2.resize(img, (nw, nh))
        
        # Create canvas
        canvas = np.zeros((self.target_size[0], self.target_size[1], 3), dtype=np.uint8)
        canvas[:nh, :nw] = img_resized
        
        self.scale = scale
        self.pad_w = (self.target_size[1] - nw) // 2 # Actually we doing top-left alignment here for simplicity
        self.pad_h = (self.target_size[0] - nh) // 2
        
        # For RKNN YOLOv8, usually expects RGB [0-255] or [0-1] depending on conversion
        # Standard Ultralytics export for RKNN typically expects RGB uint8
        input_data = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        input_data = np.expand_dims(input_data, 0)
        return input_data

    def postprocess(self, outputs):
        """
        Parse YOLOv8 Output (1, 84, 8400) -> [x, y, w, h, class_max_score]
        """
        # Output is usually [1, 84, 8400] where 84 = 4 box coords + 80 classes
        output = outputs[0][0] # remove batch dim -> (84, 8400)
        
        # Transpose to (8400, 84) to make it easier to iterate
        output = output.transpose()
        
        # Filter by confidence
        # The first 4 are box (cx, cy, w, h), rest are classes
        boxes = output[:, :4]
        scores = output[:, 4:]
        
        # Get max class score and index for each anchor
        class_ids = np.argmax(scores, axis=1)
        max_scores = np.max(scores, axis=1)
        
        # Filter
        mask = max_scores > self.conf_thres
        boxes = boxes[mask]
        scores = max_scores[mask]
        class_ids = class_ids[mask]
        
        if len(boxes) == 0:
            return []
            
        # Convert cx,cy,w,h to x1,y1,x2,y2
        # And adjust for letterbox scaling
        final_boxes = []
        for i, box in enumerate(boxes):
            cx, cy, w, h = box
            x1 = (cx - w/2)
            y1 = (cy - h/2)
            x2 = (cx + w/2)
            y2 = (cy + h/2)
            
            # Rescale to original image
            x1 /= self.scale
            y1 /= self.scale
            x2 /= self.scale
            y2 /= self.scale
            
            final_boxes.append([int(x1), int(y1), int(x2), int(y2)])
            
        # NMS
        indices = cv2.dnn.NMSBoxes(final_boxes, scores.tolist(), self.conf_thres, self.iou_thres)
        
        results = []
        if len(indices) > 0:
            for i in indices.flatten():
                results.append({
                    'box': final_boxes[i],
                    'conf': scores[i],
                    'cls': class_ids[i]
                })
                
        return results

    def __call__(self, img, conf=0.25, verbose=False):
        """
        Emulate Ultralytics call signature.
        Returns a list containing a MockResult object.
        """
        self.conf_thres = conf
        input_data = self.preprocess(img)
        outputs = self.rknn.inference(inputs=[input_data])
        detections = self.postprocess(outputs)
        
        # Wrap in a Mock Result object to match Ultralytics API used in CameraStream
        class MockBox:
            def __init__(self, det):
                self.xyxy = np.array([det['box']]) # shape (1,4)
                self.cls = np.array([det['cls']]) # shape (1,)
                self.conf = np.array([det['conf']]) # shape (1,)
                
        class MockResult:
            def __init__(self, dets):
                self.boxes = [MockBox(d) for d in dets]
                
        return [MockResult(detections)]

    def release(self):
        self.rknn.release()
