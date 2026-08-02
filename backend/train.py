import os
import sys
import glob
import pickle
import pandas as pd
import numpy as np

# 1. Path Configurations & Python Path Fix
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)  # This tells Python where to find the 'backend' module

from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer

from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier, StackingClassifier

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)

# Import the custom feature extractor from our new dedicated file
from backend.features import StructuralFeatureExtractor

DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DATA_DIR = os.path.join(DATA_DIR, 'raw')
MODEL_DIR = os.path.join(BASE_DIR, 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'phishing_model.pkl')


# 2. Schema Normalization Helper
def load_and_standardize_csv(file_path):
    df = pd.read_csv(file_path, low_memory=False)

    text_candidates = ['text_combined', 'text', 'Email Text', 'body', 'subject', 'content']
    found_text_col = next((col for col in text_candidates if col in df.columns), None)
    if not found_text_col:
        found_text_col = df.select_dtypes(include=['object']).columns[0]

    label_candidates = ['label', 'Email Type', 'target', 'class', 'category']
    found_label_col = next((col for col in label_candidates if col in df.columns), None)
    if not found_label_col:
        found_label_col = df.select_dtypes(include=['int', 'float']).columns[-1]

    cleaned_df = pd.DataFrame()
    cleaned_df['text'] = df[found_text_col].astype(str)

    labels = df[found_label_col]
    if labels.dtype == 'object':
        cleaned_df['label'] = labels.str.lower().apply(
            lambda x: 1 if any(term in str(x) for term in ['phish', 'spam', 'fraud', '1']) else 0
        )
    else:
        cleaned_df['label'] = labels.astype(int)

    cleaned_df = cleaned_df.dropna().drop_duplicates()
    return cleaned_df[cleaned_df['text'].str.strip() != '']


# 3. Data Loading
all_csv_files = glob.glob(os.path.join(RAW_DATA_DIR, "*.csv")) + glob.glob(os.path.join(DATA_DIR, "*.csv"))
individual_files = [f for f in all_csv_files if os.path.basename(f) != 'phishing_email.csv']
csv_files = sorted(individual_files) if individual_files else all_csv_files

print(f"Loaded {len(csv_files)} dataset file(s). Preparing train/validation split...")

if len(csv_files) >= 2:
    train_dfs = [load_and_standardize_csv(f) for f in csv_files[:-1]]
    train_df = pd.concat(train_dfs, ignore_index=True)
    val_df = load_and_standardize_csv(csv_files[-1])
else:
    full_df = load_and_standardize_csv(csv_files[0])
    from sklearn.model_selection import train_test_split
    train_df, val_df = train_test_split(full_df, test_size=0.2, random_state=42, stratify=full_df['label'])

print(f"Training Samples: {len(train_df):,} | Validation Samples: {len(val_df):,}\n")

# 4. Build Multi-Feature Fusion Pipeline
print("Constructing Feature Fusion Pipeline (Word TF-IDF + Char TF-IDF + Structural Metrics)...")
feature_fusion = FeatureUnion([
    ('word_tfidf', TfidfVectorizer(
        stop_words='english',
        ngram_range=(1, 2),
        max_features=10000,
        sublinear_tf=True
    )),
    ('char_tfidf', TfidfVectorizer(
        analyzer='char_wb',
        ngram_range=(3, 5),
        max_features=5000,
        sublinear_tf=True
    )),
    ('structural_features', Pipeline([
        ('extractor', StructuralFeatureExtractor()),
        ('scaler', StandardScaler())
    ]))
])

# 5. Fit & Transform Features
X_train_fused = feature_fusion.fit_transform(train_df['text'])
y_train = train_df['label'].values

X_val_fused = feature_fusion.transform(val_df['text'])
y_val = val_df['label'].values

# 6. Model Benchmarking Suite
base_lr = LogisticRegression(max_iter=1000, C=2.0)
base_svm = CalibratedClassifierCV(LinearSVC(max_iter=2000, C=1.0))
base_rf = RandomForestClassifier(n_estimators=100, max_depth=20, random_state=42, n_jobs=-1)

hero_stacking = StackingClassifier(
    estimators=[
        ('lr', base_lr),
        ('svm', base_svm),
        ('rf', base_rf)
    ],
    final_estimator=LogisticRegression(C=1.0),
    cv=3,
    n_jobs=-1
)

models = {
    "Standalone Logistic Regression": base_lr,
    "Calibrated Linear SVM": base_svm,
    "Random Forest": base_rf,
    "🏆 Hero Stacking Ensemble": hero_stacking
}

# 7. Evaluation Execution
results = []
trained_models = {}

print("\n" + "="*80)
print(f"{'MULTI-FEATURE BENCHMARK & STACKING MATRIX':^80}")
print("="*80)

for name, model in models.items():
    print(f"Training {name}...")
    model.fit(X_train_fused, y_train)
    
    y_pred = model.predict(X_val_fused)
    y_proba = model.predict_proba(X_val_fused)[:, 1] if hasattr(model, "predict_proba") else y_pred
    
    results.append({
        "Model": name,
        "Accuracy": accuracy_score(y_val, y_pred),
        "Precision": precision_score(y_val, y_pred, zero_division=0),
        "Recall": recall_score(y_val, y_pred, zero_division=0),
        "F1-Score": f1_score(y_val, y_pred, zero_division=0),
        "ROC-AUC": roc_auc_score(y_val, y_proba)
    })
    trained_models[name] = model

matrix_df = pd.DataFrame(results).sort_values(by="F1-Score", ascending=False)

print("\n" + matrix_df.to_string(index=False, formatters={
    'Accuracy': '{:.2%}'.format,
    'Precision': '{:.2%}'.format,
    'Recall': '{:.2%}'.format,
    'F1-Score': '{:.2%}'.format,
    'ROC-AUC': '{:.2%}'.format
}))
print("="*80)

# 8. Save Final Full Pipeline
champion_name = matrix_df.iloc[0]["Model"]
print(f"\n🏆 Champion Selected: {champion_name}")

final_pipeline = Pipeline([
    ('features', feature_fusion),
    ('classifier', trained_models[champion_name])
])

os.makedirs(MODEL_DIR, exist_ok=True)
with open(MODEL_PATH, 'wb') as file:
    pickle.dump(final_pipeline, file)

print(f"Complete Feature Fusion + Model Pipeline saved to: {MODEL_PATH}")