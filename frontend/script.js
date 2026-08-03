// const API_BASE = 'http://127.0.0.1:8000'; // FastAPI Backend local-env
const API_BASE = 'https://catchphish-ai.onrender.com'; // Fixed URL to match your Render app (-ai)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. View Switching Logic ---
    const landingView = document.getElementById('landingView');
    const dashboardView = document.getElementById('dashboardView');
    
    function showDashboard() {
        landingView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    function showLanding() {
        dashboardView.classList.add('hidden');
        landingView.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('heroScanBtn').addEventListener('click', showDashboard);
    document.getElementById('brandLogo').addEventListener('click', (e) => {
        e.preventDefault();
        showLanding();
    });

    // --- 2. Live API Health Check ---
    const liveDot = document.getElementById('liveDot');
    const liveLabel = document.getElementById('liveLabel');

    async function checkHealth() {
        try {
            const res = await fetch(`${API_BASE}/`); // Hits the FastAPI health endpoint
            if (!res.ok) throw new Error();
            liveDot.className = 'w-2 h-2 rounded-full status-online';
            liveLabel.textContent = 'API ONLINE';
            liveLabel.style.color = '#16A34A';
        } catch {
            liveDot.className = 'w-2 h-2 rounded-full status-offline';
            liveLabel.textContent = 'API UNREACHABLE';
            liveLabel.style.color = '#E11D48';
        }
    }
    checkHealth();
    setInterval(checkHealth, 10000); // Poll every 10s

    // --- 3. UI Elements & Scanner Logic ---
    const emailInput = document.getElementById('emailInput');
    const scanBtn = document.getElementById('scanBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    const emptyState = document.getElementById('emptyState');
    const analysisDashboard = document.getElementById('analysisDashboard');
    const resultsContainer = document.getElementById('resultsContainer');
    
    const scoreValue = document.getElementById('scoreValue');
    const scoreGauge = document.getElementById('scoreGauge');
    const riskBadge = document.getElementById('riskBadge');
    const flaggedWordsContainer = document.getElementById('flaggedWords');

    const SCAN_BTN_DEFAULT = `<i class="fa-solid fa-magnifying-glass"></i> <span>Scan Email</span>`;
    const SCAN_BTN_LOADING = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Scanning...</span>`;

    // --- 4. Reset Action ---
    resetBtn.addEventListener('click', () => {
        emailInput.value = '';
        analysisDashboard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        resultsContainer.style.borderColor = ''; // reset border to default card border
    });

    // --- 5. API Interaction & Visualization ---
    scanBtn.addEventListener('click', async () => {
        const text = emailInput.value.trim();
        if (!text) {
            alert('Please paste an email first.');
            emailInput.focus();
            return;
        }

        // Set Loading State
        scanBtn.disabled = true;
        scanBtn.innerHTML = SCAN_BTN_LOADING;
        emptyState.classList.add('hidden');
        analysisDashboard.classList.add('hidden');

        try {
            // Updated endpoint to /predict (or adjust to match your main.py route)
            const response = await fetch(`${API_BASE}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_text: text })
            });

            if (!response.ok) throw new Error(`API Request Failed with status ${response.status}`);
            
            const data = await response.json();
            
            // Render Dashboard
            analysisDashboard.classList.remove('hidden');
            
            // Animate Score Value counter
            animateValue(scoreValue, 0, Math.round(data.threat_score), 1000);
            
            // Animate SVG Gauge
            const circumference = 2 * Math.PI * 45; // r=45
            const offset = circumference - (data.threat_score / 100) * circumference;
            scoreGauge.style.strokeDashoffset = offset;

            // Apply Dynamic Risk Colors
            const riskLevel = data.risk_level || data.risk_category || 'Safe';
            let themeColor, bgClass, borderClass, textClass;
            
            if (riskLevel.toLowerCase().includes('critical')) {
                themeColor = '#E11D48'; bgClass = 'bg-critical/10'; borderClass = 'border-critical/30'; textClass = 'text-critical';
            } else if (riskLevel.toLowerCase().includes('suspicious') || riskLevel.toLowerCase().includes('moderate')) {
                themeColor = '#D97706'; bgClass = 'bg-warn/10'; borderClass = 'border-warn/30'; textClass = 'text-warn';
            } else {
                themeColor = '#16A34A'; bgClass = 'bg-safe/10'; borderClass = 'border-safe/30'; textClass = 'text-safe';
            }

            scoreGauge.style.stroke = themeColor;
            scoreValue.style.color = themeColor;
            resultsContainer.style.borderColor = themeColor; // Glow the whole box
            
            riskBadge.textContent = riskLevel;
            riskBadge.className = `mt-6 font-mono px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ${bgClass} ${borderClass} ${textClass}`;

            // Render XAI Flagged Words
            flaggedWordsContainer.innerHTML = '';
            const keywords = data.flagged_words || data.flagged_keywords || data.flagged_indicators || [];
            
            if (keywords.length > 0) {
                keywords.forEach(word => {
                    flaggedWordsContainer.innerHTML += `<span class="px-3 py-1 bg-bgbase border border-ink/10 rounded-lg text-xs font-mono text-ink/70 shadow-sm">${word}</span>`;
                });
            } else {
                flaggedWordsContainer.innerHTML = `<span class="text-xs font-mono text-ink/40">Nothing suspicious found.</span>`;
            }

        } catch (err) {
            console.error(err);
            alert("Couldn't reach the scanner. Make sure the API server is running.");
            emptyState.classList.remove('hidden');
        } finally {
            scanBtn.disabled = false;
            scanBtn.innerHTML = SCAN_BTN_DEFAULT;
        }
    });

    // Helper: Number Counter Animation
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }
});