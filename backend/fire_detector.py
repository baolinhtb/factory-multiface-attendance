import cv2
import numpy as np
import logging
from ultralytics import YOLO
from pathlib import Path
from typing import Tuple, Optional

class FireDetector:
    def __init__(
        self,
        model_path: str,
        target_height: int = 640,
        iou_threshold: float = 0.2,
        min_confidence: float = 0.5,
        smoke_confidence: float = 0.75
    ):
        """
        Initialize the FireDetector with a YOLO model.

        Args:
            model_path (str): Path to the YOLO model file
            target_height (int): Target height for frame resizing
            iou_threshold (float): IOU threshold for non-maximum suppression
            min_confidence (float): Minimum confidence threshold for detections
        """
        self.logger = logging.getLogger(__name__)

        try:
            self.model = YOLO(model_path)
            self.target_height = target_height
            self.iou_threshold = iou_threshold
            self.min_confidence = min_confidence
            self.smoke_confidence = smoke_confidence
            self.names = self.model.names if hasattr(self.model, 'names') else self.model.model.names

            # Define colors for different classes
            self.colors = {
                "fire": (0, 0, 255),    # Red for fire
                "smoke": (128, 128, 128)  # Gray for smoke
            }

            print("Fire detector initialized successfully")
        except Exception as e:
            print(f"Failed to initialize fire detector: {e}")
            # Do not raise, just let it fail gracefully or handle in caller
            self.model = None

    def resize_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Resize frame maintaining aspect ratio.
        """
        height, width = frame.shape[:2]
        aspect_ratio = width / height
        new_width = int(self.target_height * aspect_ratio)
        return cv2.resize(frame, (new_width, self.target_height))

    def put_text_rect(self, img, text, pos, scale=1.5, thickness=2, colorT=(255, 255, 255), colorR=(0, 0, 0), font=cv2.FONT_HERSHEY_SIMPLEX, offset=5, border=2, colorB=(0, 0, 0)):
        """
        Custom implementation of cvzone.putTextRect using pure OpenCV.
        """
        ox, oy = pos
        (w, h), _ = cv2.getTextSize(text, font, scale, thickness)
        
        x1, y1, x2, y2 = ox - offset, oy + offset, ox + w + offset, oy - h - offset

        cv2.rectangle(img, (x1, y1), (x2, y2), colorR, -1)
        if border is not None:
             cv2.rectangle(img, (x1, y1), (x2, y2), colorB, border)
             
        cv2.putText(img, text, (ox, oy), font, scale, colorT, thickness)
        return img

    def draw_detection(
        self,
        frame: np.ndarray,
        box: np.ndarray,
        class_name: str,
        confidence: float
    ) -> None:
        """
        Draw a single detection on the frame with enhanced visualization.
        """
        x1, y1, x2, y2 = box
        # Default to green if class not found
        color = self.colors.get(class_name.lower(), (0, 255, 0))

        # Calculate text size for better positioning
        text = f"{class_name}: {confidence:.2f}"

        # Adjust label position if too close to top edge
        label_height = 30  # Approximate height of label
        if y1 < label_height:
            text_y = y2 + label_height  # Place label below box
        else:
            text_y = y1 - 5  # Place label above box

        # Draw semi-transparent background for box
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)  # Filled rectangle
        alpha = 0.2
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)  # Transparency effect

        # Draw box outline
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Add box corners for better visibility
        corner_length = 20
        thickness = 2
        # Top-left
        cv2.line(frame, (x1, y1), (x1 + corner_length, y1), color, thickness)
        cv2.line(frame, (x1, y1), (x1, y1 + corner_length), color, thickness)
        # Top-right
        cv2.line(frame, (x2, y1), (x2 - corner_length, y1), color, thickness)
        cv2.line(frame, (x2, y1), (x2, y1 + corner_length), color, thickness)
        # Bottom-left
        cv2.line(frame, (x1, y2), (x1 + corner_length, y2), color, thickness)
        cv2.line(frame, (x1, y2), (x1, y2 - corner_length), color, thickness)
        # Bottom-right
        cv2.line(frame, (x2, y2), (x2 - corner_length, y2), color, thickness)
        cv2.line(frame, (x2, y2), (x2, y2 - corner_length), color, thickness)

        # Add detection label with enhanced visibility
        self.put_text_rect(
            frame,
            text,
            (x1, text_y),
            scale=1.0, # Slightly smaller scale than 1.5 for better fit
            thickness=2,
            colorR=color,
            colorT=(255, 255, 255),  # White text
            font=cv2.FONT_HERSHEY_SIMPLEX,
            offset=5,
            border=2,
            colorB=(0, 0, 0),  # Black border
        )

    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, Optional[str], list]:
        """
        Process a video frame to detect fire and smoke with enhanced visualization.

        Returns:
            tuple: (processed_frame, detection_status_str, list_of_detections)
        """
        if self.model is None:
            return frame, None, []

        try:
            # Note: We are modifying the frame in-place or returning a copy?
            # User code resizes frame, but we might want to keep original size for display?
            # The prompt code resizes frame and draws on the resized frame. 
            # If we perform detection on resized frame, we need to scale boxes back to original frame
            # if we want to draw on original frame.
            # HOWEVER, for simplicity and matching the user snippet, we'll draw on the *processed* frame
            # which might be resized.
            # BUT: CameraStream expects frame of consistent size usually.
            # Let's inspect: The user code returns `frame` which is result of `resize_frame`.
            # If we return a resized frame, it might break downstream UI if it expects specific dimensions.
            # Let's play safe: Detect on resized, but scale boxes to original and draw on original.
            
            # COPY original frame to draw on
            draw_frame = frame.copy()
            
            # PREDICT on resized/original?
            # User code: frame = self.resize_frame(frame) -> predict -> draw.
            # This implies the OUTPUT video is resized.
            # To avoid unexpected UI layout changes, I will TRY to draw on original frame.
            
            # Let's use the model on the full frame with imgsz=640 as argument, 
            # ultralytics handles resizing internally.
            
            results = self.model.predict(
                draw_frame, 
                iou=self.iou_threshold, 
                conf=self.min_confidence,
                imgsz=self.target_height,
                verbose=False
            )
            
            detection = None
            detected_objects = []

            if results and len(results[0].boxes) > 0:
                boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                class_ids = results[0].boxes.cls.cpu().numpy().astype(int)
                confidences = results[0].boxes.conf.cpu().numpy()

                # Sort detections by confidence
                sort_idx = np.argsort(-confidences)  # Descending order
                boxes = boxes[sort_idx]
                class_ids = class_ids[sort_idx]
                confidences = confidences[sort_idx]

                for box, class_id, confidence in zip(boxes, class_ids, confidences):
                    class_name = self.names[class_id]
                    
                    # Check smoke confidence separately if needed
                    if "smoke" in class_name.lower() and confidence < self.smoke_confidence:
                        continue

                    # Update overall detection status
                    if detection is None:  # Only update if not already set
                        if "fire" in class_name.lower() and confidence >= self.min_confidence:
                            detection = "Fire"
                        elif "smoke" in class_name.lower() and confidence >= self.smoke_confidence:
                            detection = "Smoke"

                    self.draw_detection(draw_frame, box, class_name, confidence)
                    
                    detected_objects.append({
                        'box': box,
                        'conf': confidence,
                        'class': class_name
                    })

            # Add frame metadata
            self._add_frame_info(draw_frame, detection)

            return draw_frame, detection, detected_objects

        except Exception as e:
            print(f"Error processing fire frame: {e}")
            return frame, None, []

    def _add_frame_info(self, frame: np.ndarray, detection: Optional[str]) -> None:
        """
        Add frame information overlay.
        """
        height, width = frame.shape[:2]

        # Add semi-transparent overlay at the bottom
        overlay_height = 40
        overlay = frame[height-overlay_height:height, 0:width].copy()
        
        # Draw black background
        cv2.rectangle(frame, (0, height-overlay_height),
                      (width, height), (0, 0, 0), -1)
        
        # Add transparency
        cv2.addWeighted(overlay, 0.2, frame[height-overlay_height:height, 0:width], 0.8, 0,
                        frame[height-overlay_height:height, 0:width])

        # Add status text
        status_text = f"Status: {detection if detection else 'No Detection'}"
        cv2.putText(frame, status_text, (10, height-15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # Add confidence threshold info
        conf_text = f"Conf: {self.min_confidence:.2f} | IOU: {self.iou_threshold:.2f}"
        text_size = cv2.getTextSize(
            conf_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
        cv2.putText(frame, conf_text, (width - text_size[0] - 10, height-15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
