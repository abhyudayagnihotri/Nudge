"""
Phase 10: Machine Learning Model Training & ONNX Export Pipeline for Nudge.

Trains a Random Forest Classifier and Logistic Regression on behavioral telemetry,
computes validation metrics, and exports both ONNX and portable JSON formats.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

import skl2onnx
from skl2onnx.common.data_types import FloatTensorType

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "nudge_dataset.csv")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLS = [
    "sessionDurationMinutes",
    "scrollFrequency",
    "averageScrollVelocity",
    "maxScrollVelocity",
    "scrollDistanceRate",
    "activityDensity",
    "tabSwitchFrequency",
    "autoplayRatio",
    "videoConsumptionRate",
    "isLateNight",
    "infiniteScrollDomainRatio",
    "compulsionRepetitionIndex"
]

TARGET_COL = "is_doomscroll"

def run_training():
    print(f"Loading telemetry dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} samples.")

    X = df[FEATURE_COLS].values.astype(np.float32)
    y = df[TARGET_COL].values.astype(np.int64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # 1. Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 2. Train Logistic Regression (Linear baseline & fast browser evaluation)
    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(X_train_scaled, y_train)

    # 3. Train Random Forest Classifier
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    rf_model.fit(X_train, y_train)

    # Evaluate Random Forest
    rf_preds = rf_model.predict(X_test)
    rf_probs = rf_model.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, rf_preds)
    prec = precision_score(y_test, rf_preds)
    rec = recall_score(y_test, rf_preds)
    f1 = f1_score(y_test, rf_preds)
    auc = roc_auc_score(y_test, rf_probs)
    cm = confusion_matrix(y_test, rf_preds).tolist()

    print("\n================ MODEL EVALUATION ================")
    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall:    {rec * 100:.2f}%")
    print(f"F1 Score:  {f1 * 100:.2f}%")
    print(f"ROC-AUC:   {auc * 100:.2f}%")
    print(f"Confusion Matrix: {cm}")

    # Feature Importances
    importances = dict(zip(FEATURE_COLS, [round(float(v), 4) for v in rf_model.feature_importances_]))
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))
    print("\nFeature Importances:")
    for feat, imp in sorted_importances.items():
        print(f"  - {feat:30s}: {imp * 100:.2f}%")

    # 4. Export to ONNX
    onnx_path = os.path.join(MODELS_DIR, "doomscroll_model.onnx")
    initial_type = [("float_input", FloatTensorType([None, len(FEATURE_COLS)]))]
    onnx_model = skl2onnx.convert_sklearn(rf_model, initial_types=initial_type, target_opset=12)
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"\n[ONNX] Successfully exported model to {onnx_path}")

    # 5. Export lightweight JSON weights for direct in-browser inference
    weights_path = os.path.join(MODELS_DIR, "model_weights.json")
    json_weights = {
        "modelType": "LogisticRegressionCalibrated",
        "featureNames": FEATURE_COLS,
        "scaler": {
            "mean": [round(float(m), 5) for m in scaler.mean_],
            "scale": [round(float(s), 5) for s in scaler.scale_]
        },
        "coefficients": [round(float(c), 5) for c in lr_model.coef_[0]],
        "intercept": round(float(lr_model.intercept_[0]), 5),
        "threshold": 0.50,
        "metrics": {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1": round(float(f1), 4),
            "rocAuc": round(float(auc), 4)
        },
        "featureImportances": sorted_importances
    }

    with open(weights_path, "w") as f:
        json.dump(json_weights, f, indent=2)
    print(f"[JSON] Exported browser-ready model weights to {weights_path}")

    # Also save to extension and dashboard so extension can use it natively
    ext_models_dir = os.path.join(os.path.dirname(__file__), "..", "extension", "models")
    os.makedirs(ext_models_dir, exist_ok=True)
    with open(os.path.join(ext_models_dir, "model_weights.json"), "w") as f:
        json.dump(json_weights, f, indent=2)

    with open(os.path.join(ext_models_dir, "doomscroll_model.onnx"), "wb") as f:
        f.write(onnx_model.SerializeToString())

    print(f"[Extension] Synced models directly into {ext_models_dir}")

if __name__ == "__main__":
    run_training()
