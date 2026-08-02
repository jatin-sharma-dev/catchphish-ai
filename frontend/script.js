const API_BASE = 'https://catchphish-ai.onrender.com';

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
            liveLabel.style.color = '#10B981';
        } catch {
            liveDot.className = 'w-2 h-2 rounded-full status-offline';
            liveLabel.textContent = 'API UNREACHABLE';
            liveLabel.style.color = '#EF4444';
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

    // --- 4. Sample Loaders ---
    document.getElementById('samplePhishBtn').addEventListener('click', () => {
        emailInput.value = "URGENT: Your bank account has been suspended due to unauthorized login attempts. Click the secure link below to verify your password and claim your identity immediately. http://secure-update-account.com/login";
    });

    document.getElementById('sampleSafeBtn').addEventListener('click', () => {
        emailInput.value = "Hi team, Just a quick reminder that our weekly engineering sync is scheduled for 3 PM tomorrow. I've attached the agenda to this thread. Let me know if you need to add anything. Thanks!";
    });

    // --- 5. Reset Action ---
    resetBtn.addEventListener('click', () => {
        emailInput.value = '';
        analysisDashboard.classList.add('hidden');
        emptyState.classList.remove('hidden');
        resultsContainer.style.borderColor = '#1e293b'; // reset border
    });

    // --- 6. API Interaction & Visualization ---
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
            const response = await fetch(`${API_BASE}/api/v1/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_text: text })
            });

            if (!response.ok) throw new Error('API Request Failed');
            
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
            let themeColor, bgClass, borderClass, textClass;
            if (data.risk_level === 'Critical') {
                themeColor = '#EF4444'; bgClass = 'bg-critical/10'; borderClass = 'border-critical/30'; textClass = 'text-critical';
            } else if (data.risk_level === 'Suspicious') {
                themeColor = '#F59E0B'; bgClass = 'bg-warn/10'; borderClass = 'border-warn/30'; textClass = 'text-warn';
            } else {
                themeColor = '#10B981'; bgClass = 'bg-safe/10'; borderClass = 'border-safe/30'; textClass = 'text-safe';
            }

            scoreGauge.style.stroke = themeColor;
            scoreValue.style.color = themeColor;
            resultsContainer.style.borderColor = themeColor; // Glow the whole box
            
            riskBadge.textContent = data.risk_level;
            riskBadge.className = `mt-6 font-mono px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ${bgClass} ${borderClass} ${textClass}`;

            // Render XAI Flagged Words
            flaggedWordsContainer.innerHTML = '';
            if (data.flagged_words && data.flagged_words.length > 0) {
                data.flagged_words.forEach(word => {
                    flaggedWordsContainer.innerHTML += `<span class="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-xs font-mono text-slate-300 shadow-sm">${word}</span>`;
                });
            } else {
                flaggedWordsContainer.innerHTML = `<span class="text-xs font-mono text-slate-500">Nothing suspicious found.</span>`;
            }

        } catch (err) {
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
