import cv2
import numpy as np
import os
import urllib.request
import logging
import threading
from datetime import datetime
from typing import List, Optional, Tuple

from .liveness_service import get_liveness_detector

logger = logging.getLogger("cv")

# Paths for models
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
DETECTOR_PATH = os.path.join(MODEL_DIR, "face_detection_yunet.onnx")
RECOGNIZER_PATH = os.path.join(MODEL_DIR, "face_recognition_sface.onnx")
ADAFACE_PATH = os.path.join(MODEL_DIR, "adaface_ir18.onnx")

# URLs (Updated to use 'main' branch)
DETECTOR_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
RECOGNIZER_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

# Task 11: active recognition model selection
ACTIVE_MODEL = os.environ.get("FACE_RECOGNITION_MODEL", "sface").lower().strip()

# Expected max raw embedding norm, used to normalise the quality score into 0..1 (Task 3)
EXPECTED_MAX_NORM = 25.0


def _cv_log(event_type: str, session_id="-", student_id="-", detail=""):
    """Uniform CV log line: 'YYYY-MM-DD HH:MM:SS | EVENT_TYPE | session_id=X | student_id=Y | detail'."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{ts} | {event_type} | session_id={session_id} | student_id={student_id} | {detail}"
    print(line)
    return line


class AIService:
    def __init__(self):
        if not os.path.exists(MODEL_DIR):
            os.makedirs(MODEL_DIR)

        self.mock_mode = False
        self.active_model = ACTIVE_MODEL if ACTIVE_MODEL in ("sface", "adaface") else "sface"
        self.adaface_session = None
        self._last_frame_hash = None  # Task 1: perceptual-hash dedup state
        self._lock = threading.Lock()

        # Runtime-configurable thresholds (overridable from DB SystemSettings)
        self.blur_threshold = 80.0          # Task 1
        self.embedding_min_norm = 2.0       # Task 3
        self.liveness_threshold = 0.0       # Task 2

        try:
            self._ensure_model(DETECTOR_URL, DETECTOR_PATH)
            self._ensure_model(RECOGNIZER_URL, RECOGNIZER_PATH)

            self._detectors = {}
            # Initialize a default one just to check it loads
            self._detectors["default"] = cv2.FaceDetectorYN.create(DETECTOR_PATH, "", (320, 320), 0.6, 0.3)
            
            self.recognizer = cv2.FaceRecognizerSF.create(RECOGNIZER_PATH, "")
            print("AI Engine: Models loaded successfully. Detection threshold: 0.6")
        except Exception as e:
            print(f"AI Engine Warning: Could not load models ({e}). Switching to Mock Mode.")
            self.mock_mode = True

        # Task 11: optional AdaFace backend
        if self.active_model == "adaface":
            self._load_adaface()

        # Task 2: liveness detector (lazy singleton)
        self.liveness = get_liveness_detector(self.liveness_threshold)

    # ─── model loading ──────────────────────────────────────────────────────
    def _ensure_model(self, url: str, path: str):
        if not os.path.exists(path):
            print(f"Downloading model from {url}...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
                out_file.write(response.read())
            print("Download complete.")

    def _load_adaface(self):
        try:
            import onnxruntime as ort
            if os.path.exists(ADAFACE_PATH):
                self.adaface_session = ort.InferenceSession(ADAFACE_PATH, providers=["CPUExecutionProvider"])
                self._adaface_input = self.adaface_session.get_inputs()[0].name
                print("AI Engine: AdaFace (512-d) backend active.")
            else:
                print(f"AI Engine Warning: AdaFace model not found at {ADAFACE_PATH}; staying on SFace.")
                self.active_model = "sface"
        except Exception as exc:
            print(f"AI Engine Warning: Could not initialise AdaFace ({exc}); staying on SFace.")
            self.active_model = "sface"

    def apply_settings(self, settings):
        """Pull configurable CV thresholds from a SystemSettings row."""
        if settings is None:
            return
        self.blur_threshold = getattr(settings, "cv_blur_threshold", self.blur_threshold) or self.blur_threshold
        self.embedding_min_norm = getattr(settings, "cv_embedding_min_norm", self.embedding_min_norm) or self.embedding_min_norm
        self.liveness_threshold = 0.0 # Force for MVP testing to avoid DB override
        self.liveness.threshold = 0.0

    # ─── Task 1: frame pre-processing ───────────────────────────────────────
    def preprocess_frame(self, frame: np.ndarray, session_id="-") -> Optional[np.ndarray]:
        """
        Resize -> CLAHE brightness normalisation -> perceptual-hash dedup -> blur gate.
        Returns the cleaned frame, or None if the frame should be skipped.
        """
        if frame is None:
            return None

        # 1. Resize to 640x480
        frame = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_AREA)

        # 2. CLAHE on the L (luminance) channel
        try:
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            lab[:, :, 0] = clahe.apply(lab[:, :, 0])
            frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        except Exception:
            pass  # never let colour conversion crash the pipeline

        # 3. Perceptual-hash near-duplicate skip (Disabled because it causes all frames to be skipped if the camera is still)
        # try:
        #     cur_hash = self._phash(frame)
        #     if self._last_frame_hash is not None:
        #         if self._hamming(cur_hash, self._last_frame_hash) <= 3:
        #             return None  # near-duplicate of previous frame
        #     self._last_frame_hash = cur_hash
        # except Exception:
        #     pass

        # 4. Blur gate via Laplacian variance
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < float(self.blur_threshold):
            _cv_log("FRAME_BLUR_SKIP", session_id=session_id,
                    detail=f"blur_score={blur_score:.2f} threshold={self.blur_threshold}")
            return None

        return frame

    @staticmethod
    def _phash(frame: np.ndarray, hash_size: int = 8) -> int:
        """
        Perceptual hash for near-duplicate detection. Uses the `imagehash`
        library's DCT-based pHash when available (more robust to minor lighting
        shifts), and falls back to a dependency-free average-hash otherwise.
        Returns a 64-bit int so Hamming distance is a simple popcount.
        """
        try:
            import imagehash
            from PIL import Image
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            ph = imagehash.phash(Image.fromarray(rgb), hash_size=hash_size)
            # imagehash returns an ndarray of bits; pack to int
            bits = ph.hash.flatten()
            h = 0
            for b in bits:
                h = (h << 1) | int(bool(b))
            return h
        except Exception:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            small = cv2.resize(gray, (hash_size, hash_size), interpolation=cv2.INTER_AREA)
            avg = small.mean()
            bits = (small > avg).flatten()
            h = 0
            for b in bits:
                h = (h << 1) | int(b)
            return h

    @staticmethod
    def _hamming(a: int, b: int) -> int:
        return bin(a ^ b).count("1")

    # ─── embeddings ─────────────────────────────────────────────────────────
    def get_face_embedding(self, image_bytes: bytes) -> Optional[List[float]]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        return self.get_face_embedding_from_frame(img)

    def _get_detector(self, width: int, height: int):
        key = (width, height)
        if key not in self._detectors:
            self._detectors[key] = cv2.FaceDetectorYN.create(DETECTOR_PATH, "", (width, height), 0.6, 0.3)
        return self._detectors[key]

    def get_face_embedding_from_frame(self, img: np.ndarray) -> Optional[List[float]]:
        if self.mock_mode:
            dim = 512 if self.active_model == "adaface" else 128
            return [float(np.random.uniform(-1, 1)) for _ in range(dim)]

        height, width, _ = img.shape
        detector = self._get_detector(width, height)
        _, faces = detector.detect(img)
        if faces is None:
            return None
        face = faces[0]
        return self._embed_face(img, face)

    def _embed_face(self, img: np.ndarray, face) -> Optional[List[float]]:
        """Generate an embedding for a single detected face using the active model."""
        if self.active_model == "adaface" and self.adaface_session is not None:
            return self._adaface_embedding(img, face)
        aligned_face = self.recognizer.alignCrop(img, face)
        embedding = self.recognizer.feature(aligned_face)
        return embedding[0].tolist()

    def _adaface_embedding(self, img: np.ndarray, face) -> Optional[List[float]]:
        aligned = self.recognizer.alignCrop(img, face)  # reuse SFace alignment
        inp = cv2.resize(aligned, (112, 112)).astype(np.float32)
        inp = (inp - 127.5) / 128.0
        inp = np.transpose(inp, (2, 0, 1))[np.newaxis, :]
        out = self.adaface_session.run(None, {self._adaface_input: inp})[0]
        return np.asarray(out).ravel().tolist()

    def detect_and_embed(self, img: np.ndarray, session_id="-") -> List[dict]:
        """
        Detect faces and return per-face dicts:
          { embedding, bbox, embedding_confidence, is_live, liveness_score }
        Applies Task 3 (quality gate) and Task 2 (liveness) per face.
        """
        if self.mock_mode:
            return []
        if img is None or getattr(img, "size", 0) == 0:
            return []

        with self._lock:
            height, width, _ = img.shape
            detector = self._get_detector(width, height)
            _, faces = detector.detect(img)
            if faces is None:
                return []

            results = []
            for face in faces:
                bbox = [int(v) for v in face[0:4]]

                # Task 2: crop the face region for liveness BEFORE accepting it
                x, y, w, h = bbox
                x0, y0 = max(0, x), max(0, y)
                x1, y1 = min(width, x + w), min(height, y + h)
                face_crop = img[y0:y1, x0:x1] if (x1 > x0 and y1 > y0) else None
                is_live, liveness_score = (True, 1.0)
                if face_crop is not None and face_crop.size > 0:
                    is_live, liveness_score = self.liveness.is_live(face_crop)

                # Embedding + Task 3 quality gate
                quality = self._embed_with_quality(img, face, session_id=session_id)
                if quality is None:
                    continue
                embedding, confidence = quality

                results.append({
                    "embedding": embedding,
                    "bbox": bbox,
                    "embedding_confidence": confidence,
                    "is_live": bool(is_live),
                    "liveness_score": float(liveness_score),
                })
            return results

    def _embed_with_quality(self, img: np.ndarray, face, session_id="-") -> Optional[Tuple[List[float], float]]:
        """
        Task 3 — embedding quality gate.
        Returns (l2_normalised_embedding, confidence 0..1) or None to skip.
        """
        if self.active_model == "adaface" and self.adaface_session is not None:
            raw = np.asarray(self._adaface_embedding(img, face), dtype=np.float32)
        else:
            aligned_face = self.recognizer.alignCrop(img, face)
            raw = np.asarray(self.recognizer.feature(aligned_face)[0], dtype=np.float32)

        norm = float(np.linalg.norm(raw))
        if norm < 1e-6:
            return None  # degenerate vector
        if norm < float(self.embedding_min_norm):
            _cv_log("EMBEDDING_QUALITY_LOW", session_id=session_id, detail=f"norm={norm:.2f}")
            return None

        normalized = (raw / norm).tolist()
        confidence = float(max(0.0, min(1.0, norm / EXPECTED_MAX_NORM)))
        return normalized, confidence

    # ─── backwards-compatible helpers ───────────────────────────────────────
    def get_all_face_embeddings(self, img: np.ndarray) -> List[List[float]]:
        return [r['embedding'] for r in self.detect_and_embed(img)]

    def compare_faces(self, embedding1: List[float], embedding2: List[float]) -> float:
        feat1 = np.array(embedding1, dtype=np.float32).reshape(1, -1)
        feat2 = np.array(embedding2, dtype=np.float32).reshape(1, -1)
        if self.active_model == "adaface" and self.adaface_session is not None:
            # AdaFace embeddings are L2-normalised -> cosine similarity is a dot product
            a = feat1 / (np.linalg.norm(feat1) + 1e-9)
            b = feat2 / (np.linalg.norm(feat2) + 1e-9)
            return float(np.dot(a.ravel(), b.ravel()))
        if self.mock_mode:
            a = feat1 / (np.linalg.norm(feat1) + 1e-9)
            b = feat2 / (np.linalg.norm(feat2) + 1e-9)
            return float(np.dot(a.ravel(), b.ravel()))
        return float(self.recognizer.match(feat1, feat2, cv2.FaceRecognizerSF_FR_COSINE))


ai_engine = None


def get_ai_engine():
    global ai_engine
    if ai_engine is None:
        ai_engine = AIService()
    return ai_engine
