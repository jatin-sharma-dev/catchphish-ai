import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

class StructuralFeatureExtractor(BaseEstimator, TransformerMixin):
    """Extracts structural and behavioral features from raw email text."""
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        features = []
        for text in X:
            t = str(text)
            t_lower = t.lower()
            length = len(t)
            uppercase_ratio = sum(1 for c in t if c.isupper()) / (length + 1)
            exclamation_cnt = t.count('!')
            currency_cnt = t.count('$') + t.count('%') + t.count('€') + t.count('£')
            
            url_indicator_cnt = (
                t_lower.count('http') + 
                t_lower.count('www') + 
                t_lower.count('click') + 
                t_lower.count('login') + 
                t_lower.count('verify')
            )
            features.append([length, uppercase_ratio, exclamation_cnt, currency_cnt, url_indicator_cnt])
        return np.array(features)