(() => {
  'use strict';

  // ================= 1. ESKI DOMENDAN YANGI DOMENGA REDIRECT =================
  if (window.location.hostname === 'web-desktop-chi.vercel.app') {
    window.location.replace('https://monitor-mr.vercel.app' + window.location.pathname + window.location.search);
    return;
  }

  // ================= 3. DOM ELEMENTLAR =================
  // 0. Splash View
  const splashView = document.getElementById('splash-view');

  // 1. Login View
  const loginView = document.getElementById('login-view');
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const loginError = document.getElementById('login-error');

  // 2. Welcome View
  const welcomeView = document.getElementById('welcome-view');
  const welcomeUser = document.getElementById('welcome-user');
  const modeScreenBtn = document.getElementById('mode-screen-btn');
  const modeShellBtn = document.getElementById('mode-shell-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const netTip = document.getElementById('net-tip');
  const localWifiLink = document.getElementById('local-wifi-link');

  // 3. Countdown View
  const countdownView = document.getElementById('countdown-view');
  const countdownNum = document.getElementById('countdown-num');
  const progressBar = document.getElementById('progress-bar');

  // 4. Screen View & Bottom Bar
  const screenView = document.getElementById('screen-view');
  const videoEl = document.getElementById('screen-video');
  const screenBottombar = document.getElementById('screen-bottombar');
  const barDashboardBtn = document.getElementById('bar-dashboard-btn');
  const barPauseBtn = document.getElementById('bar-pause-btn');
  const barIconPause = document.getElementById('bar-icon-pause');
  const barIconPlay = document.getElementById('bar-icon-play');
  const barAudioBtn = document.getElementById('bar-audio-btn');
  const barIconAudioOn = document.getElementById('bar-icon-audio-on');
  const barIconAudioOff = document.getElementById('bar-icon-audio-off');
  const barMicBtn = document.getElementById('bar-mic-btn');
  const barShellBtn = document.getElementById('bar-shell-btn');
  const barFullscreenBtn = document.getElementById('bar-fullscreen-btn');
  const barMoreBtn = document.getElementById('bar-more-btn');
  const barMoreMenu = document.getElementById('bar-more-menu');
  const menuPipBtn = document.getElementById('menu-pip-btn');
  const menuReconnectBtn = document.getElementById('menu-reconnect-btn');
  const menuLogoutBtn = document.getElementById('menu-logout-btn');

  // 4.1 Splash Overlay Elements
  const screenSplash = document.getElementById('screen-splash');
  const splashStatusBadge = document.getElementById('splash-status-badge');
  const splashDesc = document.getElementById('splash-desc');
  const splashCancelBtn = document.getElementById('splash-cancel-btn');
  const stepHandshake = document.getElementById('step-handshake');
  const stepMedia = document.getElementById('step-media');
  const stepLive = document.getElementById('step-live');

  // 5. Shell Terminal View
  const shellView = document.getElementById('shell-view');
  const shellCwdText = document.getElementById('shell-cwd-text');
  const shellToScreenBtn = document.getElementById('shell-to-screen-btn');
  const shellToMenuBtn = document.getElementById('shell-to-menu-btn');
  const shellLogoutBtn = document.getElementById('shell-logout-btn');
  const terminalScreen = document.getElementById('terminal-screen');
  const terminalHistory = document.getElementById('terminal-history');
  const terminalInput = document.getElementById('terminal-input');
  const terminalActiveLine = document.querySelector('.terminal-active-line');
  const ghostHidden = document.getElementById('ghost-hidden');
  const ghostSuggestion = document.getElementById('ghost-suggestion');

  // 6. Original PTY Terminal View
  const modePtyBtn = document.getElementById('mode-pty-btn');
  const ptyView = document.getElementById('pty-view');
  const ptyStatusText = document.getElementById('pty-status-text');
  const ptyToScreenBtn = document.getElementById('pty-to-screen-btn');
  const ptyToShellBtn = document.getElementById('pty-to-shell-btn');
  const ptyToMenuBtn = document.getElementById('pty-to-menu-btn');
  const ptyReconnectBtn = document.getElementById('pty-reconnect-btn');
  const ptyLogoutBtn = document.getElementById('pty-logout-btn');
  const ptyTerminalContainer = document.getElementById('pty-terminal-container');
  const ptyVirtualKeys = document.getElementById('pty-virtual-keys');

  // ================= 4. HOLAT (STATE) =================
  let authToken = localStorage.getItem('desktop_auth_token') || null;
  let currentUsername = localStorage.getItem('desktop_username') || '';
  let remoteHost = localStorage.getItem('remote_desk_host') || '';
  let currentCwd = '~';
  const cmdHistory = [];
  let cmdIndex = -1;
  let shellHistory = [];
  let currentSuggestion = '';
  let isCommandRunning = false;
  let runningCmdId = null;
  let isMicActive = false;
  let prewarmStarted = false;
  let countdownTimer = null;
  let blockCountdownTimer = null;

  let bottombarTimer = null;

  function showBottombar() {
    if (!screenBottombar) return;
    screenBottombar.classList.remove('hidden-bar');

    if (bottombarTimer) clearTimeout(bottombarTimer);

    // Agar 3-nuqta menyusi ochiq bo'lmasa 4 soniyadan keyin avtomatik yashiriladi
    if (!barMoreMenu || barMoreMenu.classList.contains('hidden')) {
      bottombarTimer = setTimeout(() => {
        hideBottombar();
      }, 4000);
    }
  }

  function hideBottombar() {
    if (!screenBottombar) return;
    if (barMoreMenu) barMoreMenu.classList.add('hidden');
    screenBottombar.classList.add('hidden-bar');
  }

  function toggleBottombar() {
    if (!screenBottombar) return;
    if (screenBottombar.classList.contains('hidden-bar')) {
      showBottombar();
    } else {
      hideBottombar();
    }
  }

  // ================= 5. VIEW BOSHQARUVI =================
  function showView(viewId) {
    const views = [splashView, loginView, welcomeView, countdownView, screenView, shellView, ptyView];
    views.forEach(v => {
      if (v) {
        if (v.id === viewId) {
          v.classList.remove('hidden');
        } else {
          v.classList.add('hidden');
        }
      }
    });

    if (viewId !== 'screen-view' && viewId !== 'countdown-view') {
      stopStream();
      hideBottombar();
    }

    if (viewId !== 'pty-view') {
      if (ptyWs) {
        try { ptyWs.close(); } catch (_) {}
        ptyWs = null;
      }
    }

    if (viewId === 'screen-view') {
      showBottombar();
    }

    if (viewId === 'shell-view') {
      initShellStreamSocket();
      fetchShellHistory();
      setTimeout(() => {
        if (terminalInput) terminalInput.focus();
      }, 60);
    }
  }

  function updateLanTip(lanUrl) {
    if (netTip) netTip.classList.add('hidden');
  }

  function showWelcomeView(username) {
    if (welcomeUser) {
      welcomeUser.textContent = 'MONITOR';
    }
    showView('welcome-view');
  }

  // ================= 6. KONFIGURATSIYA VA AVTORIZATSIYA TEKSHIRUVI =================
  function checkLocalWifi(lanHost, timeoutMs = 700) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          img.src = '';
          resolve(false);
        }
      }, timeoutMs);

      img.onload = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(true);
        }
      };
      img.onerror = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(true);
        }
      };
      img.src = `http://${lanHost}/favicon.svg?_t=${Date.now()}`;
    });
  }

  async function initConfig() {
    const params = new URLSearchParams(window.location.search);
    const qHost = params.get('host') || params.get('h');
    if (qHost) {
      remoteHost = qHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
      localStorage.setItem('remote_desk_host', remoteHost);
    }

    const qToken = params.get('token') || params.get('t');
    if (qToken) {
      authToken = qToken;
      localStorage.setItem('desktop_auth_token', qToken);
    }

    let lanHost = '192.168.1.106:7777';
    if (!remoteHost) {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data && data.host) {
            remoteHost = data.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
            localStorage.setItem('remote_desk_host', remoteHost);
          }
          if (data && data.lanHost) {
            lanHost = data.lanHost;
          }
        }
      } catch (e) {}
    }

    // Uydan Vercel orqali kirilganda avtomatik lokal Wi-Fi (0ms) ga o'tish
    const isCloudMode = params.get('cloud') === '1' || params.get('stay') === '1';
    if (!isLocalHostName(window.location.hostname) && !isCloudMode) {
      const isHome = await checkLocalWifi(lanHost, 500);
      if (isHome) {
        const currentToken = localStorage.getItem('desktop_auth_token') || authToken || '';
        const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
        window.location.replace(`http://${lanHost}/desktop${tokenParam}`);
        return; // Splash screen saqlanadi, boshqa view'lar miltillab ochilmaydi
      }
    }

    const savedToken = localStorage.getItem('desktop_auth_token');

    // Agar token saqlangan bo'lsa: Blok va Auth ni bir vaqtda (parallel) tezkor tekshiramiz
    if (savedToken) {
      try {
        const [authRes, blockRes] = await Promise.all([
          fetch(getApiUrl('/api/check-auth'), {
            headers: {
              'Authorization': `Bearer ${savedToken}`,
              'ngrok-skip-browser-warning': 'true'
            },
            credentials: 'include'
          }).catch(() => null),
          fetch(getApiUrl('/api/check-block'), {
            headers: { 'ngrok-skip-browser-warning': 'true' }
          }).catch(() => null)
        ]);

        if (blockRes && blockRes.ok) {
          const blockData = await blockRes.json().catch(() => null);
          if (blockData && blockData.blocked && blockData.retryAfterSeconds) {
            startBlockCountdown(blockData.retryAfterSeconds);
            showView('login-view');
            return;
          }
        }

        if (authRes && authRes.ok) {
          const authData = await authRes.json().catch(() => null);
          if (authData && authData.authenticated) {
            authToken = authData.token || savedToken;
            currentUsername = authData.username || localStorage.getItem('desktop_username') || 'muhamad';
            if (authData.lanUrl) {
              updateLanTip(authData.lanUrl);
            }
            showWelcomeView(currentUsername);
            return;
          }
        }
      } catch (e) {}

      // Agar sessiya serverda tugagan bo'lsa
      localStorage.removeItem('desktop_auth_token');
      authToken = null;
    } else {
      // Token bo'lmaganda faqat bloklanganlikni tekshiramiz
      try {
        const blockRes = await fetch(getApiUrl('/api/check-block'), {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (blockRes.ok) {
          const blockData = await blockRes.json();
          if (blockData && blockData.blocked && blockData.retryAfterSeconds) {
            startBlockCountdown(blockData.retryAfterSeconds);
          }
        }
      } catch (e) {}
    }

    showView('login-view');
  }

  function isLocalHostName(h) {
    return h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) || h.endsWith('.local');
  }

  function getHost() {
    const h = window.location.hostname;
    if (isLocalHostName(h)) {
      return window.location.host;
    }
    return remoteHost || localStorage.getItem('remote_desk_host') || window.location.host;
  }

  function getApiUrl(path) {
    const h = window.location.hostname;
    if (isLocalHostName(h)) {
      return path;
    }
    return `${window.location.protocol}//${getHost()}${path}`;
  }

  function getStreamUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${getHost()}/video-stream${token}`;
  }

  // ================= 6.1 ULTRA-TEZKOR SHELL STREAM (WEBRTC/WEBSOCKET) =================
  let shellWs = null;
  const shellPending = new Map();

  function getShellStreamUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${getHost()}/shell-stream${token}`;
  }

  function initShellStreamSocket() {
    if (!authToken) return;
    if (shellWs && (shellWs.readyState === WebSocket.OPEN || shellWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      shellWs = new WebSocket(getShellStreamUrl());

      shellWs.onopen = () => {
        // Ultra-past kechikishli shell oqimi ulandi
        try {
          shellWs.send(JSON.stringify({ type: 'get_history' }));
        } catch (_) {}
      };

      shellWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { id, type } = data;

          // Fish/Bash tarixi kelganda yuklash
          if (type === 'history' && Array.isArray(data.history)) {
            shellHistory = data.history;
            cmdHistory.length = 0;
            cmdHistory.push(...shellHistory);
            cmdIndex = cmdHistory.length;
            return;
          }

          if (!id || !shellPending.has(id)) return;

          const req = shellPending.get(id);

          if (type === 'chunk') {
            if (req.onChunk) req.onChunk(data);
          } else if (type === 'done') {
            clearTimeout(req.timer);
            shellPending.delete(id);
            if (req.onDone) req.onDone(data);
          }
        } catch (e) {}
      };

      shellWs.onclose = () => {
        shellWs = null;
        if (authToken) {
          setTimeout(initShellStreamSocket, 2000);
        }
      };

      shellWs.onerror = () => {};
    } catch (e) {
      shellWs = null;
    }
  }

  // ================= 6.2 FISH & BASH TARIXINI YUKLASH VA AUTOSUGGEST =================
  async function fetchShellHistory() {
    if (!authToken) return;
    try {
      const res = await fetch(getApiUrl('/api/shell-history'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history) && data.history.length > 0) {
          shellHistory = data.history;
          cmdHistory.length = 0;
          cmdHistory.push(...shellHistory);
          cmdIndex = cmdHistory.length;
        }
      }
    } catch (_) {}
  }

  function updateSuggestion() {
    if (!ghostHidden || !ghostSuggestion || !terminalInput) return;
    const val = terminalInput.value;
    if (!val || !val.trim()) {
      clearSuggestion();
      return;
    }

    // Fish kabi eng yangi tarixdan boshlab qidirish
    let match = '';
    for (let i = shellHistory.length - 1; i >= 0; i--) {
      const item = shellHistory[i];
      if (item && item.startsWith(val) && item !== val) {
        match = item;
        break;
      }
    }

    if (match) {
      currentSuggestion = match;
      ghostHidden.textContent = val;
      ghostSuggestion.textContent = match.slice(val.length);
    } else {
      clearSuggestion();
    }
  }

  function clearSuggestion() {
    currentSuggestion = '';
    if (ghostHidden) ghostHidden.textContent = '';
    if (ghostSuggestion) ghostSuggestion.textContent = '';
  }

  // ================= 8. FULLSCREEN TOGGLE =================
  function toggleFullscreen(forceOpen = false) {
    const doc = document;
    const isFull = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (forceOpen || !isFull) {
      if (doc.documentElement.requestFullscreen) {
        doc.documentElement.requestFullscreen().catch(() => {});
      } else if (doc.documentElement.webkitRequestFullscreen) {
        doc.documentElement.webkitRequestFullscreen();
      } else if (videoEl && videoEl.webkitEnterFullscreen) {
        videoEl.webkitEnterFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen().catch(() => {});
      }
    }
  }

  if (videoEl) {
    videoEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      toggleFullscreen();
    });

    let lastTapTime = 0;
    videoEl.addEventListener('touchend', (e) => {
      const now = Date.now();
      const diff = now - lastTapTime;
      if (diff < 350 && diff > 0) {
        e.preventDefault();
        toggleFullscreen();
      }
      lastTapTime = now;
    });
  }

  // ================= 9. LOGOUT (TIZIMDAN CHIQISH) =================
  async function logoutSession(reason = '') {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    if (authToken) {
      try {
        await fetch(getApiUrl('/api/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include'
        });
      } catch (e) {}
    }

    authToken = null;
    localStorage.removeItem('desktop_auth_token');
    localStorage.removeItem('desktop_username');
    stopStream();
    if (ptyWs) {
      try { ptyWs.close(); } catch (_) {}
      ptyWs = null;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    showView('login-view');

    if (reason && loginError) {
      loginError.textContent = reason;
      loginError.classList.remove('hidden');
    }
  }

  // ================= 10. WEBRTC STREAM & AUDIO & CONTROLS =================
  function updateAudioUI(isMuted) {
    if (!barAudioBtn) return;
    if (isMuted) {
      if (barIconAudioOn) barIconAudioOn.classList.add('hidden');
      if (barIconAudioOff) barIconAudioOff.classList.remove('hidden');
      barAudioBtn.classList.remove('active');
    } else {
      if (barIconAudioOff) barIconAudioOff.classList.add('hidden');
      if (barIconAudioOn) barIconAudioOn.classList.remove('hidden');
      barAudioBtn.classList.add('active');
    }
  }

  function toggleAudio() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (!innerVideo) return;

    // Xost kompyuterning o'zida ovozni yoqish akustik rezonans (larsen echo screech) chiqarishini oldini olamiz
    const isHostMachine = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (innerVideo.muted && isHostMachine) {
      showToast("⚠️ Siz xost kompyuterning o‘zidasiz. Akustik aks-sado (g‘uvillash) oldini olish uchun ovoz faqat boshqa qurilmalarda yoqiladi.", true);
      return;
    }

    innerVideo.muted = !innerVideo.muted;
    if (!innerVideo.muted) {
      innerVideo.play().catch(() => {});
    }
    updateAudioUI(innerVideo.muted);
  }

  function togglePause() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (!innerVideo) return;

    if (innerVideo.paused) {
      innerVideo.play().catch(() => {});
      if (barIconPause) barIconPause.classList.remove('hidden');
      if (barIconPlay) barIconPlay.classList.add('hidden');
      if (barPauseBtn) barPauseBtn.classList.remove('active');
    } else {
      innerVideo.pause();
      if (barIconPause) barIconPause.classList.add('hidden');
      if (barIconPlay) barIconPlay.classList.remove('hidden');
      if (barPauseBtn) barPauseBtn.classList.add('active');
    }
  }

  function showToast(message, isError = false) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '80px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.backgroundColor = 'rgba(20, 20, 20, 0.94)';
      toast.style.color = '#fff';
      toast.style.padding = '10px 20px';
      toast.style.borderRadius = '10px';
      toast.style.fontSize = '14px';
      toast.style.fontWeight = '500';
      toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
      toast.style.border = '1px solid rgba(255,255,255,0.15)';
      toast.style.zIndex = '99999';
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      toast.style.pointerEvents = 'none';
      toast.style.textAlign = 'center';
      toast.style.maxWidth = '90vw';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.borderColor = isError ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 4000);
  }

  function updateMicUI(active) {
    if (!barMicBtn) return;
    if (active) {
      barMicBtn.classList.add('active');
    } else {
      barMicBtn.classList.remove('active');
    }
  }

  async function toggleMic() {
    if (!videoEl) return;
    // Brauzer xavfsizlik talabi: agar HTTP orqali kirilgan bo'lsa, xuddi shu portda (7777) HTTPS ga o'tkazish
    if (window.location.protocol === 'http:' && !window.isSecureContext) {
      const httpsUrl = 'https://' + window.location.host + window.location.pathname + window.location.search;
      showToast("🔒 Mikrofon xavfsiz rejimni talab qiladi. Shu portda HTTPS ga o‘tilmoqda...", false);
      setTimeout(() => {
        window.location.href = httpsUrl;
      }, 600);
      return;
    }

    let res = false;
    if (typeof videoEl.toggleMic === 'function') {
      res = await videoEl.toggleMic();
    } else if (typeof videoEl.setMicEnabled === 'function') {
      isMicActive = !isMicActive;
      videoEl.setMicEnabled(isMicActive);
      res = isMicActive;
    }

    if (!res && (!videoEl.micStream || !videoEl.micStream.active)) {
      showToast("❌ Mikrofon ruxsati berilmadi yoki qurilma topilmadi", true);
      isMicActive = false;
    } else {
      isMicActive = !!res;
      if (isMicActive) {
        showToast("🎤 Mikrofon yoqildi — Ovoz kompyuter karnayidan eshitilmoqda");
      } else {
        showToast("🔇 Mikrofon o'chirildi");
      }
    }
    updateMicUI(isMicActive);
  }

  async function togglePictureInPicture() {
    if (!videoEl) return;
    const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
    if (!innerVideo) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await innerVideo.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP xatosi:', err.message);
    }
  }

  // ================= 10.1 CHROYLI VISUAL SPLASH SCREEN =================
  let splashWatchTimer = null;

  function showSplash() {
    if (!screenSplash) return;
    screenSplash.classList.remove('fade-out');
    if (splashStatusBadge) splashStatusBadge.textContent = 'ULANMOQDA';
    if (splashDesc) splashDesc.textContent = 'Kompyuter bilan xavfsiz apparat oqimi o‘rnatilmoqda...';
    if (stepHandshake) stepHandshake.className = 'splash-step active';
    if (stepMedia) stepMedia.className = 'splash-step';
    if (stepLive) stepLive.className = 'splash-step';

    if (splashWatchTimer) clearInterval(splashWatchTimer);

    // Kadr kelgunicha (infinity) tekshirib turamiz
    splashWatchTimer = setInterval(() => {
      const innerVideo = videoEl ? (videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null)) : null;
      if (innerVideo && (innerVideo.currentTime > 0.05 || (innerVideo.readyState >= 2 && innerVideo.videoWidth > 0))) {
        onVideoFrameArrived();
      }
    }, 100);
  }

  function hideSplash() {
    if (splashWatchTimer) {
      clearInterval(splashWatchTimer);
      splashWatchTimer = null;
    }
    if (!screenSplash) return;
    screenSplash.classList.add('fade-out');
  }

  function updateSplashStep(step, text) {
    if (splashDesc && text) splashDesc.textContent = text;
    if (step === 2) {
      if (stepHandshake) stepHandshake.className = 'splash-step done';
      if (stepMedia) stepMedia.className = 'splash-step active';
      if (splashStatusBadge) splashStatusBadge.textContent = 'MEDIA QABUL QILINMOQDA';
    } else if (step === 3) {
      if (stepHandshake) stepHandshake.className = 'splash-step done';
      if (stepMedia) stepMedia.className = 'splash-step done';
      if (stepLive) stepLive.className = 'splash-step active';
      if (splashStatusBadge) splashStatusBadge.textContent = 'JONLI EFIR TAYYOR';
    }
  }

  function onVideoFrameArrived() {
    updateSplashStep(3, 'Tasvir va audio qabul qilindi. Jonli efir boshlandi!');
    setTimeout(() => {
      hideSplash();
    }, 280);
  }

  function reconnectStream() {
    stopStream();
    showSplash();
    setTimeout(() => {
      startStream();
      showBottombar();
    }, 150);
  }

  function startStream() {
    if (prewarmStarted || !videoEl) return;
    prewarmStarted = true;

    try {
      const streamUrl = getStreamUrl();
      videoEl.mode = 'webrtc';
      videoEl.media = 'video,audio,microphone';
      videoEl.src = streamUrl;

      const triggerPlay = () => {
        try {
          const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
          if (innerVideo) {
            innerVideo.playsInline = true;
            // Xavfsizlik: Akustik rezonans (larsen screech loop) oldini olish uchun stream sukut bo'yicha MUTED bo'lib boshlanadi
            innerVideo.muted = true;
            innerVideo.play().catch(() => {});
            updateAudioUI(true);
          }
        } catch (e) {}
      };

      triggerPlay();

      const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
      if (innerVideo) {
        const onFrame = () => {
          if (innerVideo.currentTime > 0.05 || (innerVideo.readyState >= 2 && innerVideo.videoWidth > 0)) {
            onVideoFrameArrived();
            innerVideo.removeEventListener('timeupdate', onFrame);
            innerVideo.removeEventListener('playing', onFrame);
          }
        };
        innerVideo.addEventListener('timeupdate', onFrame);
        innerVideo.addEventListener('playing', onFrame);
      }
    } catch (err) {
      console.warn('Video ulanish xatosi:', err.message);
    }
  }

  // ================= 10.2 EKRAN UYQUGA KETMASLIGI (WAKE LOCK) VA 20-40 SOAT WATCHDOG =================
  let wakeLockSentinel = null;
  let streamWatchdogTimer = null;
  let lastVideoTime = -1;
  let lastProgressTs = 0;

  async function acquireScreenWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockSentinel = null;
          console.log('[WakeLock] Ekran qulfi bo‘shatildi');
        });
        console.log('[WakeLock] Ekran doimiy yoniq (20-40 soat uzluksiz rejim)');
      }
    } catch (err) {
      console.warn('[WakeLock] Faollashtirilmadi:', err.message);
    }
  }

  function releaseScreenWakeLock() {
    if (wakeLockSentinel) {
      try {
        wakeLockSentinel.release().catch(() => {});
      } catch (e) {}
      wakeLockSentinel = null;
    }
  }

  function startStreamWatchdog() {
    stopStreamWatchdog();

    streamWatchdogTimer = setInterval(() => {
      if (currentView !== 'screen-view') return;
      const innerVideo = videoEl ? (videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null)) : null;
      if (!innerVideo) return;

      // 1. Agar brauzer tasvirni to'xtatib qo'ysa, qayta o'ynatamiz
      if (innerVideo.paused && innerVideo.readyState >= 2) {
        innerVideo.play().catch(() => {});
      }

      // 2. Agar WebSocket yoki WebRTC uzilib qolgan bo'lsa, avtomatik qayta tiklaymiz
      if (videoEl.wsState === WebSocket.CLOSED && videoEl.pcState === WebSocket.CLOSED) {
        if (typeof videoEl.onconnect === 'function') {
          videoEl.onconnect();
        }
      }
    }, 2000);
  }

  function stopStreamWatchdog() {
    if (streamWatchdogTimer) {
      clearInterval(streamWatchdogTimer);
      streamWatchdogTimer = null;
    }
  }

  // Brauzer foni, telefon qulfi ochilganda yoki tabga qaytilganda
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentView === 'screen-view') {
      acquireScreenWakeLock();
      const innerVideo = videoEl ? (videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null)) : null;
      if (innerVideo && innerVideo.paused) {
        innerVideo.play().catch(() => {});
      }
      if (videoEl && (videoEl.pcState !== WebSocket.OPEN || !innerVideo || innerVideo.readyState < 2)) {
        if (typeof videoEl.onconnect === 'function') {
          videoEl.onconnect();
        }
      }
    }
  });

  function stopStream() {
    hideSplash();
    stopStreamWatchdog();
    releaseScreenWakeLock();
    prewarmStarted = false;
    isMicActive = false;
    updateMicUI(false);

    if (videoEl) {
      try {
        if (typeof videoEl.ondisconnect === 'function') {
          videoEl.ondisconnect();
        }
      } catch (e) {}
    }
  }

  // ================= 11. SCREEN REJIMIGA KIRISH (DARHOL, KUTISKSIZ) =================
  function enterScreenView() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    showSplash();
    showView('screen-view');
    startStream();
    acquireScreenWakeLock();
    startStreamWatchdog();

    try {
      const innerVideo = videoEl.video || (videoEl.querySelector ? videoEl.querySelector('video') : null);
      if (innerVideo) {
        innerVideo.muted = true;
        innerVideo.play().catch(() => {});
        updateAudioUI(true);
      }
    } catch (e) {}
    toggleFullscreen(true);
  }

  function startCountdown() {
    enterScreenView();
  }

  // ================= 12. SHELL TERMINAL BOSHQARUVI =================
  function updateCwdUI() {
    if (!shellCwdText) return;
    const home = '/home/muhamad';
    let display = currentCwd;
    if (display === home) {
      display = '~';
    } else if (display.startsWith(home + '/')) {
      display = '~' + display.slice(home.length);
    }
    shellCwdText.textContent = display;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ansiToHtml(str) {
    if (!str) return '';
    const ansiMap = {
      '30': 'color: #4e4e4e',
      '31': 'color: #ff5555',
      '32': 'color: #50fa7b',
      '33': 'color: #f1fa8c',
      '34': 'color: #bd93f9',
      '35': 'color: #ff79c6',
      '36': 'color: #8be9fd',
      '37': 'color: #f8f8f2',
      '90': 'color: #797979',
      '91': 'color: #ff6e6e',
      '92': 'color: #69ff94',
      '93': 'color: #ffffa5',
      '94': 'color: #d6acff',
      '95': 'color: #ff92df',
      '96': 'color: #a4ffff',
      '97': 'color: #ffffff',
      '1': 'font-weight: bold',
      '2': 'opacity: 0.7',
      '4': 'text-decoration: underline'
    };

    let escaped = escapeHtml(str);
    return escaped.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      if (codes === '0' || codes === '00') return '</span>';
      const parts = codes.split(';');
      const styles = [];
      for (const p of parts) {
        if (ansiMap[p]) styles.push(ansiMap[p]);
      }
      return styles.length ? `<span style="${styles.join('; ')}">` : '';
    });
  }

  function scrollTerminalToBottom() {
    if (terminalScreen) {
      terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }
  }

  function appendTerminalMessage(title, text, isError = false) {
    if (!terminalHistory) return;
    const entry = document.createElement('div');
    entry.className = 'term-entry';

    let html = `
      <div class="term-cmd-line">
        <span class="prompt-tag">[I]</span>
        <span class="prompt-arrow">&gt;</span>
        <span class="term-cmd-text" style="color: #888888;">${escapeHtml(title)}</span>
      </div>
    `;

    if (text) {
      const errorClass = isError ? ' error' : '';
      html += `<pre class="term-output${errorClass}">${ansiToHtml(text)}</pre>`;
    }

    entry.innerHTML = html;
    terminalHistory.appendChild(entry);
    scrollTerminalToBottom();
  }

  function executeTerminalCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (!cmd) return Promise.resolve();

    cmdHistory.push(cmd);
    cmdIndex = cmdHistory.length;
    if (!shellHistory.includes(cmd)) {
      shellHistory.push(cmd);
    }

    if (cmd === 'clear') {
      if (terminalHistory) terminalHistory.innerHTML = '';
      return Promise.resolve();
    }

    if (cmd === 'exit') {
      showView('welcome-view');
      return Promise.resolve();
    }

    // Tarixga kiritish va bajarilayotganini ko'rsatish
    const entry = document.createElement('div');
    entry.className = 'term-entry';
    entry.innerHTML = `
      <div class="term-cmd-line">
        <span class="prompt-tag">[I]</span>
        <span class="prompt-arrow">&gt;</span>
        <span class="term-cmd-text">${escapeHtml(cmd)}</span>
      </div>
      <pre class="term-output" style="color: #666666;"></pre>
    `;
    terminalHistory.appendChild(entry);
    scrollTerminalToBottom();

    const outputEl = entry.querySelector('.term-output');

    // 1. Ultra-tezkor WebSocket rejimida jo'natish (WebRTC kabi ko'z yumib ochguncha)
    if (shellWs && shellWs.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        const cmdId = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        runningCmdId = cmdId;
        isCommandRunning = true;
        if (terminalActiveLine) terminalActiveLine.classList.add('running');

        let accumulatedText = '';
        let hasReceived = false;

        const timer = setTimeout(() => {
          if (shellPending.has(cmdId)) {
            shellPending.delete(cmdId);
            isCommandRunning = false;
            runningCmdId = null;
            if (terminalActiveLine) terminalActiveLine.classList.remove('running');
            if (!hasReceived) {
              outputEl.className = 'term-output error';
              outputEl.textContent = 'Buyruq kutish vaqti tugadi (timeout: 60s).';
            }
            resolve();
          }
        }, 60000);

        shellPending.set(cmdId, {
          timer,
          onChunk: (chunk) => {
            hasReceived = true;
            if (chunk.stdout) accumulatedText += chunk.stdout;
            if (chunk.stderr) accumulatedText += chunk.stderr;
            outputEl.innerHTML = ansiToHtml(accumulatedText);
            scrollTerminalToBottom();
          },
          onDone: (data) => {
            isCommandRunning = false;
            runningCmdId = null;
            if (terminalActiveLine) terminalActiveLine.classList.remove('running');
            hasReceived = true;
            if (data.cwd) {
              currentCwd = data.cwd;
              updateCwdUI();
            }
            if (data.stdout && !accumulatedText.includes(data.stdout)) accumulatedText += data.stdout;
            if (data.stderr && !accumulatedText.includes(data.stderr)) accumulatedText += data.stderr;

            if (!accumulatedText.trim()) {
              outputEl.remove();
            } else {
              const isError = data.exitCode !== 0;
              outputEl.className = isError ? 'term-output error' : 'term-output';
              outputEl.innerHTML = ansiToHtml(accumulatedText);
            }
            scrollTerminalToBottom();
            resolve();
          }
        });

        shellWs.send(JSON.stringify({ id: cmdId, command: cmd, cwd: currentCwd }));
      });
    }

    // 2. Agar WebSocket ulanmagan bo'lsa uni tiklashga urinib, HTTP fallback orqali jo'natish
    initShellStreamSocket();
    outputEl.textContent = '...';

    return (async () => {
      try {
        const res = await fetch(getApiUrl('/api/shell'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({ command: cmd, cwd: currentCwd })
        });

        if (res.status === 401) {
          outputEl.className = 'term-output error';
          outputEl.textContent = 'Sessiya tugadi. Qayta tizimga kiring.';
          setTimeout(() => logoutSession(), 1500);
          return;
        }

        const data = await res.json();
        if (data.cwd) {
          currentCwd = data.cwd;
          updateCwdUI();
        }

        const hasStdout = Boolean(data.stdout && data.stdout.trim());
        const hasStderr = Boolean(data.stderr && data.stderr.trim());

        if (!hasStdout && !hasStderr) {
          outputEl.remove();
        } else {
          const isError = data.exitCode !== 0;
          outputEl.className = isError ? 'term-output error' : 'term-output';
          let fullText = '';
          if (data.stdout) fullText += data.stdout;
          if (data.stderr) fullText += (fullText ? '\n' : '') + data.stderr;
          outputEl.innerHTML = ansiToHtml(fullText);
        }
      } catch (err) {
        outputEl.className = 'term-output error';
        outputEl.textContent = `Xatolik: ${err.message}`;
      }

      scrollTerminalToBottom();
    })();
  }

  if (terminalInput) {
    terminalInput.addEventListener('input', () => {
      updateSuggestion();
    });

    terminalInput.addEventListener('keydown', async (e) => {
      // Tab yoki ArrowRight (qator oxirida) bosilganda autosuggestion ni qabul qilish
      if (e.key === 'Tab') {
        if (currentSuggestion) {
          e.preventDefault();
          terminalInput.value = currentSuggestion;
          clearSuggestion();
          return;
        }
      }

      if (e.key === 'ArrowRight') {
        if (currentSuggestion && terminalInput.selectionStart === terminalInput.value.length) {
          e.preventDefault();
          terminalInput.value = currentSuggestion;
          clearSuggestion();
          return;
        }
      }

      if (e.key === 'Escape') {
        clearSuggestion();
        return;
      }

      if (e.key === 'Enter') {
        clearSuggestion();
        e.preventDefault();

        // 1. Agar jarayon davom etayotgan bo'lsa (masalan: su ron parol kutayotgan bo'lsa)
        if (isCommandRunning && runningCmdId) {
          const stdinText = terminalInput.value;
          terminalInput.value = '';
          if (shellWs && shellWs.readyState === WebSocket.OPEN) {
            shellWs.send(JSON.stringify({ id: runningCmdId, type: 'stdin', text: stdinText + '\r' }));
          }
          return;
        }

        // 2. Yangi buyruq kiritish
        const cmd = terminalInput.value;
        if (!cmd.trim()) return;

        terminalInput.value = '';
        if (terminalActiveLine) terminalActiveLine.classList.add('running');

        try {
          await executeTerminalCommand(cmd);
        } finally {
          isCommandRunning = false;
          runningCmdId = null;
          if (terminalActiveLine) {
            terminalActiveLine.classList.remove('running');
            terminalActiveLine.classList.remove('hidden');
          }
          terminalInput.focus();
          scrollTerminalToBottom();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        clearSuggestion();
        if (cmdHistory.length > 0 && cmdIndex > 0) {
          cmdIndex--;
          terminalInput.value = cmdHistory[cmdIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        clearSuggestion();
        if (cmdIndex < cmdHistory.length - 1) {
          cmdIndex++;
          terminalInput.value = cmdHistory[cmdIndex];
        } else {
          cmdIndex = cmdHistory.length;
          terminalInput.value = '';
        }
      } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        clearSuggestion();
        if (terminalHistory) terminalHistory.innerHTML = '';
      }
    });
  }

  if (terminalScreen) {
    terminalScreen.addEventListener('click', () => {
      if (window.getSelection().toString().length === 0) {
        if (terminalInput) terminalInput.focus();
      }
    });
  }

  // Global Ctrl+C (SIGINT / Bekor qilish)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (window.getSelection().toString().length > 0) {
        return;
      }

      if (isCommandRunning && runningCmdId) {
        e.preventDefault();
        try {
          if (shellWs && shellWs.readyState === WebSocket.OPEN) {
            shellWs.send(JSON.stringify({ id: runningCmdId, type: 'interrupt' }));
          }
        } catch (_) {}

        // Tarixga ^C qo'shish
        const entries = document.querySelectorAll('.terminal-history .term-entry');
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1];
          const outEl = lastEntry.querySelector('.term-output');
          if (outEl) {
            outEl.innerHTML += '^C\n';
          }
        }

        isCommandRunning = false;
        runningCmdId = null;
        if (terminalActiveLine) {
          terminalActiveLine.classList.remove('running');
          terminalActiveLine.classList.remove('hidden');
        }
        if (terminalInput) {
          terminalInput.value = '';
          terminalInput.focus();
        }
        scrollTerminalToBottom();
        return;
      }

      if (document.activeElement === terminalInput && terminalInput.value) {
        e.preventDefault();
        terminalInput.value = '';
        clearSuggestion();
      }
    }
  });

  // ================= 13. NAVIGATSIYA TUGMALARI =================
  // Menyu -> Ekran
  if (modeScreenBtn) {
    modeScreenBtn.addEventListener('click', () => {
      enterScreenView();
    });
  }

  // Menyu -> Shell
  if (modeShellBtn) {
    modeShellBtn.addEventListener('click', () => {
      showView('shell-view');
    });
  }

  // Menyu -> Chiqish
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutSession();
    });
  }

  // Splash Bekor qilish tugmasi
  if (splashCancelBtn) {
    splashCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopStream();
      showView('welcome-view');
    });
  }

  // WebRTC bosqichlarini splashda aks ettirish
  if (videoEl) {
    videoEl.addEventListener('webrtc-handshake', () => {
      updateSplashStep(2, 'Apparat H.264 video va miks audio kodi ochilmoqda...');
    });
    videoEl.addEventListener('webrtc-track', () => {
      updateSplashStep(2, 'Ovoz va tasvir treklari qabul qilindi...');
    });
    videoEl.addEventListener('webrtc-connected', () => {
      updateSplashStep(3, 'Lokal apparat oqimi ulandi, birinchi kadr kutilmoqda...');
    });
  }

  // Ekranga tekkanda / harakatlanganda bottombarni ko'rsatish
  if (screenView) {
    screenView.addEventListener('click', (e) => {
      if (e.target.closest('#screen-bottombar')) return;
      toggleBottombar();
    });

    screenView.addEventListener('mousemove', () => {
      showBottombar();
    });

    screenView.addEventListener('touchstart', (e) => {
      if (e.target.closest('#screen-bottombar')) return;
      showBottombar();
    }, { passive: true });
  }

  // Bottombar -> Bosh menyu (Dashboard)
  if (barDashboardBtn) {
    barDashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showView('welcome-view');
    });
  }

  // Bottombar -> Pauza / Play
  if (barPauseBtn) {
    barPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
      showBottombar();
    });
  }

  // Bottombar -> Ovoz (Audio On/Off)
  if (barAudioBtn) {
    barAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAudio();
      showBottombar();
    });
  }

  // Bottombar -> Gapirish (Mic On/Off)
  if (barMicBtn) {
    barMicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMic();
      showBottombar();
    });
  }

  // Bottombar -> Original PTY Terminal
  if (barShellBtn) {
    barShellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showView('pty-view');
      initPtyTerminal();
    });
  }

  // Bottombar -> To'liq ekran
  if (barFullscreenBtn) {
    barFullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreen();
      showBottombar();
    });
  }

  // Bottombar -> 3-Nuqta (More menyu)
  if (barMoreBtn) {
    barMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) {
        barMoreMenu.classList.toggle('hidden');
        if (!barMoreMenu.classList.contains('hidden')) {
          if (bottombarTimer) clearTimeout(bottombarTimer);
        } else {
          showBottombar();
        }
      }
    });
  }

  // Menyu tashqarisiga bosilganda uni yopish
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.bar-more-wrapper')) {
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
    }
  });

  // More menu -> Picture-in-Picture
  if (menuPipBtn) {
    menuPipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
      togglePictureInPicture();
    });
  }

  // More menu -> Qayta ulanish (Reconnect)
  if (menuReconnectBtn) {
    menuReconnectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (barMoreMenu) barMoreMenu.classList.add('hidden');
      reconnectStream();
    });
  }

  // More menu -> Tizimdan chiqish
  if (menuLogoutBtn) {
    menuLogoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      logoutSession();
    });
  }

  // Shell sarlavhasi -> Ekran
  if (shellToScreenBtn) {
    shellToScreenBtn.addEventListener('click', () => {
      showView('screen-view');
      startStream();
      toggleFullscreen(true);
    });
  }

  // Shell sarlavhasi -> Menyu
  if (shellToMenuBtn) {
    shellToMenuBtn.addEventListener('click', () => {
      showView('welcome-view');
    });
  }

  // Shell sarlavhasi -> Chiqish
  if (shellLogoutBtn) {
    shellLogoutBtn.addEventListener('click', () => {
      logoutSession();
    });
  }

  // ================= 14. BLOK TAYMERI =================
  function startBlockCountdown(totalSeconds) {
    if (blockCountdownTimer) clearInterval(blockCountdownTimer);
    let remain = Math.max(1, Math.round(totalSeconds));

    function updateBlockText() {
      const mins = Math.floor(remain / 60);
      const secs = remain % 60;
      let timeText = '';
      if (mins > 0) timeText += `${mins} daqiqa `;
      timeText += `${secs} soniya`;
      if (loginError) {
        loginError.textContent = `Xavfsizlik bloki: Juda ko'p xato urinishlar. Ushbu IP ${timeText}ga bloklangan.`;
        loginError.classList.remove('hidden');
      }
    }

    updateBlockText();
    blockCountdownTimer = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearInterval(blockCountdownTimer);
        blockCountdownTimer = null;
        if (loginError) loginError.classList.add('hidden');
      } else {
        updateBlockText();
      }
    }, 1000);
  }

  // ================= 15. LOGIN FORMA =================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.classList.add('hidden');

      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!username || !password) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Tekshirilmoqda...';
      }

      try {
        const res = await fetch(getApiUrl('/api/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
          if (blockCountdownTimer) {
            clearInterval(blockCountdownTimer);
            blockCountdownTimer = null;
          }
          authToken = data.token;
          currentUsername = data.username || username;
          localStorage.setItem('desktop_auth_token', authToken);
          localStorage.setItem('desktop_username', currentUsername);

          if (passwordInput) passwordInput.value = '';
          if (data.lanUrl) {
            updateLanTip(data.lanUrl);
          }

          const isCloudMode = new URLSearchParams(window.location.search).get('cloud') === '1';
          if (!isLocalHostName(window.location.hostname) && !isCloudMode) {
            const destHost = data.lanIp ? `${data.lanIp}:7777` : '192.168.1.106:7777';
            const isHome = await checkLocalWifi(destHost, 500);
            if (isHome) {
              showView('splash-view');
              window.location.replace(`http://${destHost}/desktop?token=${encodeURIComponent(authToken)}`);
              return;
            }
            showWelcomeView(currentUsername);
            return;
          }

          showWelcomeView(currentUsername);
        } else {
          if (data.retryAfterSeconds) {
            startBlockCountdown(data.retryAfterSeconds);
          } else {
            if (blockCountdownTimer) {
              clearInterval(blockCountdownTimer);
              blockCountdownTimer = null;
            }
            if (loginError) {
              loginError.textContent = data.message || 'Login yoki parol noto‘g‘ri!';
              loginError.classList.remove('hidden');
            }
          }
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = 'Server bilan bog‘lanishda xatolik yuz berdi';
          loginError.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirish';
        }
      }
    });
  }

  // ================= 15.1 ORIGINAL PTY INTERAKTIV TERMINAL (1:1) =================
  let ptyTerm = null;
  let ptyFitAddon = null;
  let ptyWs = null;

  function getPtyStreamUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${getHost()}/pty-stream${token}`;
  }

  function initPtyTerminal() {
    if (!ptyTerminalContainer) return;

    if (!ptyTerm) {
      if (typeof Terminal === 'undefined') {
        console.error('xterm.js yuklanmadi');
        return;
      }

      ptyTerm = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize: window.innerWidth < 768 ? 12 : 14,
        letterSpacing: 0,
        lineHeight: 1.15,
        theme: {
          background: '#000000',
          foreground: '#e6e6e6',
          cursor: '#00ff66',
          cursorAccent: '#000000',
          selectionBackground: 'rgba(0, 255, 102, 0.3)',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#bd93f9',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#bfbfbf',
          brightBlack: '#4d4d4d',
          brightRed: '#ff6e67',
          brightGreen: '#5af78e',
          brightYellow: '#f4f99d',
          brightBlue: '#caa9fa',
          brightMagenta: '#ff92d0',
          brightCyan: '#9aedfe',
          brightWhite: '#e6e6e6'
        },
        convertEol: true,
        scrollback: 10000
      });

      if (typeof FitAddon !== 'undefined' && FitAddon.FitAddon) {
        ptyFitAddon = new FitAddon.FitAddon();
        ptyTerm.loadAddon(ptyFitAddon);
      }

      ptyTerm.open(ptyTerminalContainer);

      ptyTerm.onData((data) => {
        if (ptyWs && ptyWs.readyState === WebSocket.OPEN) {
          ptyWs.send(data);
        }
      });

      window.addEventListener('resize', () => {
        if (ptyFitAddon && ptyView && !ptyView.classList.contains('hidden')) {
          try {
            ptyFitAddon.fit();
            if (ptyWs && ptyWs.readyState === WebSocket.OPEN) {
              ptyWs.send(`\x01${ptyTerm.cols},${ptyTerm.rows}`);
            }
          } catch (_) {}
        }
      });
    }

    connectPtyWs();

    setTimeout(() => {
      if (ptyFitAddon) {
        try {
          ptyFitAddon.fit();
          if (ptyWs && ptyWs.readyState === WebSocket.OPEN) {
            ptyWs.send(`\x01${ptyTerm.cols},${ptyTerm.rows}`);
          }
        } catch (_) {}
      }
      if (ptyTerm) ptyTerm.focus();
    }, 150);
  }

  function connectPtyWs() {
    if (ptyWs) {
      try { ptyWs.close(); } catch (_) {}
      ptyWs = null;
    }

    if (ptyStatusText) {
      ptyStatusText.textContent = 'Ulanmoqda...';
      ptyStatusText.style.color = '#888';
    }

    try {
      ptyWs = new WebSocket(getPtyStreamUrl());

      ptyWs.onopen = () => {
        if (ptyStatusText) {
          ptyStatusText.textContent = 'Ulangan (Online)';
          ptyStatusText.style.color = 'var(--accent-green)';
        }
        if (ptyFitAddon) {
          try {
            ptyFitAddon.fit();
            ptyWs.send(`\x01${ptyTerm.cols},${ptyTerm.rows}`);
          } catch (_) {}
        }
        if (ptyTerm) ptyTerm.focus();
      };

      ptyWs.onmessage = (ev) => {
        if (ptyTerm) {
          ptyTerm.write(ev.data);
        }
      };

      ptyWs.onerror = () => {
        if (ptyStatusText) {
          ptyStatusText.textContent = 'Xatolik';
          ptyStatusText.style.color = '#ff5555';
        }
      };

      ptyWs.onclose = () => {
        if (ptyStatusText) {
          ptyStatusText.textContent = 'Uzildi (Offline)';
          ptyStatusText.style.color = '#888';
        }
      };
    } catch (e) {
      console.error('PTY WS ulanish xatosi:', e);
    }
  }

  // Menyu -> Original PTY Terminal
  if (modePtyBtn) {
    modePtyBtn.addEventListener('click', () => {
      showView('pty-view');
      initPtyTerminal();
    });
  }

  // PTY navigatsiya tugmalari
  if (ptyToScreenBtn) {
    ptyToScreenBtn.addEventListener('click', () => {
      enterScreenView();
    });
  }

  if (ptyToShellBtn) {
    ptyToShellBtn.addEventListener('click', () => {
      showView('shell-view');
    });
  }

  if (ptyToMenuBtn) {
    ptyToMenuBtn.addEventListener('click', () => {
      showView('welcome-view');
    });
  }

  if (ptyReconnectBtn) {
    ptyReconnectBtn.addEventListener('click', () => {
      connectPtyWs();
    });
  }

  if (ptyLogoutBtn) {
    ptyLogoutBtn.addEventListener('click', () => {
      logoutSession();
    });
  }

  // Virtual klaviatura tugmalari (mobil / planshet uchun qulaylik)
  const PTY_KEY_MAP = {
    'up': '\x1b[A',
    'down': '\x1b[B',
    'right': '\x1b[C',
    'left': '\x1b[D',
    'esc': '\x1b',
    'tab': '\t',
    'ctrl_c': '\x03',
    'ctrl_d': '\x04',
    'enter': '\r',
    'sudo': 'sudo '
  };

  if (ptyVirtualKeys) {
    const handleKeyAction = (e) => {
      const btn = e.target.closest('.pty-key-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const code = btn.getAttribute('data-code');
      const directKey = btn.getAttribute('data-key');
      let payload = (code && PTY_KEY_MAP[code]) ? PTY_KEY_MAP[code] : directKey;
      if (payload && payload.includes('\\x1b')) {
        payload = payload.replace(/\\x1b/g, '\x1b').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\x03/g, '\x03').replace(/\\x04/g, '\x04');
      }

      if (payload && ptyWs && ptyWs.readyState === WebSocket.OPEN) {
        ptyWs.send(payload);
      }
      if (ptyTerm) {
        ptyTerm.focus();
      }
    };

    ptyVirtualKeys.addEventListener('pointerdown', handleKeyAction);
    ptyVirtualKeys.addEventListener('click', (e) => e.preventDefault());
  }

  // ================= 16. ISHGA TUSHIRISH =================
  updateCwdUI();
  initConfig();
})();
