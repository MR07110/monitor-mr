(() => {
  'use strict';

  // ================= 1. ESKI DOMENDAN YANGI DOMENGA REDIRECT =================
  if (window.location.hostname === 'web-desktop-chi.vercel.app') {
    window.location.replace('https://monitor-mr.vercel.app' + window.location.pathname + window.location.search);
    return;
  }

  // ================= 2. DOM ELEMENTLAR =================
  const splashView = document.getElementById('splash-view');
  const loginView = document.getElementById('login-view');
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const loginError = document.getElementById('login-error');

  // PTY Terminal elementlari
  const ptyView = document.getElementById('pty-view');
  const ptyStatusBadge = document.getElementById('pty-status-badge');
  const ptyNetBadge = document.getElementById('pty-net-badge');
  const ptyLanSwitchBtn = document.getElementById('pty-lan-switch-btn');
  const ptyReconnectBtn = document.getElementById('pty-reconnect-btn');
  const ptyFullscreenBtn = document.getElementById('pty-fullscreen-btn');
  const ptyLogoutBtn = document.getElementById('pty-logout-btn');
  const ptyTerminalContainer = document.getElementById('pty-terminal-container');
  const ptyVirtualKeys = document.getElementById('pty-virtual-keys');

  // ================= 3. HOLAT (STATE) =================
  let authToken = localStorage.getItem('desktop_auth_token') || null;
  let currentUsername = localStorage.getItem('desktop_username') || '';
  let remoteHost = localStorage.getItem('remote_desk_host') || 'satisfy-endurance-mooned.ngrok-free.dev';
  let lanHost = '192.168.1.106:7777';
  let currentView = 'splash-view';

  let ptyTerm = null;
  let ptyFitAddon = null;
  let ptyWs = null;
  let ptyReconnectTimer = null;
  let pingTimer = null;
  let lastPingTs = 0;
  let isConnecting = false;

  // ================= 4. VIEW ALMASHTIRISH =================
  function showView(viewId) {
    currentView = viewId;
    [splashView, loginView, ptyView].forEach(v => {
      if (v) v.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
    }
  }

  // ================= 5. TARMOQ VA HOST ANIQLASH (LOKAL vs ONLINE) =================
  function isLocalHostName(h) {
    return h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h) || h.endsWith('.local');
  }

  function isCurrentHostLocal() {
    return isLocalHostName(window.location.hostname);
  }

  function getHost() {
    if (isCurrentHostLocal()) {
      return window.location.host;
    }
    return remoteHost || localStorage.getItem('remote_desk_host') || window.location.host;
  }

  function getApiUrl(path) {
    if (isCurrentHostLocal()) {
      return path;
    }
    return `${window.location.protocol}//${getHost()}${path}`;
  }

  function getPtyStreamUrl() {
    const isLocal = isCurrentHostLocal();
    const protocol = isLocal ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'wss:';
    const host = getHost();
    const token = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    return `${protocol}//${host}/pty-stream${token}`;
  }

  function updateNetworkBadge() {
    if (!ptyNetBadge) return;
    const isLocal = isCurrentHostLocal();
    if (isLocal) {
      ptyNetBadge.className = 'pty-badge local';
      ptyNetBadge.textContent = `⚡ Lokal (${window.location.hostname})`;
      if (ptyLanSwitchBtn) ptyLanSwitchBtn.classList.add('hidden');
    } else {
      ptyNetBadge.className = 'pty-badge online';
      ptyNetBadge.textContent = '🌐 Online (Bulut)';
      if (ptyLanSwitchBtn) {
        ptyLanSwitchBtn.href = `http://${lanHost}/?token=${encodeURIComponent(authToken || '')}`;
        ptyLanSwitchBtn.classList.remove('hidden');
      }
    }
  }

  // ================= 6. XABARNOMALAR (TOAST) =================
  function showToast(message, isError = false) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = '#1a1a1a';
      toast.style.color = '#fff';
      toast.style.padding = '8px 16px';
      toast.style.borderRadius = '6px';
      toast.style.border = '1px solid #333';
      toast.style.fontFamily = 'monospace';
      toast.style.fontSize = '12px';
      toast.style.zIndex = '9999';
      toast.style.transition = 'opacity 0.2s';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.borderColor = isError ? '#ff5555' : 'var(--accent-green, #00ff66)';
    toast.style.opacity = '1';
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  // ================= 7. PTY XTERM TERMINALNI ISHGA TUSHIRISH =================
  function syncPtyViewport() {
    if (!ptyView || ptyView.classList.contains('hidden')) return;

    if (window.visualViewport) {
      const vv = window.visualViewport;
      const isKeyboardOpen = (window.innerHeight - vv.height) > 60;

      ptyView.style.height = `${vv.height}px`;
      ptyView.style.top = `${vv.offsetTop}px`;

      if (isKeyboardOpen) {
        ptyView.classList.add('keyboard-open');
      } else {
        ptyView.classList.remove('keyboard-open');
      }

      if (ptyFitAddon && ptyTerm) {
        try {
          ptyFitAddon.fit();
          if (ptyWs && ptyWs.readyState === WebSocket.OPEN) {
            ptyWs.send(`\x01${ptyTerm.cols},${ptyTerm.rows}`);
          }
        } catch (_) {}
      }
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncPtyViewport);
    window.visualViewport.addEventListener('scroll', syncPtyViewport);
  }

  function initPtyTerminal() {
    showView('pty-view');
    updateNetworkBadge();

    if (!ptyTerminalContainer) return;

    if (!ptyTerminalContainer._tapBound) {
      ptyTerminalContainer._tapBound = true;
      ptyTerminalContainer.addEventListener('pointerdown', () => {
        if (ptyTerm) ptyTerm.focus();
      });
    }

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
        lineHeight: 1.18,
        theme: {
          background: '#000000',
          foreground: '#f0f0f0',
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
          brightWhite: '#ffffff'
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
      syncPtyViewport();
      if (ptyTerm) ptyTerm.focus();
    }, 150);
  }

  function setPtyStatus(text, statusClass) {
    if (!ptyStatusBadge) return;
    ptyStatusBadge.className = `pty-badge ${statusClass}`;
    ptyStatusBadge.textContent = text;
  }

  function connectPtyWs() {
    if (isConnecting) return;
    if (ptyWs && (ptyWs.readyState === WebSocket.OPEN || ptyWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (ptyReconnectTimer) {
      clearTimeout(ptyReconnectTimer);
      ptyReconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }

    isConnecting = true;
    setPtyStatus('Ulanmoqda...', 'connecting');

    try {
      const wsUrl = getPtyStreamUrl();
      ptyWs = new WebSocket(wsUrl);

      ptyWs.onopen = () => {
        isConnecting = false;
        const isLocal = isCurrentHostLocal();
        setPtyStatus(isLocal ? 'Ulangan (Lokal)' : 'Ulangan (Online)', 'online');
        updateNetworkBadge();

        if (ptyFitAddon && ptyTerm) {
          try {
            ptyFitAddon.fit();
            ptyWs.send(`\x01${ptyTerm.cols},${ptyTerm.rows}`);
          } catch (_) {}
        }
        syncPtyViewport();
        if (ptyTerm) ptyTerm.focus();

        // Keep-Alive ping
        pingTimer = setInterval(() => {
          if (ptyWs && ptyWs.readyState === WebSocket.OPEN) {
            lastPingTs = Date.now();
            try { ptyWs.send('{"type":"ping"}'); } catch (_) {}
          }
        }, 15000);
      };

      ptyWs.onmessage = (ev) => {
        if (ptyTerm) {
          ptyTerm.write(ev.data);
        }
      };

      ptyWs.onerror = () => {
        isConnecting = false;
        setPtyStatus('Xatolik', 'error');
      };

      ptyWs.onclose = (ev) => {
        isConnecting = false;
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }

        if (ev.code === 1008 || ev.code === 401) {
          setPtyStatus('Avtorizatsiya xatosi', 'error');
          localStorage.removeItem('desktop_auth_token');
          authToken = null;
          showToast('Sessiya muddati tugadi, qaytadan kiring', true);
          showView('login-view');
          return;
        }

        setPtyStatus('Uzildi (Qayta ulanmoqda...)', 'connecting');

        // Avtomatik qayta ulanish (2 soniya)
        if (currentView === 'pty-view') {
          ptyReconnectTimer = setTimeout(() => {
            connectPtyWs();
          }, 2000);
        }
      };
    } catch (e) {
      isConnecting = false;
      setPtyStatus('Ulanib bo‘lmadi', 'error');
      console.error('PTY WS ulanish xatosi:', e);
    }
  }

  // ================= 8. MOBIL VIRTUAL TUGMALAR =================
  if (ptyVirtualKeys) {
    ptyVirtualKeys.addEventListener('click', (e) => {
      const btn = e.target.closest('.pty-key-btn');
      if (!btn || !ptyWs || ptyWs.readyState !== WebSocket.OPEN) return;
      e.preventDefault();
      e.stopPropagation();

      const code = btn.dataset.code;
      const keyMap = {
        'esc': '\x1b',
        'tab': '\t',
        'ctrl_c': '\x03',
        'ctrl_d': '\x04',
        'up': '\x1b[A',
        'down': '\x1b[B',
        'right': '\x1b[C',
        'left': '\x1b[D',
        'sudo': 'sudo ',
        'enter': '\r'
      };

      const val = keyMap[code];
      if (val) {
        ptyWs.send(val);
        if (ptyTerm) ptyTerm.focus();
      }
    });
  }

  // ================= 9. TUGMALAR VA HARAKATLAR =================
  if (ptyReconnectBtn) {
    ptyReconnectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ptyWs) {
        try { ptyWs.close(); } catch (_) {}
        ptyWs = null;
      }
      showToast('Qayta ulanmoqda...');
      connectPtyWs();
    });
  }

  if (ptyFullscreenBtn) {
    ptyFullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  if (ptyLogoutBtn) {
    ptyLogoutBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Terminaldan chiqmoqchimisiz?')) {
        try {
          await fetch(getApiUrl('/api/logout'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken || ''}`,
              'ngrok-skip-browser-warning': 'true'
            },
            credentials: 'include'
          }).catch(() => {});
        } catch (_) {}

        localStorage.removeItem('desktop_auth_token');
        authToken = null;
        if (ptyWs) {
          try { ptyWs.close(); } catch (_) {}
          ptyWs = null;
        }
        showView('login-view');
        showToast('Tizimdan chiqildi');
      }
    });
  }

  // ================= 10. LOGIN FORMASI =================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Kirilmoqda...';
      if (loginError) loginError.classList.add('hidden');

      try {
        const res = await fetch(getApiUrl('/api/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({
            username,
            password,
            clientInfo: navigator.userAgent
          })
        });

        const data = await res.json();

        if (data && data.success && data.token) {
          authToken = data.token;
          currentUsername = data.username || username;
          localStorage.setItem('desktop_auth_token', authToken);
          localStorage.setItem('desktop_username', currentUsername);

          if (data.lanHost) {
            lanHost = data.lanHost;
          }

          submitBtn.textContent = 'Kirildi!';
          showToast(`Xush kelibsiz, ${currentUsername}!`);

          // TO'G'RIDAN-TO'G'RI TERMINALGA O'TISH (DASHBOARDSIZ)
          initPtyTerminal();
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirish';
          if (loginError) {
            loginError.textContent = data.message || 'Login yoki parol xato!';
            loginError.classList.remove('hidden');
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kirish';
        if (loginError) {
          loginError.textContent = 'Serverga ulanishda xatolik yuz berdi!';
          loginError.classList.remove('hidden');
        }
      }
    });
  }

  // ================= 11. ILK YUKLANISH (INIT) =================
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

    // Config olish (Vercel yoki Local)
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
    } catch (_) {}

    // Agar token bo'lsa -> Sessiyani tekshirish
    if (authToken) {
      try {
        const authRes = await fetch(getApiUrl('/api/check-auth'), {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include'
        }).catch(() => null);

        if (authRes && authRes.ok) {
          const authData = await authRes.json().catch(() => null);
          if (authData && authData.authenticated) {
            currentUsername = authData.username || '';
            // TO'G'RIDAN-TO'G'RI TERMINALGA KIRISH!
            initPtyTerminal();
            return;
          }
        }
      } catch (_) {}
    }

    // Agar token bo'lmasa yoki eskirgan bo'lsa -> Login
    showView('login-view');
  }

  initConfig();
})();
