import os
import sys
import pickle
from contextlib import asynccontextmanager
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 1. Path Configurations & Python Path Fix
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# Import the custom feature extractor from our new dedicated file
from backend.features import StructuralFeatureExtractor


# 2. Strict Input/Output Pydantic Schemas
class EmailRequest(BaseModel):
    email_text: str = Field(
        ..., 
        min_length=5, 
        max_length=20000, 
        description="Raw email text to analyze",
        examples=["URGENT: Your bank account has been locked. Click here to verify your identity."]
    )

class EmailResponse(BaseModel):
    is_phishing: bool
    threat_score: float
    risk_level: str
    flagged_words: List[str]


# 3. Lifespan Context Manager (Modern FastAPI Startup/Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load ML Artifact into Application State
    model_path = os.path.join(BASE_DIR, 'models', 'phishing_model.pkl')
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file missing at: {model_path}. Run train.py first.")

    print(f"Loading CatchPhish AI pipeline from: {model_path}")
    with open(model_path, 'rb') as f:
        app.state.pipeline = pickle.load(f)
    print("Pipeline successfully loaded into memory.")
    
    yield
    # Shutdown: Clean up resources if needed
    app.state.pipeline = None


# 4. App Initialization & Middleware
app = FastAPI(
    title="CatchPhish AI Engine", 
    version="1.0.0",
    description="High-Performance Phishing Detection REST API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 5. REST API Endpoints
@app.get("/", tags=["Health"])
def health_check():
    return {"status": "online", "system": "CatchPhish AI Engine", "version": "1.0.0"}


@app.post("/api/v1/analyze", response_model=EmailResponse, tags=["Inference"])
def analyze_email(data: EmailRequest):
    cleaned_text = data.email_text.strip()
    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email content cannot be empty."
        )
    
    pipeline = app.state.pipeline

    try:
        # Run Inference through the FeatureUnion + Stacking Model
        probabilities = pipeline.predict_proba([cleaned_text])[0]
        phishing_prob = float(probabilities[1])
        threat_score = round(phishing_prob * 100, 2)
        is_phishing = threat_score >= 50.0
        
        # Categorize Risk Level
        if threat_score >= 75.0:
            risk_level = "Critical"
        elif threat_score >= 50.0:
            risk_level = "Suspicious"
        else:
            risk_level = "Safe"

        # Dynamic XAI: Extract top TF-IDF weighted tokens present in THIS input
        flagged_words = []
        features_transformer = pipeline.named_steps.get('features')
        
        if features_transformer:
            # Extract word_tfidf transformer from FeatureUnion
            word_vectorizer = dict(features_transformer.transformer_list)['word_tfidf']
            feature_names = word_vectorizer.get_feature_names_out()
            
            # Vectorize input text to get TF-IDF weights
            text_vector = word_vectorizer.transform([cleaned_text])
            nonzero_indices = text_vector.nonzero()[1]
            scores = text_vector.data

            # Sort tokens in this email by TF-IDF magnitude (descending)
            sorted_token_indices = nonzero_indices[np.argsort(scores)[::-1]]
            
            # Select top 15 impactful tokens
            raw_top_tokens = [feature_names[i] for i in sorted_token_indices[:15]]
            
            # Filter for common phishing indicator sub-phrases or keywords
            suspicious_triggers = {
                'urgent', 'suspend', 'account', 'verify', 'click', 'bank', 
                'password', 'winner', 'claim', 'login', 'wire', 'transfer', 
                'invoice', 'update', 'http', 'security', 'alert', 'confirm'
            }
            
            flagged_words = [
                tok for tok in raw_top_tokens 
                if any(trig in tok for trig in suspicious_triggers)
            ]
            
            # Fallback to top TF-IDF tokens if no trigger matches
            if not flagged_words:
                flagged_words = raw_top_tokens[:8]

        return EmailResponse(
            is_phishing=is_phishing,
            threat_score=threat_score,
            risk_level=risk_level,
            flagged_words=list(dict.fromkeys(flagged_words))[:10]  # Retains order while removing duplicates
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference Pipeline Error: {str(e)}"
        )