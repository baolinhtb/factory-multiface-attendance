
# Phone User Identification Plan (Production Grade)

## Goal
Achieve production-grade phone usage attribution with **F1-score > 0.85** and **FPR < 0.1** using spatial-temporal association, adaptive scale estimation, and performance-optimized matching.

## Proposed Changes

### 1. Temporal State Machine & Phone Tracking

To handle occlusions and achieve F1 > 0.85, we implement a multi-stage persistence layer.

#### State Machine Mechanics:
- **Observation Buffer (Lock-in)**: A "Violation" is only logged after a `[Phone, Person]` pair is matched for $N$ (e.g., 5) consecutive frames.
- **Grace Period (Occlusion Handling)**: If a phone disappears or the match score drops below threshold, the system "holds" the last known `Person ID` for $M$ (e.g., 30) frames. This prevents flickering during rapid movements.

#### IOU-based Phone Tracking:
- Implement independent IOU-based tracking for phone bounding boxes (SORT/ByteTrack style).
- **Rule**: If a `Phone Track ID` is matched to a `Person ID`, that mapping is locked for the lifetime of the `Phone Track ID` (unless a higher-confidence match conflicts).

### 2. Keypoint-Aware Matching (`assign_phones_to_employees`)

#### Logic & Confidence Scoring:
- **Core Keypoints**: Wrist (9, 10), Elbow (7, 8), Ear (3, 4).
- **Formula**: $Score = (w_{iou} \cdot IoU) + (w_{dist} \cdot (1 - d_{norm})) + \text{Pose\_Bonus}$
- **Pose_Bonus**: +0.2 weight if phone is near **Ear** (confirmed calling behavior).

#### Performance Tweaks:
- **Downsampling**: Process matching on 50% resized ROIs for speed.
- **Async Execution**: Offload heavy detection (e.g. MediaPipe Hands fallback) to background threads.
- **Benchmarking**: Integrated profiling per stack layer.

### 2. Observability & Testing
- **Structure Logging**: JSON format including `frame_id`, `temporal_decision`, and `score`.
- **Randomized Unit Tests**: Mock datasets with randomized occlusion and multi-conflict scenarios.
- **Integration Tests**: Pytest suite for end-to-end (Camera URL -> DB update).

### 3. Verification & Dataset
- **Ground Truth**: Annotate diverse real-world videos (Factory, Office) using CVAT/LabelStudio.
- **Target Metrics**: 
    - F1-score > 0.85 (Accuracy)
    - FPR < 0.1 (Avoid false accusations)
