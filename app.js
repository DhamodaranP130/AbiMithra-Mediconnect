/**
 * app.js
 * Main Application Logic - Professional Version
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ROUTER ---
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');

    function navigate() {
        const hash = window.location.hash || '#/home';
        const targetPage = hash.replace('#/', '');
        
        pages.forEach(p => p.classList.remove('active'));
        navItems.forEach(n => n.classList.remove('active'));

        const activePage = document.getElementById(`page-${targetPage}`);
        if (activePage) {
            activePage.classList.add('active');
            const activeNav = document.querySelector(`.nav-item[data-target="${targetPage}"]`);
            if (activeNav) activeNav.classList.add('active');
            
            onPageEnter(targetPage);
        } else {
            document.getElementById('page-home').classList.add('active');
        }
    }

    window.addEventListener('hashchange', navigate);
    
    let activeCameraStop = null;
    let waveControl = null;

    function onPageEnter(page) {
        if (activeCameraStop) { activeCameraStop(); activeCameraStop = null; }
        if (waveControl) { waveControl.stop(); waveControl = null; }
        
        document.getElementById('sign-canvas').style.display = 'none';
        document.getElementById('emotion-canvas').style.display = 'none';

        if (page === 'analytics') {
            Simulations.initCharts();
            Simulations.streamText('analytics-ai-summary', "<strong>Facility Insight:</strong> Peak distress levels recorded around 20:00 correlating with shift changes. Module usage is heavily skewed towards Sign Recognition (32%), indicating high reliance on non-verbal communicative tools in triage. Overall system health is nominal.", 15);
        }
        else if (page === 'voice') {
            waveControl = Simulations.startWaveform('waveform-canvas', false);
        }
    }

    // --- SIGN RECOGNITION ---
    const btnSignCam = document.getElementById('toggle-sign-camera');
    const btnClaudeSign = document.getElementById('trigger-claude-sign');
    const signCanvas = document.getElementById('sign-canvas');
    let signCamActive = false;

    btnSignCam.addEventListener('click', () => {
        signCamActive = !signCamActive;
        if (signCamActive) {
            btnSignCam.innerHTML = `<i class="fa-solid fa-stop"></i> Suspend Scanner`;
            btnSignCam.classList.replace('btn-primary', 'btn-outline');
            signCanvas.style.display = 'block';
            activeCameraStop = Simulations.startCameraSimulation('sign-canvas', 'sign');
        } else {
            btnSignCam.innerHTML = `<i class="fa-solid fa-camera"></i> Initialize Scanner`;
            btnSignCam.classList.replace('btn-outline', 'btn-primary');
            signCanvas.style.display = 'none';
            if (activeCameraStop) { activeCameraStop(); activeCameraStop = null; }
        }
    });

    btnClaudeSign.addEventListener('click', () => {
        if (!signCamActive) { alert('Initialize scanner first.'); return; }
        const box = document.getElementById('sign-translation-box');
        const confFill = document.getElementById('sign-confidence');
        const confText = document.getElementById('sign-confidence-val');
        
        box.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing gesture kinematics...';
        confFill.style.width = '0%';
        confText.innerText = '0%';
        
        setTimeout(() => {
            confFill.style.width = '96%';
            confText.innerText = '96%';
            Simulations.streamText('sign-translation-box', 'Patient expresses: "I have a sharp, radiating pain in my chest that started 15 minutes ago."', 15, () => {
                const log = document.getElementById('sign-history-log');
                const empty = log.querySelector('.empty-log');
                if (empty) empty.remove();
                log.innerHTML = `<li><span class="text-muted">[${new Date().toLocaleTimeString()}]</span> Detected: Chest Pain Indicator (Acute)</li>` + log.innerHTML;
            });
        }, 800);
    });

    // --- EMOTION ANALYSIS ---
    const btnEmotionCam = document.getElementById('toggle-emotion-camera');
    const emotionCanvas = document.getElementById('emotion-canvas');
    let emotionCamActive = false;

    btnEmotionCam.addEventListener('click', () => {
        emotionCamActive = !emotionCamActive;
        if (emotionCamActive) {
            btnEmotionCam.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Monitoring`;
            btnEmotionCam.classList.replace('btn-primary', 'btn-outline');
            emotionCanvas.style.display = 'block';
            activeCameraStop = Simulations.startCameraSimulation('emotion-canvas', 'emotion');
            
            Simulations.streamText('emotion-ai-summary', "<strong>Analysis Active:</strong> Monitoring 68 facial landmarks. Baseline established. Searching for micro-expressions associated with neurological distress or pain.", 15);
            
            setInterval(() => {
                if (!emotionCamActive) return;
                const gaugeFill = document.querySelector('#distress-gauge .gauge-fill');
                const label = document.getElementById('distress-label');
                const val = Math.random() * 100;
                gaugeFill.style.left = `${val}%`;
                if (val < 40) label.innerText = "Nominal";
                else if (val < 75) label.innerText = "Elevated Stress";
                else label.innerText = "Acute Distress Detected";
            }, 3000);
        } else {
            btnEmotionCam.innerHTML = `<i class="fa-solid fa-eye"></i> Begin Monitoring`;
            btnEmotionCam.classList.replace('btn-outline', 'btn-primary');
            emotionCanvas.style.display = 'none';
            if (activeCameraStop) { activeCameraStop(); activeCameraStop = null; }
        }
    });

    // --- EMERGENCY ALERTS ---
    const btnSOS = document.getElementById('sos-button');
    const activePanel = document.getElementById('sos-active-panel');
    const countdownEl = document.getElementById('sos-countdown');
    let sosTimer = null; let count = 10;

    btnSOS.addEventListener('click', () => {
        btnSOS.classList.add('pulse');
        activePanel.classList.remove('hidden');
        count = 10; countdownEl.innerText = count;
        
        sosTimer = setInterval(() => {
            count--; countdownEl.innerText = count;
            if (count <= 0) {
                clearInterval(sosTimer);
                countdownEl.innerText = "0 - UNIT DISPATCHED";
                document.getElementById('dispatch-chat').innerHTML += `<div class="chat-msg dispatch"><strong>[DISPATCH]</strong> Code 3 medical response initiated. ETA 7 mins. Secure area.</div>`;
            }
        }, 1000);
    });

    document.getElementById('sos-cancel').addEventListener('click', () => {
        clearInterval(sosTimer);
        btnSOS.classList.remove('pulse');
        activePanel.classList.add('hidden');
    });

    document.getElementById('btn-assess-emergency').addEventListener('click', () => {
        const desc = document.getElementById('emergency-desc').value;
        const resBox = document.getElementById('emergency-assessment-result');
        if (!desc) return;
        
        resBox.classList.remove('hidden');
        resBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running triage protocol...';
        
        setTimeout(() => {
            Simulations.streamText('emergency-assessment-result', "<strong>AI Triage Report</strong><br>Severity: HIGH (Level 2)<br>Primary Concern: Potential cardiac/respiratory event.<br>Action: Immediate dispatch recommended. Connect patient to telemetry.", 10);
        }, 1000);
    });

    // --- HEALTH ASSISTANT ---
    const healthSend = document.getElementById('health-send');
    const healthInput = document.getElementById('health-input');
    const healthChat = document.getElementById('health-chat');

    healthSend.addEventListener('click', () => {
        const text = healthInput.value;
        if (!text) return;
        healthChat.innerHTML += `<div class="chat-msg user">${text}</div>`;
        healthInput.value = '';
        healthChat.scrollTop = healthChat.scrollHeight;

        setTimeout(() => {
            const id = 'msg-' + Date.now();
            healthChat.innerHTML += `<div class="chat-msg system" id="${id}">...</div>`;
            Simulations.streamText(id, "<strong>[AI ASSISTANT]</strong> Acknowledged. I'm noting the reported symptoms in the EHR. Does the patient exhibit any shortness of breath or diaphoresis?", 15, () => {
                healthChat.scrollTop = healthChat.scrollHeight;
            });
        }, 600);
    });
    healthInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') healthSend.click(); });

    // --- MEDICAL RECORDS ---
    document.querySelectorAll('.view-record').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('report-viewer').classList.remove('hidden');
            document.getElementById('report-content').innerHTML = `<h4>Lab Results - Metabolic Panel</h4><p>Glucose: 105 mg/dL (Elevated)</p><p>Creatinine: 0.9 mg/dL (Normal)</p>`;
            Simulations.streamText('record-ai-text', "Analyzed document data. Found slightly elevated glucose indicating possible pre-diabetes. No acute renal issues. Recommend A1C follow-up.", 20);
        });
    });
    document.getElementById('close-report').addEventListener('click', () => document.getElementById('report-viewer').classList.add('hidden'));

    // --- VOICE ASSISTANT ---
    const btnMic = document.getElementById('btn-mic');
    let isMicRecording = false;
    btnMic.addEventListener('click', () => {
        isMicRecording = !isMicRecording;
        if (isMicRecording) {
            btnMic.classList.add('recording');
            document.getElementById('mic-status').innerText = "Dictation active...";
            if (waveControl) waveControl.setRecording(true);
        } else {
            btnMic.classList.remove('recording');
            document.getElementById('mic-status').innerText = "Click to begin dictation";
            if (waveControl) waveControl.setRecording(false);
        }
    });

    // Initial load
    navigate();
});
