# CatchPhish AI — Real-Time Intelligent Email Threat Detector

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.141+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.9+-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Render-46E3B7?style=flat-square&logo=render&logoColor=white)](https://catchphish-ui.onrender.com)

A fully deployed, real-time cybersecurity application designed to detect phishing attacks and fraudulent emails using a multi-feature fusion NLP pipeline and a Stacking Ensemble classifier.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Model Evaluation & Performance](#model-evaluation--performance)
- [System Architecture](#system-architecture)
- [Feature Engineering & ML Pipeline](#feature-engineering--ml-pipeline)
- [API Specification & Payload Schema](#api-specification--payload-schema)
- [Local Development & Setup](#local-development--setup)
- [Deployment Strategy](#deployment-strategy)
- [License](#license)

---

## Executive Summary

Phishing attacks remain one of the primary entry vectors for modern cybersecurity breaches. **CatchPhish AI** addresses this challenge by analyzing raw text payloads through a decoupled microservice architecture:

- **Multi-Feature Fusion Engine:** Combines Word TF-IDF, Character N-Grams, and domain-specific structural heuristics.
- **Stacking Ensemble Architecture:** Aggregates predictions from Logistic Regression, Calibrated Linear SVM, and Random Forest base models using a meta-classifier.
- **Explainable Output:** Returns raw threat scores, categorical risk buckets, and specific flagged risk keywords for transparency.
- **Decoupled Deployment:** Hosted as a FastAPI Web Service backend with an asynchronous Static UI frontend on cloud infrastructure.

---

## Model Evaluation & Performance

The classifier was trained and evaluated on a benchmark dataset of ~76,000 labeled legitimate and phishing email bodies. An 80/20 train-test split with stratified sampling was used to preserve class proportions.

### Primary Metrics (Test Set)

| Metric | Score | Technical Context |
| :--- | :--- | :--- |
| **Accuracy** | **98.42%** | Overall correct classification rate across test partition |
| **Precision (Phishing)** | **98.71%** | Minimizes False Positives (legitimate emails marked as threats) |
| **Recall (Phishing)** | **97.85%** | Maximizes detection rate of active phishing payloads |
| **F1-Score** | **98.28%** | Harmonic mean balancing precision and recall stability |
| **False Positive Rate (FPR)** | **1.08%** | Critical metric to prevent legitimate communication blocking |
| **Inference Latency** | **~18.5 ms** | Measured average prediction latency per payload (CPU execution) |

### Confusion Matrix Summary

- **True Negatives (Legitimate Correctly Identified):** 98.92%
- **False Positives (Legitimate Flagged as Phishing):** 1.08%
- **False Negatives (Phishing Missed):** 2.15%
- **True Positives (Phishing Correctly Identified):** 97.85%

> **Note on Trade-offs:** The meta-classifier threshold was calibrated slightly toward higher Precision over Recall to ensure lower friction from False Positives during end-user execution.

---

## System Architecture

```text
+-----------------------------------------------------------------------+
|                            USER INTERFACE                             |
|              (HTML5 / CSS3 Glassmorphism / Vanilla JS)                |
|                    Host: Render Static Site                           |
+-----------------------------------------------------------------------+
                                   |
                            JSON POST /predict
                                   |
                                   v
+-----------------------------------------------------------------------+
|                          FASTAPI REST BACKEND                         |
|                    Host: Render Web Service (Python)                  |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                        FEATURE FUSION PIPELINE                        |
|                                                                         |
|  +---------------------+  +---------------------+  +-----------------+ |
|  | Word TF-IDF Vector  |  | Char N-Gram Vector  |  | Structural       | |
|  | (Unigrams/Bigrams)  |  | (Char 3-5 Grams)    |  | Feature Extr.    | |
|  +---------------------+  +---------------------+  +-----------------+ |
+-----------------------------------------------------------------------+
                                   |
                            Feature Vectors
                                   |
                                   v
+-----------------------------------------------------------------------+
|                        STACKING ENSEMBLE MODEL                        |
|                                                                         |
|  Base Estimators:                                                      |
|  - Logistic Regression                                                 |
|  - Calibrated Linear SVM                                               |
|  - Random Forest Classifier                                            |
|                                                                         |
|  Meta-Learner:                                                         |
|  - Logistic Regression (Probability Calibrated)                        |
+-----------------------------------------------------------------------+
                                   |
                         Threat Analysis & Score
                                   |
                                   v
+-----------------------------------------------------------------------+
|                           EXPLAINABILITY (XAI)                        |
|                Extracts High-Weight Risk Term Indicators               |
+-----------------------------------------------------------------------+
```

---

## Feature Engineering & ML Pipeline

The ingestion engine transforms unstructured text inputs into a dense representation matrix using three distinct feature extractions joined via `scikit-learn`'s `FeatureUnion`:

1. **Word-Level TF-IDF Vectorization**
   - Captures semantic intent and suspicious phrasing patterns.
   - Parameterized to process unigrams and bigrams (`ngram_range=(1,2)`).

2. **Character N-Gram TF-IDF Vectorization**
   - Captures structural obfuscations, typosquatting, sub-word anomalies, and masking tricks (e.g., `p@ypal` or `sec-ure-login`).
   - Parameterized for character sequences of length 3 to 5 (`ngram_range=(3,5)`).

3. **Custom Structural Feature Extractor (`StructuralFeatureExtractor`)**
   - Extracts deterministic domain metadata and heuristic features.
   - Measures payload length, uppercase ratio, punctuation density, and currency symbols (`$`, `€`, `£`).

---

## API Specification & Payload Schema

### `POST /predict`

Analyzes a raw text payload and returns a risk assessment.

#### Request Headers

```http
Content-Type: application/json
```

#### Request Body

```json
{
  "email_text": "URGENT: Your account access has been limited due to suspicious login attempts. Verify immediately at http://secure-update-login.com or face permanent suspension."
}
```

#### Response Body (200 OK)

```json
{
  "threat_score": 94.52,
  "risk_category": "Critical Threat",
  "is_phishing": true,
  "flagged_keywords": [
    "urgent",
    "account",
    "limited",
    "verify",
    "suspension"
  ]
}
```

---

## Local Development & Setup

### Prerequisites

- Python 3.11+
- Git

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/jatin-sharma-dev/catchphish-ai.git
   cd catchphish-ai
   ```

2. **Establish Environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch Local Server**
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```

5. **Access Application UI**

   Open `frontend/index.html` in your web browser (ensure `API_BASE` in `frontend/script.js` points to `http://127.0.0.1:8000`).

---

## Deployment Strategy

The application is deployed on cloud infrastructure using a decoupled setup:

- **Backend Engine:** Render Web Service running the Python 3 runtime via `uvicorn`.
- **Frontend Interface:** Render Static Site serving optimized HTML5, CSS3, and JavaScript assets.
- **CI/CD Integration:** Automated deployments triggered via `git push` to the primary repository branch.

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.
