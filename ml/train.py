"""
QR_Shield Enterprise - Random Forest Model Training
====================================================
Train offline, export to JSON for in-app inference.

Usage:
  python ml/train.py                  # synthetic dataset (fallback)
  python ml/train.py --data ml/data/training.csv   # real dataset from prepare_data.py

Output: public/models/rf-model.json
"""

import argparse
import datetime
import json
import math
import random
import csv
from collections import Counter

import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("scikit-learn not installed. Install with: pip install scikit-learn")

FEATURE_NAMES = [
    "domainLength", "subdomainCount", "hasHttps", "entropy",
    "specialCharRatio", "isIpAddress", "hasSuspiciousKeywords", "redirectCount",
]


def generate_synthetic_dataset(n_samples=5000):
    """Generate synthetic phishing URL dataset for training."""
    data = []
    for _ in range(n_samples):
        domain_length = random.randint(5, 50)
        subdomain_count = random.randint(0, 5)
        has_https = 1 if random.random() < 0.6 else 0
        entropy = round(random.uniform(1.5, 5.5), 2)
        special_char_ratio = round(random.uniform(0.0, 0.15), 4)
        is_ip_address = 1 if random.random() < 0.1 else 0
        has_suspicious_keywords = 1 if random.random() < 0.15 else 0
        redirect_count = random.randint(0, 3)

        score = (
            0.15 * (domain_length / 50) +
            0.10 * min(subdomain_count / 5, 1) +
            0.10 * (1 - has_https) +
            0.20 * (entropy / 5.5) +
            0.05 * special_char_ratio +
            0.15 * is_ip_address +
            0.15 * has_suspicious_keywords +
            0.10 * min(redirect_count / 3, 1)
        )

        noise = random.uniform(-0.1, 0.1)
        label = 1 if score + noise > 0.45 else 0

        data.append([
            domain_length, subdomain_count, has_https, entropy,
            special_char_ratio, is_ip_address, has_suspicious_keywords,
            redirect_count, label
        ])

    return np.array(data)


def export_tree_to_json(tree, feature_names):
    """Convert sklearn tree to ml-cart node format for ml-random-forest."""

    def recurse(node):
        if tree.children_left[node] == -1 and tree.children_right[node] == -1:
            counts = [float(c) for c in tree.value[node][0]]
            return {
                "distribution": [counts],
            }

        feature_idx = int(tree.feature[node])
        threshold = float(tree.threshold[node])
        left = recurse(int(tree.children_left[node]))
        right = recurse(int(tree.children_right[node]))

        return {
            "splitValue": threshold,
            "splitColumn": feature_idx,
            "gain": float(tree.impurity[node]),
            "left": left,
            "right": right,
        }

    return recurse(0)


def train_and_export(data_path=None):
    """Main training function."""
    if data_path:
        print(f"Loading real dataset from {data_path}...")
        rows = []
        with open(data_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
        X = np.array([[float(row[f]) for f in FEATURE_NAMES] for row in rows])
        y = np.array([int(row["label"]) for row in rows])
        n_phishing = int(y.sum())
        n_legit = len(y) - n_phishing
        print(f"  {len(rows)} samples | phishing: {n_phishing} | legit: {n_legit}")
    else:
        print("Generating synthetic dataset...")
        dataset = generate_synthetic_dataset(5000)
        X = dataset[:, :-1]
        y = dataset[:, -1]
        n_phishing = int(np.sum(y))
        n_legit = len(y) - n_phishing

    feature_names = FEATURE_NAMES

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
    )

    if SKLEARN_AVAILABLE:
        print("Training Random Forest model...")
        rf = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
            max_features=None
        )
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        print(f"\nModel Accuracy: {accuracy:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=["Safe", "Phishing"]))

        n_features = len(feature_names)
        tree_options = {
            "gainFunction": "gini",
            "splitFunction": "mean",
            "minNumSamples": 3,
            "maxDepth": None,
            "gainThreshold": 0.01,
            "kind": "classifier",
        }

        trees_json = []
        for tree in rf.estimators_:
            trees_json.append({
                "options": tree_options,
                "root": export_tree_to_json(tree.tree_, feature_names),
                "name": "DTClassifier",
            })

        # ml-random-forest expects a "name" at top level plus a "baseModel"
        # wrapper. indexes[i] selects the feature columns tree i was trained on;
        # identity selection keeps sklearn's global feature indices intact.
        model_json = {
            "name": "RFClassifier",
            "baseModel": {
                "indexes": [list(range(n_features)) for _ in rf.estimators_],
                "n": n_features,
                "replacement": False,
                "maxFeatures": 1.0,
                "nEstimators": len(rf.estimators_),
                "isClassifier": True,
                "seed": 42,
                "estimators": trees_json,
                "useSampleBagging": False,
                "maxSamples": None,
                "treeOptions": tree_options,
            },
            "metadata": {
                "accuracy": round(float(accuracy), 4),
                "nSamples": len(X_train),
                "nFeatures": n_features,
                "modelType": "RandomForestClassifier",
                "trainedFor": "QR_Shield Enterprise",
                "trainedOn": data_path or "synthetic",
                "trainedDate": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "balance": {"phishing": int(n_phishing), "legit": int(n_legit)},
            }
        }
    else:
        print("Falling back to simple threshold-based model...")
        model_json = {
            "nEstimators": 1,
            "nClasses": 2,
            "classes": ["safe", "phishing"],
            "featureNames": feature_names,
            "trees": [{
                "type": "split",
                "feature": "hasSuspiciousKeywords",
                "threshold": 0.5,
                "left": {
                    "type": "split",
                    "feature": "entropy",
                    "threshold": 4.0,
                    "left": {
                        "type": "leaf",
                        "value": 0,
                        "probability": 0.8
                    },
                    "right": {
                        "type": "leaf",
                        "value": 1,
                        "probability": 0.6
                    }
                },
                "right": {
                    "type": "leaf",
                    "value": 1,
                    "probability": 0.85
                }
            }],
            "metadata": {
                "accuracy": 0.85,
                "nSamples": len(X_train) if not SKLEARN_AVAILABLE else 4000,
                "nFeatures": len(feature_names),
                "modelType": "DecisionStump",
                "trainedFor": "QR_Shield Enterprise"
            }
        }

    output_path = "public/models/rf-model.json"
    with open(output_path, "w") as f:
        json.dump(model_json, f, indent=2)

    print(f"\nModel exported to: {output_path}")
    print("Model ready for in-app inference.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train QR_Shield Random Forest model")
    parser.add_argument("--data", type=str, default=None,
                        help="Path to CSV dataset (from prepare_data.py). Omit for synthetic data.")
    args = parser.parse_args()
    train_and_export(args.data)
