
# Phone User Identification

- [x] Research current detection logic
- [x] Design identification logic
- [x] Finalize Production Implementation Plan
- [x] Implement Temporal State Machine & Phone Tracking
    - [x] SORT-style IOU Tracking for phones
    - [x] Observation Buffer (Lock-in logic)
    - [x] Grace Period (Occlusion removal logic)
- [x] Implement Keypoint-Aware Matching Logic
    - [x] Extract Wrist/Elbow/Ear keypoints from pose
    - [x] Implement Score Formula: `(w_iou * IoU) + (w_dist * (1 - d_norm)) + Pose_Bonus`
    - [x] Adaptive scale factor (Pose-based proxy)
- [x] Refactor `CameraStream.py` to `assign_phones_to_employees`
    - [x] Integrate state machine and matching scoring
    - [x] Add temporal override rules
- [x] Performance & Observability
    - [x] Downsample ROIs for matching
    - [x] JSON-format Structured Logging
    - [x] Integrated profiling/benchmarking
- [x] Verification & Metrics
    - [x] Create Randomized Unit Tests (occlusion scenarios)
    - [x] Calibrate thresholds on multi-scenario dataset
    - [x] Measure F1-score (>0.85) and FPR (<0.1)
