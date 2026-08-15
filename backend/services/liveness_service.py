"""
Task 2 — Liveness / anti-spoofing detection.

Primary: a lightweight ONNX anti-spoofing model (Silent-Face-Anti-Spoofing,
MiniFASNetV2). If the ONNX model file or onnxruntime is unavailable at startup,
falls back to a passive LBP (Local Binary Pattern) texture classifier, which
discriminates real faces (rich micro-texture / high histogram entropy) from
flat printed photos and screen replays.

Returned score is the probability the crop is a *live* face, in [0, 1].
"""
from __future__ import annotations

import os
import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:
    import onnxruntime as ort
    _ORT_AVAILABLE = True
except Exception:
    ort = None
    _ORT_AVAILABLE = False

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
DEFAULT_LIVENESS_MODEL = os.path.join(MODEL_DIR, "anti_spoof_minifasnetv2.onnx")


def _uniform_lbp(gray: np.ndarray) -> np.ndarray:
    """Compute a simple 8-neighbour LBP image (no skimage dependency)."""
    g = gray.astype(np.int16)
    h, w = g.shape
    center = g[1:h - 1, 1:w - 1]
    codes = np.zeros_like(center, dtype=np.uint8)
    # 8 neighbours, MSB..LSB
    neighbours = [
        g[0:h - 2, 0:w - 2], g[0:h - 2, 1:w - 1], g[0:h - 2, 2:w],
        g[1:h - 1, 2:w],     g[2:h, 2:w],         g[2:h, 1:w - 1],
        g[2:h, 0:w - 2],     g[1:h - 1, 0:w - 2],
    ]
    for i, nb in enumerate(neighbours):
        codes |= ((nb >= center).astype(np.uint8) << (7 - i))
    return codes


def _lbp_liveness_score(face_crop: np.ndarray) -> float:
    """
    Passive texture analysis. Real faces have higher entropy in the LBP
    histogram than printed photos / screen replays. We compute LBP on three
    horizontal sub-regions, concatenate the normalized histograms, and map the
    average Shannon entropy onto a 0..1 liveness score.
    """
    if cv2 is None or face_crop is None or face_crop.size == 0:
        return 0.5
    if face_crop.ndim == 3:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = face_crop
    gray = cv2.resize(gray, (96, 96))

    entropies = []
    third = gray.shape[0] // 3
    for r in range(3):
        sub = gray[r * third:(r + 1) * third, :]
        if sub.shape[0] < 3 or sub.shape[1] < 3:
            continue
        lbp = _uniform_lbp(sub)
        hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
        p = hist.astype(np.float64)
        s = p.sum()
        if s <= 0:
            continue
        p /= s
        nz = p[p > 0]
        entropy = float(-(nz * np.log2(nz)).sum())  # 0..8 bits
        entropies.append(entropy)

    if not entropies:
        return 0.5
    avg_entropy = sum(entropies) / len(entropies)
    # Empirically, live faces sit ~5.5-7.5 bits; flat prints ~3-5 bits.
    score = (avg_entropy - 4.0) / 3.5
    return float(max(0.0, min(1.0, score)))


class LivenessDetector:
    def __init__(self, model_path: str | None = None, threshold: float = 0.0):
        self.threshold = threshold
        self.session = None
        self.mode = "lbp"
        path = model_path or DEFAULT_LIVENESS_MODEL
        if _ORT_AVAILABLE and path and os.path.exists(path):
            try:
                self.session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
                self._input_name = self.session.get_inputs()[0].name
                self.mode = "onnx"
                print(f"LivenessDetector: ONNX anti-spoofing model loaded ({os.path.basename(path)}).")
            except Exception as exc:
                print(f"LivenessDetector: failed to load ONNX model ({exc}); using LBP fallback.")
                self.session = None
        else:
            print("LivenessDetector: ONNX model unavailable; using passive LBP texture fallback.")

    def is_live(self, face_crop: np.ndarray) -> tuple[bool, float]:
        score = self.score(face_crop)
        return score >= self.threshold, score

    def score(self, face_crop: np.ndarray) -> float:
        if face_crop is None or getattr(face_crop, "size", 0) == 0:
            return 0.0
        if self.session is not None and cv2 is not None:
            try:
                inp = cv2.resize(face_crop, (80, 80)).astype(np.float32) / 255.0
                inp = np.transpose(inp, (2, 0, 1))[np.newaxis, :]
                out = self.session.run(None, {self._input_name: inp})[0]
                out = np.asarray(out).ravel()
                if out.size >= 2:
                    # softmax over [spoof, live] (or [live, spoof] — take max-2 layout)
                    e = np.exp(out - out.max())
                    probs = e / e.sum()
                    live_prob = float(probs[-1]) if probs.size == 2 else float(probs[1])
                    return max(0.0, min(1.0, live_prob))
                return float(max(0.0, min(1.0, out[0])))
            except Exception as exc:
                print(f"LivenessDetector: ONNX inference error ({exc}); falling back to LBP for this crop.")
        return _lbp_liveness_score(face_crop)


_liveness_detector: LivenessDetector | None = None


def get_liveness_detector(threshold: float = 0.0) -> LivenessDetector:
    global _liveness_detector
    if _liveness_detector is None:
        _liveness_detector = LivenessDetector(threshold=threshold)
    else:
        _liveness_detector.threshold = threshold
    return _liveness_detector
