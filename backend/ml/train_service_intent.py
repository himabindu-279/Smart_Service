"""Train a service-intent classifier on fixed BGE-M3 embeddings.

Run from the backend directory:
    python ml/train_service_intent.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATASET = BASE_DIR / "service_intents.csv"
DEFAULT_MODEL_DIR = BASE_DIR / "trained_model"


def _stratify_or_none(labels: pd.Series, sample_count: int, test_size: float):
    class_count = labels.nunique()
    requested_test_count = int(sample_count * test_size)
    if labels.value_counts().min() >= 2 and requested_test_count >= class_count:
        return labels
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Train service intent classifier on BGE-M3 embeddings")
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--encoder", default="BAAI/bge-m3")
    args = parser.parse_args()

    dataset = pd.read_csv(args.dataset).dropna(subset=["text", "label"])
    if dataset["label"].nunique() < 2:
        raise ValueError("The dataset must contain at least two labels.")

    texts = dataset["text"].astype(str).tolist()
    labels = dataset["label"].astype(str)
    train_texts, test_texts, train_labels, test_labels = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=_stratify_or_none(labels, len(labels), 0.2),
    )
    train_texts, validation_texts, train_labels, validation_labels = train_test_split(
        train_texts,
        train_labels,
        test_size=0.2,
        random_state=42,
        stratify=_stratify_or_none(train_labels, len(train_labels), 0.2),
    )

    encoder = SentenceTransformer(args.encoder)
    train_embeddings = encoder.encode(train_texts, normalize_embeddings=True, show_progress_bar=True)
    validation_embeddings = encoder.encode(validation_texts, normalize_embeddings=True, show_progress_bar=False)
    test_embeddings = encoder.encode(test_texts, normalize_embeddings=True, show_progress_bar=False)

    classifier = LogisticRegression(max_iter=2000, class_weight="balanced")
    classifier.fit(train_embeddings, train_labels)

    print("VALIDATION RESULTS")
    print(classification_report(validation_labels, classifier.predict(validation_embeddings), zero_division=0))
    print("TEST RESULTS")
    print(classification_report(test_labels, classifier.predict(test_embeddings), zero_division=0))

    args.model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(classifier, args.model_dir / "service_classifier.joblib")
    joblib.dump(
        {
            "labels": classifier.classes_.tolist(),
            "encoder": args.encoder,
            "dataset": str(args.dataset),
        },
        args.model_dir / "metadata.joblib",
    )
    print(f"Saved classifier to {args.model_dir}")


if __name__ == "__main__":
    main()
