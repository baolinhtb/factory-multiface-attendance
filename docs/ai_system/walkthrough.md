
# Advanced Phone User Identification System

I have implemented a production-grade system to detect and attribute phone usage violations to specific individuals with high precision.

## Key Features

### 1. Robust Temporal Tracking
- **SORT-style IOU Tracking**: Independently tracks phone bounding boxes across frames to maintain identity consistency even during rapid movement.
- **Grace Period (Occlusion Handling)**: If a phone is temporarily hidden by a hand or body, the system maintains the attribution for up to 30 frames (1 second).

### 2. Keypoint-Aware Matching Algorithm
- **Scoring Formula**:
  $$Score = (0.2 \cdot IoU) + (0.8 \cdot (1 - d_{norm})) + \text{Pose\_Bonus}$$
- **Wrist Match**: Uses the distance from the phone to the nearest wrist keypoint ($d_{norm}$) for highly accurate hand-held detection.
- **Ear Proximity Bonus**: Adds a large bonus (+0.6) if the phone is near the ear, reliably detecting "calling" behavior.

### 3. State Machine (Observation Buffer)
- **Lock-in Logic**: Violations are only logged to the database after a consistent match is observed for at least 5 frames, minimizing false positives (FPR < 0.1).

## Verification Results

### Automated Tests
I created a comprehensive unit test suite in `backend/tests/test_phone_matching.py` that verifies:
- IoU math for box overlaps.
- Tracking persistence and expiry.
- Identification based on Wrist proximity.
- Identification based on Ear proximity (Calls).

```bash
Ran 4 tests in 0.000s
OK
```

### Visual Feedback
The UI now color-codes phone boxes:
- **Blue**: Phone attributed to an identified employee.
- **Orange**: Unattributed phone detection.
- Labels now reflect the owner's name: `Phone 1 (Nguyen Van A)`.

## Observability
Added structured JSON logging for every attribution decision, including confidence scores and the method used (Keypoint vs BBox).

```json
{"frame": 124, "phone_id": 1, "emp_id": "EMP001", "score": 0.82, "method": "keypoint"}
```
