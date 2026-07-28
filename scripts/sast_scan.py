"""
SAST Scan con CodeBERT-VulnCWE

Analiza archivos .ts del Master (src/) buscando patrones sospechosos.
Exit code:
  0 = seguro
  1 = vulnerable / error de ejecución
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


MODEL_NAME = os.getenv("ML_MODEL_NAME", "mahdin70/CodeBERT-VulnCWE")
SCAN_DIRS = ["src"]
EXTENSIONS = {".ts"}


def write_output(vulnerable: bool) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as handle:
        handle.write(f"vulnerable={'true' if vulnerable else 'false'}\n")


def scan_file(filepath: Path, model, tokenizer) -> bool:
    code = filepath.read_text(encoding="utf-8", errors="ignore")
    if not code.strip():
        return False

    inputs = tokenizer(code, return_tensors="pt", truncation=True, max_length=512)
    outputs = model(**inputs)
    vul_logits = outputs.logits[:, :2]
    probs = vul_logits.softmax(dim=1)
    vul_prob = float(probs[0, 1].item())
    return vul_prob > 0.5


def main() -> int:
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError:
        print("Error: faltan dependencias. Ejecuta: pip install torch transformers")
        write_output(True)
        return 1

    print(f"Cargando modelo {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    model.eval()

    vulnerable_files: list[str] = []

    for scan_dir in SCAN_DIRS:
        root = Path(scan_dir)
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix not in EXTENSIONS:
                continue
            print(f"  Escaneando: {path}")
            try:
                if scan_file(path, model, tokenizer):
                    vulnerable_files.append(str(path))
            except Exception as exc:  # noqa: BLE001
                print(f"  Error escaneando {path}: {exc}")

    if vulnerable_files:
        print(f"Vulnerabilidades detectadas en: {vulnerable_files}")
        write_output(True)
        return 1

    print("0 Anomalías detectadas")
    write_output(False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
