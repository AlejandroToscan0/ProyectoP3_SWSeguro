"""
SAST Scan con CodeBERT-VulnCWE

Analiza archivos .py y .ts del repositorio usando el modelo
mahdin70/CodeBERT-VulnCWE y reporta si se encontraron vulnerabilidades.
"""

import os
import sys
import json
import glob
from pathlib import Path

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
except ImportError:
    print("Error: faltan dependencias. Ejecuta: pip install torch transformers")
    sys.exit(1)

MODEL_NAME = os.getenv("ML_MODEL_NAME", "mahdin70/CodeBERT-VulnCWE")
THRESHOLD = 0.5
EXTENSIONS = (".py", ".ts")
SCAN_DIRS = ["src"]


def scan_file(filepath: str, model, tokenizer) -> bool:
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        code = f.read()

    if not code.strip():
        return False

    inputs = tokenizer(code, return_tensors="pt", truncation=True, max_length=512)
    outputs = model(**inputs)

    vul_logits = outputs.logits[:, :2]
    probs = vul_logits.softmax(dim=1)
    vul_prob = probs[0, 1].item()

    return vul_prob > 0.5


def main():
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    model_name = os.getenv("ML_MODEL_NAME", "mahdin70/CodeBERT-VulnCWE")

    print(f"Cargando modelo {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()

    vulnerable_files = []

    for scan_dir in SCAN_DIRS:
        for root, _dirs, files in os.walk(scan_dir):
            for file in files:
                if not (file.endswith(".py") or file.endswith(".ts")):
                    continue
                path = os.path.join(root, file)
                print(f"  Escaneando: {path}")
                try:
                    if scan_file(path, model, tokenizer):
                        vulnerable_files.append(path)
                except Exception as e:
                    print(f"  Error escaneando {path}: {e}")

    if vulnerable_files:
        print(f"Vulnerabilidades detectadas en: {vulnerable_files}")
        with open(os.environ.get("GITHUB_OUTPUT", ""), "a") as f:
            f.write("vulnerable=true\n")
    else:
        print("0 Anomalías detectadas")
        with open(os.environ.get("GITHUB_OUTPUT", ""), "a") as f:
            f.write("vulnerable=false\n")
