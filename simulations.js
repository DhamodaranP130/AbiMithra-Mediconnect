/**
 * simulations.js
 * Contains mock AI systems, Canvas drawings, and Chart.js integrations.
 */

// 1. Webcam / Canvas Simulation
function startCameraSimulation(canvasId, type = 'sign') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let animationId;
    let t = 0;

    function draw() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        
        ctx.fillStyle = '#111827'; // Dark gray bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 3, 50, 0, Math.PI * 2);
        ctx.moveTo(canvas.width / 2, canvas.height / 3 + 50);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(canvas.width / 2 - 80, canvas.height / 3 + 80);
        ctx.lineTo(canvas.width / 2 + 80, canvas.height / 3 + 80);
        ctx.stroke();

        if (type === 'sign') {
            const cx = canvas.width / 2 + Math.sin(t * 0.05) * 50;
            const cy = canvas.height / 2 + Math.cos(t * 0.03) * 30;
            
            ctx.fillStyle = '#3B82F6';
            ctx.strokeStyle = '#60A5FA';
            ctx.lineWidth = 2;
            
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(cx, cy + 50);
                const ex = cx + Math.cos(i * 0.8 - 1.6) * 60;
                const ey = cy - Math.sin(i * 0.8) * 80;
                ctx.lineTo(ex, ey);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(ex, ey, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === 'emotion') {
            ctx.fillStyle = '#10B981';
            const cx = canvas.width / 2;
            const cy = canvas.height / 3;
            
            const eyeY = cy - 10 + Math.sin(t * 0.1) * 2;
            ctx.beginPath(); ctx.arc(cx - 20, eyeY, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 20, eyeY, 3, 0, Math.PI*2); ctx.fill();
            
            ctx.strokeStyle = '#10B981';
            ctx.beginPath();
            ctx.moveTo(cx - 15, cy + 20);
            ctx.quadraticCurveTo(cx, cy + 30 + Math.sin(t * 0.05) * 5, cx + 15, cy + 20);
            ctx.stroke();
            
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
            ctx.strokeRect(cx - 60, cy - 60, 120, 120);
        }

        t++;
        animationId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animationId);
}

// 2. Waveform Canvas
function startWaveform(canvasId, isRecording = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let animationId;
    let t = 0;

    function draw() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerY = canvas.height / 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        
        ctx.strokeStyle = isRecording ? '#EF4444' : '#3B82F6';
        ctx.lineWidth = 3;

        const amplitude = isRecording ? 40 + Math.random() * 20 : 5;
        
        for (let i = 0; i < canvas.width; i++) {
            const y = centerY + Math.sin(i * 0.05 + t) * amplitude * Math.sin(i * 0.01);
            ctx.lineTo(i, y);
        }
        ctx.stroke();

        t += 0.2;
        animationId = requestAnimationFrame(draw);
    }
    draw();
    return {
        stop: () => cancelAnimationFrame(animationId),
        setRecording: (val) => { isRecording = val; }
    };
}

// 3. AI Streaming Sim
async function streamText(elementId, text, speed = 20, onComplete = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    let i = 0;
    
    return new Promise(resolve => {
        function typeWriter() {
            if (i < text.length) {
                // handle simple HTML bolding
                if(text.slice(i, i+8) === '<strong>') { el.innerHTML += '<strong>'; i+=8; }
                else if(text.slice(i, i+9) === '</strong>') { el.innerHTML += '</strong>'; i+=9; }
                else if(text.slice(i, i+4) === '<br>') { el.innerHTML += '<br>'; i+=4; }
                else {
                    el.innerHTML += text.charAt(i);
                    i++;
                }
                setTimeout(typeWriter, speed);
            } else {
                if (onComplete) onComplete();
                resolve();
            }
        }
        typeWriter();
    });
}

// 4. Init Charts
let charts = {};
function initCharts() {
    if (!window.Chart) return;
    
    // Emotion Trend Chart (Line)
    const ctxEmotion = document.getElementById('chart-emotion-trend');
    if (ctxEmotion && !charts.emotion) {
        charts.emotion = new Chart(ctxEmotion, {
            type: 'line',
            data: {
                labels: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
                datasets: [{
                    label: 'Patient Distress Index',
                    data: [62, 58, 45, 38, 48, 55, 62, 70],
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }

    // Module Usage (Bar)
    const ctxModule = document.getElementById('chart-module-usage');
    if (ctxModule && !charts.module) {
        charts.module = new Chart(ctxModule, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Usage Sessions',
                    data: [142, 170, 130, 190, 175, 95, 80],
                    backgroundColor: '#3B82F6',
                    borderRadius: 4
                }]
            },
            options: { responsive: true }
        });
    }

    // Module Dist (Doughnut)
    const ctxDist = document.getElementById('chart-module-dist');
    if (ctxDist && !charts.dist) {
        charts.dist = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Sign Rec', 'Emotion', 'Translation', 'Health', 'Voice', 'Emergency'],
                datasets: [{
                    data: [32, 18, 22, 14, 8, 6],
                    backgroundColor: ['#1D4ED8', '#7E22CE', '#047857', '#B91C1C', '#2563EB', '#DC2626']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

window.Simulations = {
    startCameraSimulation,
    startWaveform,
    streamText,
    initCharts
};
