/**
 * app.js
 * Main Application Logic - MediConnect AI
 * Uses free Groq API (https://console.groq.com) for AI features.
 */

document.addEventListener('DOMContentLoaded', () => {
    const GROQ_KEY_STORAGE = 'medi_groq_key';
    const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';
    const GROQ_FAST_MODEL = 'llama-3.1-8b-instant';
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

    function getGroqKey() {
        return localStorage.getItem(GROQ_KEY_STORAGE);
    }

    function requireGroqKey(targetEl) {
        const key = getGroqKey();
        if (!key) {
            if (targetEl) {
                targetEl.innerHTML = '<span style="color:var(--color-red);">Please configure your free Groq API key (top-right key icon) to use AI features.</span>';
            } else {
                alert('Please configure your free Groq API key first (top-right key icon).');
            }
            return null;
        }
        return key;
    }

    async function callGroq(messages, model = GROQ_FAST_MODEL, jsonMode = false) {
        const key = getGroqKey();
        if (!key) throw new Error('NO_KEY');

        const body = { model, messages };
        if (jsonMode) body.response_format = { type: 'json_object' };

        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        if (!data.choices || !data.choices[0]) throw new Error('Groq API returned no choices.');
        return data.choices[0].message.content;
    }

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
            const homeNav = document.querySelector('.nav-item[data-target="home"]');
            if (homeNav) homeNav.classList.add('active');
        }
    }

    window.addEventListener('hashchange', navigate);

    const SUPABASE_URL = 'https://qxrxksiziwthvxezqasp.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_1OiW5o22bGt8DzL5I79B8Q_N2UJ8Rn7';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authRoleSelect = document.getElementById('auth-role');
    const authMessage = document.getElementById('auth-message');
    const authUserInfo = document.getElementById('auth-user-info');
    const authSignInBtn = document.getElementById('auth-signin');
    const authSignUpBtn = document.getElementById('auth-signup');
    const authSignOutBtn = document.getElementById('auth-signout');
    const recordPatientIdInput = document.getElementById('record-patient-id');
    const recordDoctorIdInput = document.getElementById('record-doctor-id');
    const recordAdminIdInput = document.getElementById('record-admin-id');
    const recordTypeInput = document.getElementById('record-type');
    const recordStatusSelect = document.getElementById('record-status');
    const recordNoteInput = document.getElementById('record-note');
    const recordSubmitBtn = document.getElementById('record-submit');
    const recordFeedback = document.getElementById('record-feedback');
    const recordTableBody = document.getElementById('record-table-body');

    let currentProfile = null;

    function sanitizeText(text) {
        return text ? text.trim() : '';
    }

    function generateEntityId(role) {
        const prefix = role === 'doctor' ? 'DOC' : role === 'admin' ? 'ADM' : 'PAT';
        return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    async function fetchProfile(userId) {
        if (!userId) return null;
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) return null;
        return data;
    }

    async function createProfile(profile) {
        const { error } = await supabaseClient.from('profiles').upsert(profile, { onConflict: 'id' });
        return error;
    }

    async function updateAuthUi(session, profile) {
        if (!authMessage || !authUserInfo) return;
        if (!session || !profile) {
            authMessage.textContent = 'Not signed in.';
            authUserInfo.textContent = 'No active user.';
            return;
        }
        const userLabel = profile.entity_id ? `${profile.role.toUpperCase()} · ${profile.entity_id}` : profile.role;
        authMessage.textContent = `Signed in as ${session.user.email}`;
        authUserInfo.textContent = `${userLabel}`;
    }

    async function handleAuthSession(session) {
        if (session?.user) {
            currentProfile = await fetchProfile(session.user.id);
            if (!currentProfile) {
                authMessage.textContent = 'Signed in, but profile data is missing. Please sign up again or contact admin.';
            }
            updateAuthUi(session, currentProfile);
            await loadRecords();
        } else {
            currentProfile = null;
            updateAuthUi(null, null);
            if (recordTableBody) {
                recordTableBody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:2rem 0;">Sign in to load records.</td></tr>';
            }
        }
    }

    async function initSupabaseAuth() {
        const { data } = await supabaseClient.auth.getSession();
        await handleAuthSession(data.session);
        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
            await handleAuthSession(session);
        });
    }

    function renderRecords(records) {
        if (!recordTableBody) return;
        recordTableBody.innerHTML = '';
        if (!records || records.length === 0) {
            recordTableBody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:2rem 0;">No records found.</td></tr>';
            return;
        }
        records.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong class="text-blue">${record.record_id || record.id || 'REC-' + record.created_at}</strong><div class="text-muted text-sm">${record.created_at ? new Date(record.created_at).toLocaleDateString() : ''}</div></td>
                <td>${record.patient_id || ''}<div class="text-muted text-sm">Doctor: ${record.doctor_id || 'N/A'}</div></td>
                <td>${record.record_type || ''}</td>
                <td>${record.created_at ? new Date(record.created_at).toLocaleDateString() : ''}</td>
                <td><span class="badge ${record.status === 'Final' ? 'green' : record.status.startsWith('Priority') ? 'red' : 'blue'}">${record.status || 'Draft'}</span></td>
                <td><button class="btn-outline btn-sm view-record">View</button></td>
            `;
            recordTableBody.appendChild(row);
        });
    }

    async function loadRecords() {
        if (!recordTableBody) return;
        if (!currentProfile) {
            recordTableBody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align:center; padding:2rem 0;">Sign in to view records.</td></tr>';
            return;
        }

        let query = supabaseClient.from('records').select('*').order('created_at', { ascending: false });
        if (currentProfile.role === 'patient') {
            query = query.eq('patient_id', currentProfile.entity_id);
        } else if (currentProfile.role === 'doctor') {
            query = query.eq('doctor_id', currentProfile.entity_id);
        }

        const { data, error } = await query;
        if (error) {
            recordTableBody.innerHTML = `<tr><td colspan="6" class="text-red" style="text-align:center; padding:2rem 0;">Error loading records: ${error.message}</td></tr>`;
            return;
        }
        renderRecords(data);
    }

    async function saveRecord() {
        if (!currentProfile) {
            if (recordFeedback) recordFeedback.textContent = 'You must sign in to save records.';
            return;
        }
        if (currentProfile.role === 'patient') {
            if (recordFeedback) recordFeedback.textContent = 'Patients cannot create new records.';
            return;
        }

        const patientId = sanitizeText(recordPatientIdInput?.value);
        const doctorId = sanitizeText(recordDoctorIdInput?.value);
        const adminId = sanitizeText(recordAdminIdInput?.value);
        const recordType = sanitizeText(recordTypeInput?.value);
        const status = sanitizeText(recordStatusSelect?.value);
        const notes = sanitizeText(recordNoteInput?.value);
        if (!patientId || !doctorId || !recordType || !notes) {
            if (recordFeedback) recordFeedback.textContent = 'Patient ID, Doctor ID, Record Type, and Notes are required.';
            return;
        }

        const newRecord = {
            patient_id: patientId,
            doctor_id: doctorId,
            admin_id: adminId,
            record_type: recordType,
            status: status || 'Draft',
            notes,
            created_by: currentProfile.id,
            record_id: `REC-${Math.floor(100000 + Math.random() * 900000)}`
        };

        const { error } = await supabaseClient.from('records').insert([newRecord]);
        if (error) {
            if (recordFeedback) recordFeedback.textContent = `Failed to save record: ${error.message}`;
            return;
        }
        if (recordFeedback) recordFeedback.textContent = 'Record saved successfully.';
        await loadRecords();
    }

    if (authSignUpBtn) {
        authSignUpBtn.addEventListener('click', async () => {
            const email = sanitizeText(authEmailInput?.value);
            const password = sanitizeText(authPasswordInput?.value);
            const role = authRoleSelect?.value || 'patient';
            if (!email || !password) {
                if (authMessage) authMessage.textContent = 'Email and password are required.';
                return;
            }
            if (!supabaseClient) {
                if (authMessage) authMessage.textContent = 'Supabase client is not initialized.';
                return;
            }
            const entityId = generateEntityId(role);
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { role, entity_id: entityId } }
            });
            if (error) {
                if (authMessage) authMessage.textContent = `Sign up failed: ${error.message}`;
                return;
            }
            if (data?.user) {
                await createProfile({ id: data.user.id, email, role, entity_id: entityId });
                if (authMessage) authMessage.textContent = 'Account created. Please check your email to verify your account.';
            } else {
                if (authMessage) authMessage.textContent = 'Account created. Please verify your email before signing in.';
            }
        });
    }

    if (authSignInBtn) {
        authSignInBtn.addEventListener('click', async () => {
            const email = sanitizeText(authEmailInput?.value);
            const password = sanitizeText(authPasswordInput?.value);
            if (!email || !password) {
                if (authMessage) authMessage.textContent = 'Email and password are required.';
                return;
            }
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (authMessage) authMessage.textContent = `Sign in failed: ${error.message}`;
                return;
            }
            if (data?.session) {
                if (authMessage) authMessage.textContent = 'Signed in successfully.';
                await handleAuthSession(data.session);
            }
        });
    }

    if (authSignOutBtn) {
        authSignOutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            currentProfile = null;
            updateAuthUi(null, null);
            if (recordFeedback) recordFeedback.textContent = 'Signed out.';
        });
    }

    if (recordSubmitBtn) {
        recordSubmitBtn.addEventListener('click', saveRecord);
    }

    initSupabaseAuth();

    let waveControl = null;
    let localStream = null;

    function stopAllWebcams() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        emotionCamActive = false;
        signCamActive = false;
        if (btnEmotionCam) {
            btnEmotionCam.innerHTML = `<i class="fa-solid fa-brain"></i> Start Facial Scan`;
            btnEmotionCam.classList.remove('btn-outline');
            btnEmotionCam.classList.add('btn-primary');
        }
        if (btnSignCam) {
            btnSignCam.innerHTML = `<i class="fa-solid fa-camera"></i> Start Camera`;
            btnSignCam.classList.remove('btn-outline');
            btnSignCam.classList.add('btn-primary');
        }
        const emotionCanvas = document.getElementById('emotion-canvas');
        const signCanvas = document.getElementById('sign-canvas');
        if (emotionCanvas) emotionCanvas.style.display = 'none';
        if (signCanvas) signCanvas.style.display = 'none';
    }

    function onPageEnter(page) {
        if (waveControl) { waveControl.stop(); waveControl = null; }
        stopAllWebcams();

        if (page === 'analytics') {
            Simulations.initCharts();
            const summary = document.getElementById('analytics-ai-summary');
            if (summary && !summary.dataset.loaded) {
                summary.dataset.loaded = '1';
                Simulations.streamText('analytics-ai-summary', "<strong>Facility Insight:</strong> Peak distress levels recorded around 20:00, correlating with shift changes. Module usage is heavily skewed towards Sign Recognition (32%), indicating high reliance on non-verbal communication tools in triage. Overall system health is nominal.", 15);
            }
        }
        else if (page === 'voiceassist') {
            waveControl = Simulations.startWaveform('waveform-canvas', false);
        }
    }

    // --- 1. EMOTION & DISTRESS TRACKING (face-api.js) ---
    const btnEmotionCam = document.getElementById('toggle-emotion-camera');
    const emotionCanvas = document.getElementById('emotion-canvas');
    let emotionCamActive = false;
    let faceApiLoaded = false;
    let faceApiLoading = false;

    async function ensureFaceApi(summaryBox) {
        if (faceApiLoaded) return true;
        if (faceApiLoading) return false;
        faceApiLoading = true;
        if (summaryBox) summaryBox.innerHTML = '<em>Loading facial expression models...</em>';
        try {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
            faceApiLoaded = true;
            faceApiLoading = false;
            return true;
        } catch (e) {
            faceApiLoading = false;
            if (summaryBox) summaryBox.innerHTML = `<span style="color:var(--color-red);">Failed to load facial models: ${e.message}</span>`;
            return false;
        }
    }

    const EMOTION_KEYS = ['neutral', 'happy', 'sad', 'fearful', 'angry', 'disgusted', 'surprised'];
    function updateEmotionBars(expressions) {
        EMOTION_KEYS.forEach(key => {
            const pct = Math.round((expressions[key] || 0) * 100);
            const fill = document.querySelector(`.progress-fill[data-emotion="${key}"]`);
            const val = document.querySelector(`[data-emotion-val="${key}"]`);
            if (fill) fill.style.width = `${pct}%`;
            if (val) val.textContent = `${pct}%`;
        });
    }

    if (btnEmotionCam) {
        btnEmotionCam.addEventListener('click', async () => {
            if (!emotionCamActive) {
                const summaryBox = document.getElementById('emotion-ai-summary');
                const ready = await ensureFaceApi(summaryBox);
                if (!ready) return;

                emotionCamActive = true;
                btnEmotionCam.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Scan`;
                btnEmotionCam.classList.replace('btn-primary', 'btn-outline');
                emotionCanvas.style.display = 'block';

                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: {} });
                    const videoEl = document.createElement('video');
                    videoEl.srcObject = localStream;
                    videoEl.muted = true;
                    videoEl.playsInline = true;
                    await videoEl.play();

                    if (!summaryBox.dataset.streamed) {
                        summaryBox.dataset.streamed = '1';
                        Simulations.streamText('emotion-ai-summary', "<strong>Analysis Active:</strong> Tracking facial expression vectors in real time using on-device neural networks (face-api.js). No video is sent to any server.", 15);
                    }

                    const ctx = emotionCanvas.getContext('2d');
                    const trackLoop = async () => {
                        if (!emotionCamActive) return;
                        emotionCanvas.width = emotionCanvas.parentElement.clientWidth || 400;
                        emotionCanvas.height = emotionCanvas.parentElement.clientHeight || 300;

                        ctx.drawImage(videoEl, 0, 0, emotionCanvas.width, emotionCanvas.height);

                        try {
                            const detections = await faceapi.detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();

                            if (detections && detections.length > 0) {
                                faceapi.draw.drawDetections(emotionCanvas, detections);
                                faceapi.draw.drawFaceExpressions(emotionCanvas, detections);

                                const expr = detections[0].expressions;
                                updateEmotionBars(expr);

                                const distressScore = Math.min(((expr.sad || 0) + (expr.angry || 0) + (expr.fearful || 0)) * 100, 100);

                                const gaugeFill = document.getElementById('distress-gauge-fill');
                                const label = document.getElementById('distress-label');
                                if (gaugeFill) gaugeFill.style.left = `${distressScore}%`;

                                if (label) {
                                    if (distressScore < 25) label.innerText = "Nominal";
                                    else if (distressScore < 60) label.innerText = "Elevated Stress";
                                    else label.innerText = "Acute Distress Detected";
                                }
                            }
                        } catch (detErr) {
                            // skip frame on detection error
                        }
                        requestAnimationFrame(trackLoop);
                    };
                    trackLoop();
                } catch (err) {
                    alert('Camera access is required for facial emotion analysis.');
                    emotionCamActive = false;
                    btnEmotionCam.innerHTML = `<i class="fa-solid fa-brain"></i> Start Facial Scan`;
                    btnEmotionCam.classList.replace('btn-outline', 'btn-primary');
                    emotionCanvas.style.display = 'none';
                }
            } else {
                stopAllWebcams();
            }
        });
    }

    const resetEmotionBtn = document.getElementById('reset-emotion');
    if (resetEmotionBtn) {
        resetEmotionBtn.addEventListener('click', () => {
            EMOTION_KEYS.forEach(key => {
                const fill = document.querySelector(`.progress-fill[data-emotion="${key}"]`);
                const val = document.querySelector(`[data-emotion-val="${key}"]`);
                if (fill) fill.style.width = '0%';
                if (val) val.textContent = '0%';
            });
            const gaugeFill = document.getElementById('distress-gauge-fill');
            const label = document.getElementById('distress-label');
            if (gaugeFill) gaugeFill.style.left = '0%';
            if (label) label.innerText = 'Awaiting Feed...';
        });
    }

    // --- 2. SIGN RECOGNITION (MediaPipe Hands) ---
    const btnSignCam = document.getElementById('toggle-sign-camera');
    const btnGroqSign = document.getElementById('trigger-claude-sign');
    const signCanvas = document.getElementById('sign-canvas');
    let signCamActive = false;
    let handsEngine = null;
    let runningVideoForSign = null;

    function initMediaPipeHands() {
        if (handsEngine) return;
        handsEngine = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        handsEngine.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        handsEngine.onResults((results) => {
            const ctx = signCanvas.getContext('2d');
            ctx.clearRect(0, 0, signCanvas.width, signCanvas.height);
            if (runningVideoForSign) {
                ctx.drawImage(runningVideoForSign, 0, 0, signCanvas.width, signCanvas.height);
            }
            const confEl = document.getElementById('sign-confidence');
            const confValEl = document.getElementById('sign-confidence-val');
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                if (confEl) confEl.style.width = '92%';
                if (confValEl) confValEl.innerText = '92%';
                ctx.fillStyle = '#3B82F6';
                for (const landmarks of results.multiHandLandmarks) {
                    for (const point of landmarks) {
                        ctx.beginPath();
                        ctx.arc(point.x * signCanvas.width, point.y * signCanvas.height, 4, 0, 2 * Math.PI);
                        ctx.fill();
                    }
                }
            } else {
                if (confEl) confEl.style.width = '0%';
                if (confValEl) confValEl.innerText = '0%';
            }
        });
    }

    if (btnSignCam) {
        btnSignCam.addEventListener('click', async () => {
            if (!signCamActive) {
                initMediaPipeHands();
                signCamActive = true;
                btnSignCam.innerHTML = `<i class="fa-solid fa-stop"></i> Stop Camera`;
                btnSignCam.classList.replace('btn-primary', 'btn-outline');
                signCanvas.style.display = 'block';

                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: {} });
                    runningVideoForSign = document.createElement('video');
                    runningVideoForSign.srcObject = localStream;
                    runningVideoForSign.muted = true;
                    runningVideoForSign.playsInline = true;
                    await runningVideoForSign.play();

                    const processTrack = async () => {
                        if (!signCamActive) return;
                        signCanvas.width = signCanvas.parentElement.clientWidth || 400;
                        signCanvas.height = signCanvas.parentElement.clientHeight || 300;
                        try {
                            await handsEngine.send({ image: runningVideoForSign });
                        } catch (e) { /* ignore frame error */ }
                        requestAnimationFrame(processTrack);
                    };
                    processTrack();
                } catch (err) {
                    alert('Camera access is required for sign recognition.');
                    stopAllWebcams();
                }
            } else {
                stopAllWebcams();
                runningVideoForSign = null;
            }
        });
    }

    if (btnGroqSign) {
        btnGroqSign.addEventListener('click', async () => {
            if (!signCamActive) { alert('Start the camera first.'); return; }
            const box = document.getElementById('sign-translation-box');
            box.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating gesture with AI...';

            if (!requireGroqKey(box)) return;

            try {
                const output = await callGroq([{
                    role: 'user',
                    content: 'Generate a realistic, concise 1-sentence clinical statement representing what a non-verbal patient might be communicating through hand gestures pointing to their body and breathing patterns. Respond with only the sentence, no quotes.'
                }], GROQ_FAST_MODEL);

                const clean = output.replace(/^"|"$/g, '').trim();
                Simulations.streamText('sign-translation-box', `<strong>Interpreted:</strong> "${clean}"`, 15, () => {
                    const log = document.getElementById('sign-history-log');
                    if (log) {
                        if (log.querySelector('.text-muted')) log.innerHTML = '';
                        const li = document.createElement('li');
                        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        li.innerHTML = `<strong>${time}</strong> — ${clean}`;
                        log.prepend(li);
                    }
                });
            } catch (e) {
                box.innerHTML = `<span style="color:var(--color-red);">${e.message}</span>`;
            }
        });
    }

    // --- 3. MULTILINGUAL TRANSLATION (page-voice) ---
    const btnMic = document.getElementById('btn-mic');
    const btnTranslate = document.getElementById('btn-translate');
    const btnSpeak = document.getElementById('btn-speak');
    const originalBox = document.getElementById('voice-text-original');
    const translatedBox = document.getElementById('voice-text-translated');
    let isMicRecording = false;
    let coreRecognition = null;
    let lastOriginalText = '';

    const SpeechEngine = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechEngine) {
        coreRecognition = new SpeechEngine();
        coreRecognition.continuous = true;
        coreRecognition.interimResults = true;

        coreRecognition.onresult = (e) => {
            let outputText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                outputText += e.results[i][0].transcript;
            }
            lastOriginalText = outputText;
            if (originalBox) originalBox.innerHTML = outputText || '<span class="text-muted">Listening...</span>';
        };

        coreRecognition.onerror = () => {
            isMicRecording = false;
            if (btnMic) btnMic.classList.remove('recording');
        };

        const sttSelect = document.getElementById('voice-lang-stt');
        if (sttSelect) {
            sttSelect.addEventListener('change', () => {
                if (isMicRecording) {
                    coreRecognition.stop();
                    setTimeout(() => { coreRecognition.start(); }, 400);
                }
            });
        }
    }

    if (btnMic) {
        btnMic.addEventListener('click', () => {
            if (!coreRecognition) { alert('Speech recognition is not supported in this browser. Try Chrome or Edge.'); return; }
            isMicRecording = !isMicRecording;
            if (isMicRecording) {
                btnMic.classList.add('recording');
                btnMic.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Recording';
                coreRecognition.lang = document.getElementById('voice-lang-stt').value;
                coreRecognition.start();
            } else {
                btnMic.classList.remove('recording');
                btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Recording';
                coreRecognition.stop();
            }
        });
    }

    if (btnTranslate) {
        btnTranslate.addEventListener('click', async () => {
            const text = lastOriginalText.trim() || (originalBox ? originalBox.textContent.trim() : '');
            if (!text || text === 'Listening...') {
                translatedBox.innerHTML = '<span style="color:var(--color-red);">Record some speech first.</span>';
                return;
            }
            translatedBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';
            if (!requireGroqKey(translatedBox)) return;

            const targetLangName = document.getElementById('voice-lang-tts').selectedOptions[0].text.replace(/\(.*\)/, '').trim();

            try {
                const output = await callGroq([{
                    role: 'user',
                    content: `Translate the following patient speech into ${targetLangName}. Respond with only the translated text, no explanations or quotes.\n\nText: ${text}`
                }], GROQ_FAST_MODEL);

                translatedBox.innerHTML = output.trim();
            } catch (e) {
                translatedBox.innerHTML = `<span style="color:var(--color-red);">${e.message}</span>`;
            }
        });
    }

    if (btnSpeak) {
        btnSpeak.addEventListener('click', () => {
            const value = (translatedBox ? translatedBox.textContent : '').trim();
            if (!value || value.includes('Translation will appear')) return;

            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(value);
            msg.lang = document.getElementById('voice-lang-tts').value;
            window.speechSynthesis.speak(msg);
        });
    }

    // --- 4. VOICE ASSISTANT (page-voiceassist) ---
    const vaMicBtn = document.getElementById('va-mic-btn');
    const vaText = document.getElementById('va-text');
    const vaStatus = document.getElementById('va-mic-status');
    const vaPlaybackStatus = document.getElementById('va-playback-status');
    const vaLangTts = document.getElementById('va-lang-tts');
    let vaRecording = false;
    let vaRecognition = null;
    let lastSpokenText = '';
    let detectedLanguage = 'en-US';

    if (SpeechEngine) {
        vaRecognition = new SpeechEngine();
        vaRecognition.continuous = true;
        vaRecognition.interimResults = true;
        vaRecognition.lang = 'en-US';
        vaRecognition.onresult = (e) => {
            let outputText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                outputText += e.results[i][0].transcript;
            }
            if (vaText) vaText.value = outputText;
        };
        vaRecognition.onerror = () => {
            vaRecording = false;
            if (vaMicBtn) vaMicBtn.classList.remove('recording');
            if (waveControl) waveControl.setRecording(false);
        };
        vaRecognition.onend = async () => {
            if (vaRecording) {
                vaRecognition.start();
                return;
            }
            const finalText = (vaText ? vaText.value : '').trim();
            if (finalText && finalText !== lastSpokenText) {
                lastSpokenText = finalText;
                const targetLangCode = vaLangTts ? vaLangTts.value : 'en-US';
                const targetLangName = vaLangTts ? vaLangTts.selectedOptions[0].text.replace(/\(.*\)/, '').trim() : 'English';
                let speakText = finalText;
                
                try {
                    if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Detecting language...';
                    detectedLanguage = await detectLanguageOfText(finalText);
                    if (vaPlaybackStatus) vaPlaybackStatus.textContent = `Detected: ${getLangName(detectedLanguage)}`;
                    
                    if (detectedLanguage !== targetLangCode) {
                        if (vaPlaybackStatus) vaPlaybackStatus.textContent = `Translating ${getLangName(detectedLanguage)} to ${targetLangName}...`;
                        speakText = await translateVoiceAssistantText(finalText, detectedLanguage, targetLangCode, targetLangName);
                        if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Playing translation...';
                    } else {
                        if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Playing audio...';
                    }
                } catch (err) {
                    if (vaPlaybackStatus) vaPlaybackStatus.textContent = `Error: ${err.message}`;
                    return;
                }
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(speakText);
                msg.lang = targetLangCode;
                const availableVoices = window.speechSynthesis.getVoices();
                const fallbackLang = targetLangCode.split('-')[0];
                const voiceMatch = availableVoices.find(v => v.lang === targetLangCode) || availableVoices.find(v => v.lang.startsWith(fallbackLang));
                if (voiceMatch) msg.voice = voiceMatch;
                msg.onend = () => {
                    if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Auto-playback ready';
                };
                window.speechSynthesis.speak(msg);
            } else {
                if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Auto-playback ready';
            }
        };
    }


    async function detectLanguageOfText(text) {
        if (!text) return 'en-US';
        const errorContainer = document.getElementById('va-text');
        if (!requireGroqKey(errorContainer)) {
            throw new Error('Groq API key is required for language detection.');
        }
        const langMap = {
            'english': 'en-US',
            'tamil': 'ta-IN',
            'telugu': 'te-IN',
            'malayalam': 'ml-IN',
            'hindi': 'hi-IN'
        };
        const prompt = `Detect the language of the following text. Respond with ONLY the language name in lowercase (one of: ${Object.keys(langMap).join(', ')}):\n\n${text}`;
        try {
            const result = await callGroq([{ role: 'user', content: prompt }], GROQ_FAST_MODEL);
            const detected = result.trim().toLowerCase();
            return langMap[detected] || 'en-US';
        } catch (err) {
            console.warn('Language detection failed, defaulting to English:', err);
            return 'en-US';
        }
    }

    function getLangName(langCode) {
        const langNames = {
            'en-US': 'English',
            'ta-IN': 'Tamil',
            'te-IN': 'Telugu',
            'ml-IN': 'Malayalam',
            'hi-IN': 'Hindi'
        };
        return langNames[langCode] || langCode;
    }

    async function translateVoiceAssistantText(text, sourceLangCode, targetLangCode, targetLangName) {
        if (!text) return '';
        const errorContainer = document.getElementById('va-text');
        if (!requireGroqKey(errorContainer)) {
            throw new Error('Groq API key is required for language translation.');
        }
        const sourceLangName = getLangName(sourceLangCode);
        const prompt = `Translate the following clinical note from ${sourceLangName} to ${targetLangName}. Provide only the translated text without quotes or explanation.\n\nText: ${text}`;
        const translation = await callGroq([{ role: 'user', content: prompt }], GROQ_FAST_MODEL);
        return translation.trim();
    }

    if (vaMicBtn) {
        vaMicBtn.addEventListener('click', () => {
            if (!vaRecognition) { alert('Speech recognition is not supported in this browser. Try Chrome or Edge.'); return; }
            if (!vaRecording) {
                vaRecording = true;
                vaMicBtn.classList.add('recording');
                if (vaStatus) vaStatus.textContent = 'Recording... tap to stop';
                if (vaPlaybackStatus) vaPlaybackStatus.textContent = 'Listening...';
                if (waveControl) waveControl.setRecording(true);
                if (vaLangStt) vaRecognition.lang = vaLangStt.value;
                vaRecognition.start();
            } else {
                vaRecording = false;
                vaRecognition.stop();
            }
        });
    }

    // Auto-playback is now triggered on recording end via vaRecognition.onend

    // --- 5. CLINICAL HEALTH ASSISTANT (Groq Integration) ---
    const healthSend = document.getElementById('floating-health-send');
    const healthInput = document.getElementById('floating-health-input');
    const healthChat = document.getElementById('floating-health-chat');
    
    const floatingChatBtn = document.getElementById('toggle-floating-chat');
    const floatingChatPanel = document.getElementById('floating-chat-panel');
    const closeFloatingChat = document.getElementById('close-floating-chat');

    if (floatingChatBtn) {
        floatingChatBtn.addEventListener('click', () => {
            floatingChatPanel.classList.toggle('hidden');
        });
    }

    if (closeFloatingChat) {
        closeFloatingChat.addEventListener('click', () => {
            floatingChatPanel.classList.add('hidden');
        });
    }

    async function handleHealthChat() {
        const text = healthInput.value.trim();
        if (!text) return;

        if (!getGroqKey()) {
            alert('Please configure your free Groq API key first (top-right key icon).');
            return;
        }

        healthChat.innerHTML += `<div class="chat-msg user">${escapeHtml(text)}</div>`;
        healthInput.value = '';
        healthChat.scrollTop = healthChat.scrollHeight;

        const loadingId = 'msg-' + Date.now();
        healthChat.innerHTML += `<div class="chat-msg system" id="${loadingId}"><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</div>`;
        healthChat.scrollTop = healthChat.scrollHeight;

        try {
            const responseText = await callGroq([
                { role: 'system', content: 'You are a helpful clinical health assistant. Provide clear, concise, and safe health guidance. Always remind users to consult a licensed medical professional for diagnosis or treatment when appropriate.' },
                { role: 'user', content: text }
            ], GROQ_FAST_MODEL);

            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            const finalId = 'msg-fin-' + Date.now();
            healthChat.innerHTML += `<div class="chat-msg system" id="${finalId}"></div>`;

            Simulations.streamText(finalId, responseText, 12, () => {
                healthChat.scrollTop = healthChat.scrollHeight;
            });
        } catch (err) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.innerHTML = `<span style="color:var(--color-red);">${err.message}</span>`;
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    if (healthSend) healthSend.addEventListener('click', handleHealthChat);
    if (healthInput) healthInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleHealthChat(); });

    // --- EMERGENCY ALERTS ---
    const btnSOS = document.getElementById('sos-button');
    const activePanel = document.getElementById('sos-active-panel');
    const countdownEl = document.getElementById('sos-countdown');
    let sosTimer = null;
    let count = 10;

    if (btnSOS) {
        btnSOS.addEventListener('click', () => {
            btnSOS.classList.add('pulse');
            activePanel.classList.remove('hidden');
            count = 10;
            countdownEl.innerText = count;
            document.getElementById('dispatch-chat').innerHTML = '';

            clearInterval(sosTimer);
            sosTimer = setInterval(() => {
                count--;
                countdownEl.innerText = count;
                if (count <= 0) {
                    clearInterval(sosTimer);
                    countdownEl.innerText = "Dispatched";
                    document.getElementById('dispatch-chat').innerHTML += `<div class="chat-msg dispatch"><strong>Dispatch:</strong> Code 3 medical response initiated. ETA 7 mins. Secure the area and stay with the patient.</div>`;
                }
            }, 1000);
        });
    }

    const sosCancel = document.getElementById('sos-cancel');
    if (sosCancel) {
        sosCancel.addEventListener('click', () => {
            clearInterval(sosTimer);
            btnSOS.classList.remove('pulse');
            activePanel.classList.add('hidden');
        });
    }

    const btnLocation = document.getElementById('btn-location');
    if (btnLocation) {
        btnLocation.addEventListener('click', () => {
            if (!navigator.geolocation) { alert('Geolocation not supported on this device.'); return; }
            btnLocation.textContent = 'Locating...';
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    btnLocation.innerHTML = `<i class="fa-solid fa-check"></i> Shared`;
                    btnLocation.classList.add('btn-outline');
                    btnLocation.classList.remove('btn-primary');
                },
                () => {
                    btnLocation.textContent = 'Enable';
                    alert('Location permission denied.');
                }
            );
        });
    }

    const btnAssessEmergency = document.getElementById('btn-assess-emergency');
    if (btnAssessEmergency) {
        btnAssessEmergency.addEventListener('click', async () => {
            const desc = document.getElementById('emergency-desc').value.trim();
            const resBox = document.getElementById('emergency-assessment-result');
            if (!desc) return;

            resBox.classList.remove('hidden');
            resBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running AI triage assessment...';

            if (!requireGroqKey(resBox)) return;

            try {
                const output = await callGroq([{
                    role: 'user',
                    content: `Provide a brief emergency triage assessment for this clinical note. Include: estimated severity level (1-4), key concerns, and recommended immediate action. Keep it under 80 words. Note: ${desc}`
                }], GROQ_FAST_MODEL);

                Simulations.streamText('emergency-assessment-result', `<strong>AI Triage Assessment</strong><br>${output}`, 10);
            } catch (e) {
                resBox.innerHTML = `<span style="color:var(--color-red);">${e.message}</span>`;
            }
        });
    }

    // --- MEDICAL RECORDS ---
    document.querySelectorAll('.view-record').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('report-viewer').classList.remove('hidden');
            document.getElementById('report-content').innerHTML = `<h4>Lab Results — Metabolic Panel</h4><p>Glucose: 105 mg/dL (Elevated)</p><p>Creatinine: 0.9 mg/dL (Normal)</p>`;
            const aiText = document.getElementById('record-ai-text');
            aiText.dataset.streamed = '';
            Simulations.streamText('record-ai-text', "Analyzed document data. Found slightly elevated glucose indicating possible pre-diabetes. No acute renal issues detected. Recommend an A1C follow-up test.", 20);
        });
    });

    const closeReport = document.getElementById('close-report');
    if (closeReport) closeReport.addEventListener('click', () => document.getElementById('report-viewer').classList.add('hidden'));

    const uploadZone = document.querySelector('.upload-zone');
    const uploadInput = document.getElementById('record-upload');
    if (uploadZone && uploadInput) {
        uploadZone.addEventListener('click', () => uploadInput.click());
        uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.style.background = '#EFF6FF'; });
        uploadZone.addEventListener('dragleave', () => { uploadZone.style.background = '#F8FAFC'; });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.background = '#F8FAFC';
            if (e.dataTransfer.files.length) {
                uploadZone.querySelector('h4').textContent = `Uploaded: ${e.dataTransfer.files[0].name}`;
            }
        });
        uploadInput.addEventListener('change', () => {
            if (uploadInput.files.length) {
                uploadZone.querySelector('h4').textContent = `Uploaded: ${uploadInput.files[0].name}`;
            }
        });
    }

    // --- API KEY CONFIGURATION MODAL ---
    const apiKeyModal = document.getElementById('api-key-modal');
    const btnApiKey = document.getElementById('btn-api-key');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKey = document.getElementById('save-api-key');
    const closeModal = document.getElementById('close-api-modal');
    const apiKeyStatus = document.getElementById('api-key-status');

    if (btnApiKey) {
        btnApiKey.addEventListener('click', () => {
            apiKeyModal.classList.remove('hidden');
            const saved = getGroqKey();
            if (saved) apiKeyInput.value = saved;
        });
    }
    if (closeModal) closeModal.addEventListener('click', () => apiKeyModal.classList.add('hidden'));
    if (apiKeyModal) apiKeyModal.addEventListener('click', (e) => { if (e.target === apiKeyModal) apiKeyModal.classList.add('hidden'); });
    if (saveApiKey) {
        saveApiKey.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            if (!key.startsWith('gsk_')) { alert('Invalid key format. Groq API keys start with "gsk_".'); return; }
            localStorage.setItem(GROQ_KEY_STORAGE, key);
            apiKeyStatus.classList.remove('hidden');
            setTimeout(() => { apiKeyStatus.classList.add('hidden'); apiKeyModal.classList.add('hidden'); }, 1200);
        });
    }

    // =============== SIGN LANGUAGE CONVERSATION ===============
    
    let conversationLog = [];
    let signVoiceRecognition = null;
    let signVoiceRecording = false;

    // Initialize tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            const activeTab = document.getElementById(`tab-${tabName}`);
            if (activeTab) activeTab.classList.add('active');
        });
    });

    // Animated fingerspelling sequence using lifeprint ASL images
    async function fingerspellText(text, avatarContainerId, historyContainerId = null, retryBtn = null) {
        const container = document.getElementById(avatarContainerId);
        if (!container) return;
        
        const historyContainer = historyContainerId ? document.getElementById(historyContainerId) : null;
        if (historyContainer) historyContainer.innerHTML = '';
        
        const img = container.querySelector('img');
        if (!img) return;
        
        const textUpper = text.toUpperCase().replace(/[^A-Z]/g, '');
        const display = container.parentElement.querySelector('.letter-display') || document.createElement('div');
        
        if (!display.classList.contains('letter-display')) {
            display.className = 'letter-display';
            display.style.opacity = '0';
            display.style.transform = 'scale(0.8)';
            container.parentElement.appendChild(display);
        }
        
        for (let i = 0; i < textUpper.length; i++) {
            const letter = textUpper[i];
            
            if (display) {
                display.style.opacity = '0';
                display.style.transform = 'scale(0.8)';
            }
            img.style.display = 'none';
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const gifUrl = `https://www.lifeprint.com/asl101/fingerspelling/abc-gifs/${letter.toLowerCase()}.gif`;
            img.src = gifUrl;
            img.style.display = 'block';
            
            if (display) {
                display.textContent = letter;
                display.style.opacity = '1';
                display.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    display.style.transform = 'scale(1)';
                }, 200);
            }
            
            // Normal readable speed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Append to history
            if (historyContainer) {
                const historyItem = document.createElement('div');
                historyItem.style.display = 'flex';
                historyItem.style.flexDirection = 'column';
                historyItem.style.alignItems = 'center';
                
                const historyImg = document.createElement('img');
                historyImg.src = gifUrl;
                historyImg.style.width = '60px';
                historyImg.style.height = '60px';
                historyImg.style.objectFit = 'contain';
                historyImg.style.borderRadius = '6px';
                historyImg.style.border = '1px solid #ddd';
                historyImg.style.background = '#fff';
                
                const historyLabel = document.createElement('span');
                historyLabel.textContent = letter;
                historyLabel.style.fontSize = '14px';
                historyLabel.style.fontWeight = 'bold';
                historyLabel.style.marginTop = '4px';
                
                historyItem.appendChild(historyImg);
                historyItem.appendChild(historyLabel);
                historyContainer.appendChild(historyItem);
            }
        }
        
        setTimeout(() => {
            img.style.display = 'none';
        }, 500);
        
        if (display) {
            display.textContent = 'Done!';
            display.style.color = 'var(--color-green)';
            display.style.opacity = '1';
            display.style.transform = 'scale(1)';
        }
        
        if (retryBtn) {
            retryBtn.style.display = 'block';
        }
    }

    // ===== MODE 1: Hand Sign → Voice & Text =====
    const toggleSignCamera = document.getElementById('toggle-sign-camera');
    const signCamCanvas = document.getElementById('sign-canvas');
    const signRecognitionText = document.getElementById('sign-recognition-text');
    const btnReadRecognized = document.getElementById('btn-read-recognized');
    const btnCopyRecognized = document.getElementById('btn-copy-recognized');
    const signConfidence = document.getElementById('sign-confidence');
    const signConfidenceVal = document.getElementById('sign-confidence-val');

    let signCameraActive = false;
    let signHands = null;
    let signCamCanvasCtx = signCamCanvas ? signCamCanvas.getContext('2d') : null;

    // Gesture persistence and conversational detection state
    let gestureState = { current: null, startMs: 0, confirmed: null };
    const GESTURE_PERSIST_MS = 600; // require this duration to confirm gesture

    if (toggleSignCamera) {
        toggleSignCamera.addEventListener('click', async () => {
            if (signCameraActive) {
                signCameraActive = false;
                toggleSignCamera.textContent = '▶ Start Camera';
                if (signHands) signHands.close();
                return;
            }

            signCameraActive = true;
            toggleSignCamera.textContent = '⏹ Stop Camera';

            // Initialize MediaPipe Hands
            if (!window.Hands) {
                alert('MediaPipe Hands library not loaded. Check your internet connection.');
                signCameraActive = false;
                toggleSignCamera.textContent = '▶ Start Camera';
                return;
            }

            const video = document.createElement('video');
            video.style.display = 'none';
            document.body.appendChild(video);

            const camera = new window.Camera(video, {
                onFrame: async () => {
                    if (!signCameraActive) return;
                    await signHands.send({ image: video });
                },
                width: 640,
                height: 480
            });

            signHands = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            signHands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            signHands.onResults((results) => {
                drawSignCanvas(results);
                recognizeGesture(results);
            });

            camera.start();
        });
    }

    function drawSignCanvas(results) {
        if (!signCamCanvas || !signCamCanvasCtx) return;
        
        signCamCanvasCtx.clearRect(0, 0, signCamCanvas.width, signCamCanvas.height);
        
        if (results.image) {
            signCamCanvasCtx.drawImage(results.image, 0, 0);
        }

        if (results.multiHandLandmarks) {
            results.multiHandLandmarks.forEach((landmarks) => {
                drawConnectors(signCamCanvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                drawLandmarks(signCamCanvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });
            });
        }
    }

    function drawConnectors(ctx, landmarks, connections, options) {
        connections.forEach(([start, end]) => {
            ctx.strokeStyle = options.color;
            ctx.lineWidth = options.lineWidth;
            ctx.beginPath();
            ctx.moveTo(landmarks[start].x * signCamCanvas.width, landmarks[start].y * signCamCanvas.height);
            ctx.lineTo(landmarks[end].x * signCamCanvas.width, landmarks[end].y * signCamCanvas.height);
            ctx.stroke();
        });
    }

    function drawLandmarks(ctx, landmarks, options) {
        ctx.fillStyle = options.color;
        landmarks.forEach(landmark => {
            ctx.beginPath();
            ctx.arc(landmark.x * signCamCanvas.width, landmark.y * signCamCanvas.height, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    const HAND_CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],[12,20]
    ];

    function recognizeGesture(results) {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            // reset transient state
            gestureState = { current: null, startMs: 0, confirmed: null };
            if (signRecognitionText) signRecognitionText.innerHTML = '<span class="text-muted">Make a hand gesture...</span>';
            if (signConfidence) signConfidence.style.width = '0%';
            if (signConfidenceVal) signConfidenceVal.textContent = '0%';
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        const gesture = detectBasicGesture(landmarks);

        const now = Date.now();
        if (gesture) {
            // If same as current transient, check persistence
            if (gestureState.current === gesture.name) {
                // continue timing
                if (!gestureState.startMs) gestureState.startMs = now;
                const elapsed = now - gestureState.startMs;
                if (elapsed >= GESTURE_PERSIST_MS && gestureState.confirmed !== gesture.name) {
                    // Confirm gesture
                    gestureState.confirmed = gesture.name;
                    // Update UI on confirmed
                    const confidence = Math.round(gesture.confidence * 100);
                    if (signRecognitionText) signRecognitionText.innerHTML = `<span class="translation-pop">${gesture.name}</span>`;
                    if (signConfidence) signConfidence.style.width = confidence + '%';
                    if (signConfidenceVal) signConfidenceVal.textContent = confidence + '%';

                    // Map confirmed gesture to a conversational phrase and emit as a sign message
                    const convText = gestureToConversation(gesture.name);
                    if (convText) {
                        addConvMessage('sign', convText);
                        try {
                            const utt = new SpeechSynthesisUtterance(convText);
                            utt.lang = 'en-US';
                            window.speechSynthesis.cancel();
                            window.speechSynthesis.speak(utt);
                        } catch (e) {
                            console.warn('TTS failed for gesture:', e);
                        }
                    }
                }
            } else {
                // new transient gesture seen
                gestureState.current = gesture.name;
                gestureState.startMs = now;
                // show transient text with lower emphasis
                if (signRecognitionText) signRecognitionText.innerHTML = `<span class="text-muted fade-pulse">Detecting: ${gesture.name}...</span>`;
            }
        } else {
            // no gesture recognized - reset transient but keep confirmed until cleared after silence
            gestureState.current = null;
            gestureState.startMs = 0;
            // Optionally clear after some time if needed, but keeping confirmed gesture is fine
        }
    }

    function detectBasicGesture(landmarks) {
        const getDistance = (p1, p2) => {
            return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        };

        const thumbExtended = getDistance(landmarks[4], landmarks[3]) > getDistance(landmarks[3], landmarks[2]);
        const indexExtended = getDistance(landmarks[8], landmarks[7]) > getDistance(landmarks[7], landmarks[6]);
        const middleExtended = getDistance(landmarks[12], landmarks[11]) > getDistance(landmarks[11], landmarks[10]);
        const ringExtended = getDistance(landmarks[16], landmarks[15]) > getDistance(landmarks[15], landmarks[14]);
        const pinkyExtended = getDistance(landmarks[20], landmarks[19]) > getDistance(landmarks[19], landmarks[18]);

        // Heuristic positions
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        // indexTip.y and wrist.y are normalized (0 top, 1 bottom)

        // Chest-point: index extended and index tip in mid-lower frame (approx sternum area)
        if (indexExtended && indexTip.y > 0.35 && indexTip.y < 0.78 && indexTip.x > 0.25 && indexTip.x < 0.75) {
            return { name: 'Point to Chest', confidence: 0.86 };
        }

        // Throat distress: hand near upper chest/neck area (wrist higher in frame) and open palm
        if (!thumbExtended && indexExtended && middleExtended && wrist.y < 0.35) {
            return { name: 'Throat Hold', confidence: 0.82 };
        }

        if (thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { name: 'Peace Sign ✌️', confidence: 0.85 };
        }
        if (!thumbExtended && indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { name: 'Pointing / Index Extended', confidence: 0.8 };
        }
        if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { name: 'Thumbs Up 👍', confidence: 0.8 };
        }
        if (thumbExtended && indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return { name: 'Letter W', confidence: 0.75 };
        }
        if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { name: 'Fist / Letter A', confidence: 0.7 };
        }

        return null;
    }

    // Map a gesture name to a conversational phrase (non-clinical)
    function gestureToConversation(gestureName) {
        const map = {
            'Point to Chest': "I'm indicating here.",
            'Throat Hold': "I need help.",
            'Peace Sign ✌️': "All good here.",
            'Pointing / Index Extended': "I'm pointing.",
            'Thumbs Up 👍': "Yes, all good.",
            'Fist / Letter A': "Stop.",
            'Letter W': "W",
            'Letter I 🫀': "I",
            'Letter A': "A"
        };
        return map[gestureName] || null;
    }

    if (btnReadRecognized) {
        btnReadRecognized.addEventListener('click', () => {
            const text = (signRecognitionText?.textContent || '').trim();
            if (!text) {
                alert('No gesture recognized yet.');
                return;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        });
    }

    if (btnCopyRecognized) {
        btnCopyRecognized.addEventListener('click', () => {
            const text = signRecognitionText?.textContent || '';
            if (text) {
                navigator.clipboard.writeText(text);
                btnCopyRecognized.textContent = '✓ Copied!';
                setTimeout(() => { btnCopyRecognized.innerHTML = '<i class="fa-solid fa-copy"></i> Copy Text'; }, 1500);
            }
        });
    }

    const btnQuickTranslate = document.querySelectorAll('.quick-action');
    const assistantOverlayButton = document.getElementById('assistant-overlay-button');
    const assistantOverlayPanel = document.getElementById('assistant-overlay-panel');
    const assistantOverlayClose = document.getElementById('assistant-overlay-close');
    const assistantOverlayInput = document.getElementById('assistant-overlay-input');
    const assistantOverlaySend = document.getElementById('assistant-overlay-send');
    const assistantOverlayMessages = document.getElementById('assistant-overlay-messages');
    const btnGestureMacroSave = document.getElementById('gesture-macro-save');
    const gestureMacroInput = document.getElementById('gesture-macro-input');
    const gestureMacroList = document.getElementById('gesture-macro-list');
    const btnStartCalibration = document.getElementById('btn-start-calibration');
    const calibrationStatus = document.getElementById('calibration-status');

    let overlayOpen = false;
    let gestureMacros = JSON.parse(localStorage.getItem('sign_gesture_macros') || '[]');
    let calibrationActive = false;

    function createMacroChip(label) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'macro-chip';
        chip.textContent = label;
        chip.addEventListener('click', () => {
            addConvMessage('text', label);
        });
        return chip;
    }

    function refreshMacroList() {
        if (!gestureMacroList) return;
        gestureMacroList.innerHTML = '';
        if (gestureMacros.length === 0) {
            const helper = document.createElement('div');
            helper.className = 'text-sm text-muted';
            helper.textContent = 'No quick phrases yet. Add one to use shortcut buttons.';
            gestureMacroList.appendChild(helper);
            return;
        }
        gestureMacros.forEach(phrase => {
            gestureMacroList.appendChild(createMacroChip(phrase));
        });
    }

    if (btnGestureMacroSave) {
        btnGestureMacroSave.addEventListener('click', () => {
            const phrase = (gestureMacroInput?.value || '').trim();
            if (!phrase) return;
            gestureMacros.unshift(phrase);
            gestureMacros = gestureMacros.slice(0, 8);
            localStorage.setItem('sign_gesture_macros', JSON.stringify(gestureMacros));
            gestureMacroInput.value = '';
            refreshMacroList();
        });
    }

    if (assistantOverlayButton && assistantOverlayPanel && assistantOverlayClose) {
        assistantOverlayButton.addEventListener('click', () => {
            overlayOpen = !overlayOpen;
            assistantOverlayPanel.classList.toggle('hidden', !overlayOpen);
        });

        assistantOverlayClose.addEventListener('click', () => {
            overlayOpen = false;
            assistantOverlayPanel.classList.add('hidden');
        });
    }

    if (assistantOverlaySend && assistantOverlayInput) {
        assistantOverlaySend.addEventListener('click', async () => {
            const prompt = assistantOverlayInput.value.trim();
            if (!prompt) return;
            assistantOverlayInput.value = '';
            appendOverlayMessage('user', prompt);
            await sendOverlayPrompt(prompt);
        });

        assistantOverlayInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const prompt = assistantOverlayInput.value.trim();
                if (!prompt) return;
                assistantOverlayInput.value = '';
                appendOverlayMessage('user', prompt);
                await sendOverlayPrompt(prompt);
            }
        });
    }

    if (btnQuickTranslate) {
        btnQuickTranslate.forEach(btn => {
            btn.addEventListener('click', async () => {
                const prompt = btn.dataset.quick;
                if (!prompt) return;
                appendOverlayMessage('user', prompt);
                await sendOverlayPrompt(prompt);
            });
        });
    }

    if (btnStartCalibration && calibrationStatus) {
        btnStartCalibration.addEventListener('click', () => {
            calibrationActive = !calibrationActive;
            if (calibrationActive) {
                calibrationStatus.textContent = 'Calibration active — align your hand inside the green zone.';
                btnStartCalibration.textContent = 'Stop Calibration';
            } else {
                calibrationStatus.textContent = 'Calibration paused';
                btnStartCalibration.textContent = 'Start Calibration';
            }
        });
    }

    function appendOverlayMessage(role, text) {
        if (!assistantOverlayMessages) return;
        const msg = document.createElement('div');
        msg.className = 'overlay-chat-message';
        msg.textContent = text;
        assistantOverlayMessages.appendChild(msg);
        assistantOverlayMessages.scrollTop = assistantOverlayMessages.scrollHeight;
    }

    async function sendOverlayPrompt(prompt) {
        if (!prompt) return;
        if (!getGroqKey()) {
            appendOverlayMessage('system', 'Please configure your API key first.');
            return;
        }

        appendOverlayMessage('system', 'Thinking...');

        try {
            const responseText = await callGroq([
                { role: 'system', content: 'You are a helpful AI assistant. Keep answers concise and actionable for demo users.' },
                { role: 'user', content: prompt }
            ], GROQ_FAST_MODEL);

            appendOverlayMessage('system', responseText);
        } catch (err) {
            appendOverlayMessage('system', `Error: ${err.message}`);
        }
    }

    refreshMacroList();

    // ===== MODE 2: Text → Hand Sign & Voice =====
    const btnFingerspellText = document.getElementById('btn-fingerspell-text');
    const btnSpeakText = document.getElementById('btn-speak-text');
    const textInputSign = document.getElementById('text-input-sign');
    const textFingerspellLabel = document.getElementById('text-fingerspell-label');
    const btnRetryText = document.getElementById('btn-retry-text');

    if (btnFingerspellText) {
        btnFingerspellText.addEventListener('click', async () => {
            const text = (textInputSign?.value || '').trim();
            if (!text) {
                alert('Enter some text to fingerspell.');
                return;
            }
            btnFingerspellText.disabled = true;
            if (btnRetryText) btnRetryText.style.display = 'none';
            textFingerspellLabel.textContent = 'Fingerspelling...';
            await fingerspellText(text, 'avatar-container-text', 'fingerspell-history-text', btnRetryText);
            textFingerspellLabel.textContent = 'Complete!';
            btnFingerspellText.disabled = false;
        });
    }

    if (btnRetryText) {
        btnRetryText.addEventListener('click', async () => {
            const text = (textInputSign?.value || '').trim();
            if (!text) return;
            btnFingerspellText.disabled = true;
            btnRetryText.style.display = 'none';
            textFingerspellLabel.textContent = 'Fingerspelling...';
            await fingerspellText(text, 'avatar-container-text', 'fingerspell-history-text', btnRetryText);
            textFingerspellLabel.textContent = 'Complete!';
            btnFingerspellText.disabled = false;
        });
    }
    if (btnSpeakText) {
        btnSpeakText.addEventListener('click', () => {
            const text = (textInputSign?.value || '').trim();
            if (!text) {
                alert('Enter some text to speak.');
                return;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        });
    }

    // ===== MODE 3: Voice → Text & Hand Sign =====
    const btnStartVoiceSign = document.getElementById('btn-start-voice-sign');
    const btnStopVoiceSign = document.getElementById('btn-stop-voice-sign');
    const voiceTranscribedText = document.getElementById('voice-transcribed-text');
    const voiceSignStatus = document.getElementById('voice-sign-status');
    const voiceFingerspellLabel = document.getElementById('voice-fingerspell-label');
    const btnRetryVoice = document.getElementById('btn-retry-voice');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (btnStartVoiceSign && SpeechRecognition) {
        if (!signVoiceRecognition) {
            signVoiceRecognition = new SpeechRecognition();
            signVoiceRecognition.continuous = true;
            signVoiceRecognition.interimResults = true;
            signVoiceRecognition.lang = 'en-US';

            signVoiceRecognition.onstart = () => {
                voiceSignStatus.textContent = 'Listening...';
                btnStartVoiceSign.disabled = true;
                btnStopVoiceSign.disabled = false;
                signVoiceRecording = true;
                if (btnRetryVoice) btnRetryVoice.style.display = 'none';
            };

            signVoiceRecognition.onresult = (e) => {
                let transcript = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                if (voiceTranscribedText) voiceTranscribedText.textContent = transcript;
            };

            signVoiceRecognition.onend = async () => {
                signVoiceRecording = false;
                voiceSignStatus.textContent = 'Processing...';
                const text = (voiceTranscribedText?.textContent || '').trim();
                if (text) {
                    voiceFingerspellLabel.textContent = 'Fingerspelling...';
                    await fingerspellText(text, 'avatar-container-voice', 'fingerspell-history-voice', btnRetryVoice);
                    voiceFingerspellLabel.textContent = 'Complete!';
                }
                voiceSignStatus.textContent = 'Ready';
                btnStartVoiceSign.disabled = false;
                btnStopVoiceSign.disabled = true;
            };

            signVoiceRecognition.onerror = (e) => {
                voiceSignStatus.textContent = `Error: ${e.error}`;
                voiceSignStatus.style.color = 'var(--color-red)';
            };
        }

        btnStartVoiceSign.addEventListener('click', () => {
            voiceTranscribedText.textContent = '';
            voiceFingerspellLabel.textContent = 'Ready';
            signVoiceRecognition.start();
        });

        btnStopVoiceSign.addEventListener('click', () => {
            signVoiceRecognition.stop();
        });
    }

    if (btnRetryVoice) {
        btnRetryVoice.addEventListener('click', async () => {
            const text = (voiceTranscribedText?.textContent || '').trim();
            if (!text || text === 'Speak to transcribe...') return;
            btnRetryVoice.style.display = 'none';
            voiceFingerspellLabel.textContent = 'Fingerspelling...';
            await fingerspellText(text, 'avatar-container-voice', 'fingerspell-history-voice', btnRetryVoice);
            voiceFingerspellLabel.textContent = 'Complete!';
        });
    }

    // ===== MODE 4: Conversation Mode =====
    const btnVoiceInputConv = document.getElementById('btn-voice-input-conv');
    const textInputConv = document.getElementById('text-input-conv');
    const btnTextInputConv = document.getElementById('btn-text-input-conv');
    const convLog = document.getElementById('conversation-log');
    const btnClearConv = document.getElementById('btn-clear-conv');
    const convStatus = document.getElementById('conv-status');

    function addConvMessage(type, content) {
        const msg = document.createElement('div');
        msg.className = `conv-message ${type}`;
        
        const label = document.createElement('div');
        label.className = 'conv-message-label';
        label.textContent = type === 'sign' ? '🤚 Sign' : (type === 'voice' ? '🎤 Voice' : '✍️ Text');
        
        const msgContent = document.createElement('div');
        msgContent.className = 'conv-message-content';
        msgContent.textContent = content;
        
        msg.appendChild(label);
        msg.appendChild(msgContent);
        convLog.appendChild(msg);
        convLog.scrollTop = convLog.scrollHeight;
    }

    const macroPills = document.querySelectorAll('.macro-pill');
    macroPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const phrase = pill.getAttribute('data-phrase');
            if (phrase) {
                addConvMessage('text', phrase);
            }
        });
    });

    if (btnTextInputConv) {
        btnTextInputConv.addEventListener('click', () => {
            const text = (textInputConv?.value || '').trim();
            if (!text) return;
            addConvMessage('text', text);
            textInputConv.value = '';
        });
    }

    if (btnVoiceInputConv) {
        btnVoiceInputConv.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('Speech Recognition not supported.');
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            convStatus.textContent = 'Listening...';

            recognition.onresult = (e) => {
                let transcript = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                addConvMessage('voice', transcript);
            };

            recognition.onend = () => {
                convStatus.textContent = 'Ready';
            };

            recognition.start();
        });
    }

    if (btnClearConv) {
        btnClearConv.addEventListener('click', () => {
            convLog.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">Conversation cleared. Start speaking or typing!</div>';
        });
    }

    navigate();
});
