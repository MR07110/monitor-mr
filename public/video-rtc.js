/**
 * VideoRTC v1.6.0 - Video player for go2rtc streaming application.
 *
 * All modern web technologies are supported in almost any browser except Apple Safari.
 *
 * Support:
 * - ECMAScript 2017 (ES8) = ES6 + async
 * - RTCPeerConnection for Safari iOS 11.0+
 * - IntersectionObserver for Safari iOS 12.2+
 * - ManagedMediaSource for Safari 17+
 *
 * Doesn't support:
 * - MediaSource for Safari iOS
 * - Customized built-in elements (extends HTMLVideoElement) because Safari
 * - Autoplay for WebRTC in Safari
 */
class VideoRTC extends HTMLElement {
    constructor() {
        super();

        this.DISCONNECT_TIMEOUT = 0;
        this.RECONNECT_TIMEOUT = 5000;

        this.CODECS = [
            'avc1.640029',      // H.264 high 4.1 (Chromecast 1st and 2nd Gen)
            'avc1.64002A',      // H.264 high 4.2 (Chromecast 3rd Gen)
            'avc1.640033',      // H.264 high 5.1 (Chromecast with Google TV)
            'hvc1.1.6.L153.B0', // H.265 main 5.1 (Chromecast Ultra)
            'mp4a.40.2',        // AAC LC
            'mp4a.40.5',        // AAC HE
            'flac',             // FLAC (PCM compatible)
            'opus',             // OPUS Chrome, Firefox
        ];

        /**
         * [config] Supported modes (webrtc, webrtc/tcp, mse, hls, mp4, mjpeg).
         * @type {string}
         */
        this.mode = 'webrtc';

        /**
         * [Config] Requested medias (video, audio, microphone).
         * @type {string}
         */
        this.media = 'video,audio,microphone';

        /**
         * [config] Run stream when not displayed on the screen. Default `false`.
         * @type {boolean}
         */
        this.background = true;

        /**
         * [config] Run stream only when player in the viewport. Stop when user scroll out player.
         * Value is percentage of visibility from `0` (not visible) to `1` (full visible).
         * Default `0` - disable;
         * @type {number}
         */
        this.visibilityThreshold = 0;

        /**
         * [config] Run stream only when browser page on the screen. Stop when user change browser
         * tab or minimise browser windows.
         * @type {boolean}
         */
        this.visibilityCheck = false;

        /**
         * [config] WebRTC configuration
         * @type {RTCConfiguration}
         */
        this.pcConfig = {
            bundlePolicy: 'max-bundle',
            iceServers: [
                {
                    urls: [
                        'stun:stun.relay.metered.ca:80',
                        'stun:stun.l.google.com:19302',
                        'stun:stun.cloudflare.com:3478'
                    ]
                },
                {
                    urls: [
                        'turn:global.relay.metered.ca:80',
                        'turn:global.relay.metered.ca:80?transport=tcp',
                        'turn:global.relay.metered.ca:443',
                        'turns:global.relay.metered.ca:443?transport=tcp'
                    ],
                    username: 'd5b5680286f6730ad41485ee',
                    credential: 'UPzzx6Xfqi9gFwB1'
                }
            ],
            sdpSemantics: 'unified-plan',
        };

        /**
         * [info] WebSocket connection state. Values: CONNECTING, OPEN, CLOSED
         * @type {number}
         */
        this.wsState = WebSocket.CLOSED;

        /**
         * [info] WebRTC connection state.
         * @type {number}
         */
        this.pcState = WebSocket.CLOSED;

        /**
         * @type {HTMLVideoElement}
         */
        this.video = null;

        /**
         * @type {WebSocket}
         */
        this.ws = null;

        /**
         * @type {string|URL}
         */
        this.wsURL = '';

        /**
         * @type {RTCPeerConnection}
         */
        this.pc = null;

        /**
         * @type {number}
         */
        this.connectTS = 0;

        /**
         * @type {string}
         */
        this.mseCodecs = '';

        /**
         * [internal] Disconnect TimeoutID.
         * @type {number}
         */
        this.disconnectTID = 0;

        /**
         * [internal] Reconnect TimeoutID.
         * @type {number}
         */
        this.reconnectTID = 0;

        /**
         * [internal] Handler for receiving Binary from WebSocket.
         * @type {Function}
         */
        this.ondata = null;

        /**
         * [internal] Handlers list for receiving JSON from WebSocket.
         * @type {Object.<string,Function>}
         */
        this.onmessage = null;
    }

    /**
     * Set video source (WebSocket URL). Support relative path.
     * @param {string|URL} value
     */
    set src(value) {
        if (typeof value !== 'string') value = value.toString();
        if (value.startsWith('http')) {
            value = 'ws' + value.substring(4);
        } else if (value.startsWith('/')) {
            value = 'ws' + location.origin.substring(4) + value;
        }

        this.wsURL = value;

        this.onconnect();
    }

    /**
     * Play video. Support automute when autoplay blocked.
     * https://developer.chrome.com/blog/autoplay/
     */
    play() {
        this.video.play().catch(() => {
            if (!this.video.muted) {
                this.video.muted = true;
                this.video.play().catch(er => {
                    console.warn(er);
                });
            }
        });
    }

    /**
     * Send message to server via WebSocket
     * @param {Object} value
     */
    send(value) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(value));
            } catch (e) {
                console.warn('[video-rtc] send error:', e);
            }
        }
    }

    /** @param {Function} isSupported */
    codecs(isSupported) {
        return this.CODECS
            .filter(codec => this.media.includes(codec.includes('vc1') ? 'video' : 'audio'))
            .filter(codec => isSupported(`video/mp4; codecs="${codec}"`)).join();
    }

    /**
     * `CustomElement`. Invoked each time the custom element is appended into a
     * document-connected element.
     */
    connectedCallback() {
        if (this.disconnectTID) {
            clearTimeout(this.disconnectTID);
            this.disconnectTID = 0;
        }

        // because video autopause on disconnected from DOM
        if (this.video) {
            const seek = this.video.seekable;
            if (seek.length > 0) {
                this.video.currentTime = seek.end(seek.length - 1);
            }
            this.play();
        } else {
            this.oninit();
        }

        this.onconnect();
    }

    /**
     * `CustomElement`. Invoked each time the custom element is disconnected from the
     * document's DOM.
     */
    disconnectedCallback() {
        if (this.background || this.disconnectTID) return;
        if (this.wsState === WebSocket.CLOSED && this.pcState === WebSocket.CLOSED) return;

        this.disconnectTID = setTimeout(() => {
            if (this.reconnectTID) {
                clearTimeout(this.reconnectTID);
                this.reconnectTID = 0;
            }

            this.disconnectTID = 0;

            this.ondisconnect();
        }, this.DISCONNECT_TIMEOUT);
    }

    /**
     * Creates child DOM elements. Called automatically once on `connectedCallback`.
     */
    oninit() {
        this.video = document.createElement('video');
        this.video.controls = false;
        this.video.playsInline = true;
        this.video.preload = 'auto';

        this.video.style.display = 'block'; // fix bottom margin 4px
        this.video.style.width = '100%';
        this.video.style.height = '100%';

        this.appendChild(this.video);

        this.video.addEventListener('waiting', () => {
            this.play();
        });
        this.video.addEventListener('stalled', () => {
            this.play();
        });

        this.video.addEventListener('error', ev => {
            const err = this.video.error;
            // ondisconnect() dagi video.src='' brauzerda zararsiz "Empty src" xatosi beradi, qayta ulanishga sabab bo'lmasin
            if (err && err.code === 4 && /Empty src/i.test(err.message || '')) return;
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
            const MEDIA_ERRORS = {
                1: 'MEDIA_ERR_ABORTED',
                2: 'MEDIA_ERR_NETWORK',
                3: 'MEDIA_ERR_DECODE',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
            };
            console.error('[VideoRTC] Video error:', {
                error: err ? MEDIA_ERRORS[err.code] : 'unknown',
                message: err ? err.message : 'unknown',
                codecs: this.mseCodecs || 'not set',
                readyState: this.video.readyState,
                networkState: this.video.networkState,
                currentTime: this.video.currentTime
            });
            if (this.ws) this.ws.close(); // run reconnect for broken MSE stream
        });

        // all Safari lies about supported audio codecs
        const m = window.navigator.userAgent.match(/Version\/(\d+).+Safari/);
        if (m) {
            // AAC from v13, FLAC from v14, OPUS - unsupported
            const skip = m[1] < '13' ? 'mp4a.40.2' : m[1] < '14' ? 'flac' : 'opus';
            this.CODECS.splice(this.CODECS.indexOf(skip));
        }

        if (this.background) return;

        if ('hidden' in document && this.visibilityCheck) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.disconnectedCallback();
                } else if (this.isConnected) {
                    this.connectedCallback();
                }
            });
        }

        if ('IntersectionObserver' in window && this.visibilityThreshold) {
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) {
                        this.disconnectedCallback();
                    } else if (this.isConnected) {
                        this.connectedCallback();
                    }
                });
            }, {threshold: this.visibilityThreshold});
            observer.observe(this);
        }
    }

    /**
     * Connect to WebSocket. Called automatically on `connectedCallback`.
     * @return {boolean} true if the connection has started.
     */
    onconnect() {
        if (!this.isConnected || !this.wsURL || this.ws || this.pc) return false;

        // CLOSED or CONNECTING => CONNECTING
        this.wsState = WebSocket.CONNECTING;

        this.connectTS = Date.now();

        this.ws = new WebSocket(this.wsURL);
        this.ws.binaryType = 'arraybuffer';
        this.ws.addEventListener('open', () => this.onopen());
        this.ws.addEventListener('close', () => this.onclose());

        return true;
    }

    ondisconnect() {
        this.wsState = WebSocket.CLOSED;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.pcState = WebSocket.CLOSED;
        if (this.pc) {
            this.pc.getSenders().forEach(sender => {
                if (sender.track) sender.track.stop();
            });
            this.pc.close();
            this.pc = null;
        }

        this.video.src = '';
        this.video.srcObject = null;
    }

    /**
     * @returns {Array.<string>} of modes (mse, webrtc, etc.)
     */
    onopen() {
        // CONNECTING => OPEN
        this.wsState = WebSocket.OPEN;

        this.ws.addEventListener('message', ev => {
            if (typeof ev.data === 'string') {
                const msg = JSON.parse(ev.data);
                for (const mode in this.onmessage) {
                    this.onmessage[mode](msg);
                }
            } else {
                this.ondata(ev.data);
            }
        });

        this.ondata = null;
        this.onmessage = {};

        const modes = [];

        if (this.mode.includes('mse') && ('MediaSource' in window || 'ManagedMediaSource' in window)) {
            modes.push('mse');
            this.onmse();
        } else if (this.mode.includes('hls') && this.video.canPlayType('application/vnd.apple.mpegurl')) {
            modes.push('hls');
            this.onhls();
        } else if (this.mode.includes('mp4')) {
            modes.push('mp4');
            this.onmp4();
        }

        if (this.mode.includes('webrtc') && 'RTCPeerConnection' in window) {
            modes.push('webrtc');
            this.onwebrtc();
        }

        if (this.mode.includes('mjpeg')) {
            if (modes.length) {
                this.onmessage['mjpeg'] = msg => {
                    if (msg.type !== 'error' || msg.value.indexOf(modes[0]) !== 0) return;
                    this.onmjpeg();
                };
            } else {
                modes.push('mjpeg');
                this.onmjpeg();
            }
        }

        return modes;
    }

    /**
     * @return {boolean} true if reconnection has started.
     */
    onclose() {
        if (this.wsState === WebSocket.CLOSED) return false;

        // CONNECTING, OPEN => CONNECTING
        this.wsState = WebSocket.CONNECTING;
        this.ws = null;

        // reconnect no more than once every X seconds
        const delay = Math.max(this.RECONNECT_TIMEOUT - (Date.now() - this.connectTS), 0);

        this.reconnectTID = setTimeout(() => {
            this.reconnectTID = 0;
            this.onconnect();
        }, delay);

        return true;
    }

    onmse() {
        /** @type {MediaSource} */
        let ms;

        if ('ManagedMediaSource' in window) {
            const MediaSource = window.ManagedMediaSource;

            ms = new MediaSource();
            ms.addEventListener('sourceopen', () => {
                this.send({type: 'mse', value: this.codecs(MediaSource.isTypeSupported)});
            }, {once: true});

            this.video.disableRemotePlayback = true;
            this.video.srcObject = ms;
        } else {
            ms = new MediaSource();
            ms.addEventListener('sourceopen', () => {
                URL.revokeObjectURL(this.video.src);
                this.send({type: 'mse', value: this.codecs(MediaSource.isTypeSupported)});
            }, {once: true});

            this.video.src = URL.createObjectURL(ms);
            this.video.srcObject = null;
        }

        this.play();

        this.mseCodecs = '';

        this.onmessage['mse'] = msg => {
            if (msg.type !== 'mse') return;

            this.mseCodecs = msg.value;

            const sb = ms.addSourceBuffer(msg.value);
            sb.mode = 'segments'; // segments or sequence
            sb.addEventListener('updateend', () => {
                if (!sb.updating && bufLen > 0) {
                    try {
                        const data = buf.slice(0, bufLen);
                        sb.appendBuffer(data);
                        bufLen = 0;
                    } catch (e) {
                        // console.debug(e);
                    }
                }

                if (!sb.updating && sb.buffered && sb.buffered.length) {
                    const end = sb.buffered.end(sb.buffered.length - 1);
                    const start = end - 0.8;
                    const start0 = sb.buffered.start(0);
                    if (start > start0) {
                        try {
                            sb.remove(start0, start);
                            ms.setLiveSeekableRange(start, end);
                        } catch (e) {}
                    }
                    const gap = end - this.video.currentTime;
                    // Doimo oxirgi jonli kadrda (live edge) turish, eski kadrlar buferini ko'rsatmaslik
                    if (gap > 0.25 || this.video.currentTime < start) {
                        this.video.currentTime = end;
                    }
                    this.video.playbackRate = 1.0;
                }
            });

            const buf = new Uint8Array(2 * 1024 * 1024);
            let bufLen = 0;

            this.ondata = data => {
                if (sb.updating || bufLen > 0) {
                    const b = new Uint8Array(data);
                    buf.set(b, bufLen);
                    bufLen += b.byteLength;
                    // console.debug('VideoRTC.buffer', b.byteLength, bufLen);
                } else {
                    try {
                        sb.appendBuffer(data);
                    } catch (e) {
                        // console.debug(e);
                    }
                }
            };
        };
    }

    onwebrtc() {
        const pc = new RTCPeerConnection(this.pcConfig);
        this._mediaStream = new MediaStream();
        this.video.srcObject = this._mediaStream;

        pc.ontrack = ev => {
            if (ev.track) {
                if (!this._mediaStream.getTracks().includes(ev.track)) {
                    this._mediaStream.addTrack(ev.track);
                }
            }
            if (ev.streams && ev.streams[0]) {
                ev.streams[0].getTracks().forEach(t => {
                    if (!this._mediaStream.getTracks().includes(t)) {
                        this._mediaStream.addTrack(t);
                    }
                });
            }
            if (ev.receiver) {
                try {
                    if ('playoutDelayHint' in ev.receiver) {
                        ev.receiver.playoutDelayHint = 0.06;
                    }
                    if ('jitterBufferTarget' in ev.receiver) {
                        ev.receiver.jitterBufferTarget = 60;
                    }
                } catch (_) {}
            }
            this.play();
            this.dispatchEvent(new CustomEvent('webrtc-track', { detail: { kind: ev.track ? ev.track.kind : 'unknown' } }));
            this.pcState = WebSocket.OPEN;
        };

        pc.addEventListener('icecandidate', ev => {
            if (ev.candidate && this.mode.includes('webrtc/tcp') && ev.candidate.protocol === 'udp') return;

            const candidate = ev.candidate ? ev.candidate.toJSON().candidate : '';
            this.send({type: 'webrtc/candidate', value: candidate});
        });

        let disconnectWatchdog = null;
        pc.addEventListener('connectionstatechange', async () => {
            if (pc.connectionState === 'connected') {
                if (disconnectWatchdog) {
                    clearTimeout(disconnectWatchdog);
                    disconnectWatchdog = null;
                }
                this.pcState = WebSocket.OPEN;
                this.play();
                try {
                    const stats = await pc.getStats();
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
                            const localCand = stats.get(report.localCandidateId);
                            const remoteCand = stats.get(report.remoteCandidateId);
                            const rtt = report.currentRoundTripTime ? (report.currentRoundTripTime * 1000).toFixed(1) + 'ms' : '0ms';
                            const isLocal = (remoteCand && (remoteCand.candidateType === 'host' || (remoteCand.ip || remoteCand.address || '').startsWith('192.168.')));
                            console.log(`[WebRTC] Ulanish: ${isLocal ? 'LOKAL WI-FI (0ms kechikish)' : 'BULUT (Relay/Internet)'} | RTT: ${rtt}`);
                            this.dispatchEvent(new CustomEvent('webrtc-stats', {
                                detail: { isLocal, rtt, localCand, remoteCand }
                            }));
                        }
                    });
                } catch (e) {}
            } else if (pc.connectionState === 'failed') {
                if (disconnectWatchdog) {
                    clearTimeout(disconnectWatchdog);
                    disconnectWatchdog = null;
                }
                pc.close();

                this.pcState = WebSocket.CLOSED;
                this.pc = null;

                this.onconnect();
            } else if (pc.connectionState === 'disconnected') {
                if (!disconnectWatchdog) {
                    disconnectWatchdog = setTimeout(() => {
                        disconnectWatchdog = null;
                        if (pc.connectionState === 'disconnected') {
                            console.warn('[VideoRTC] WebRTC disconnected holatida qoldi, avtomatik qayta tiklanmoqda...');
                            try { pc.close(); } catch (e) {}
                            this.pcState = WebSocket.CLOSED;
                            this.pc = null;
                            this.onconnect();
                        }
                    }, 3500);
                }
            }
        });

        pc.addEventListener('iceconnectionstatechange', () => {
            if (pc.iceConnectionState === 'failed') {
                console.warn('[VideoRTC] ICE muvaffaqiyatsiz, qayta tiklanmoqda...');
                try { pc.close(); } catch (e) {}
                this.pcState = WebSocket.CLOSED;
                this.pc = null;
                this.onconnect();
            }
        });

        let isRemoteDescSet = false;
        const pendingCandidates = [];

        this.onmessage['webrtc'] = async msg => {
            switch (msg.type) {
                case 'webrtc/candidate':
                    if (!msg.value) return;
                    if (this.mode.includes('webrtc/tcp') && msg.value.includes(' udp ')) return;

                    if (!isRemoteDescSet) {
                        pendingCandidates.push(msg.value);
                    } else {
                        pc.addIceCandidate({candidate: msg.value, sdpMid: '0'}).catch(er => {
                            console.warn('[VideoRTC] addIceCandidate xatosi:', er);
                        });
                    }
                    break;
                case 'webrtc/answer':
                    try {
                        await pc.setRemoteDescription({type: 'answer', sdp: msg.value});
                        isRemoteDescSet = true;
                        this.dispatchEvent(new CustomEvent('webrtc-handshake'));
                        while (pendingCandidates.length > 0) {
                            const cand = pendingCandidates.shift();
                            pc.addIceCandidate({candidate: cand, sdpMid: '0'}).catch(er => {
                                console.warn('[VideoRTC] buferlangan candidate xatosi:', er);
                            });
                        }
                    } catch (er) {
                        console.warn('[VideoRTC] setRemoteDescription xatosi:', er);
                    }
                    break;
                case 'error':
                    if (!msg.value.includes('webrtc/offer')) return;
                    pc.close();
            }
        };

        this.createOffer(pc).then(offer => {
            this.send({type: 'webrtc/offer', value: offer.sdp});
        });

        this.pcState = WebSocket.CONNECTING;
        this.pc = pc;
    }

    _getSilentTrack() {
        if (this._silentTrack && this._silentTrack.readyState === 'live') {
            return this._silentTrack;
        }
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const dst = ctx.createMediaStreamDestination();
            osc.connect(dst);
            osc.start();
            this._silentTrack = dst.stream.getAudioTracks()[0];
            this._silentTrack.enabled = false;
            return this._silentTrack;
        } catch (e) {
            return null;
        }
    }

    async initMicrophone() {
        if (this.micStream && this.micStream.active) return this.micStream;

        const getUserMediaFn = (constraints) => {
            if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
                return navigator.mediaDevices.getUserMedia(constraints);
            }
            const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
            if (typeof legacy === 'function') {
                return new Promise((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
            }
            return Promise.reject(new Error('Mikrofon API mavjud emas'));
        };

        try {
            this.micStream = await getUserMediaFn({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                }
            });
            const track = this.micStream.getAudioTracks()[0];
            if (track && this.micTransceiver && this.micTransceiver.sender) {
                await this.micTransceiver.sender.replaceTrack(track);
            }
            this.micEnabled = true;
            this.setMicEnabled(true);
            return this.micStream;
        } catch (e) {
            console.warn('[VideoRTC] Mikrofon xatosi:', e);
            return null;
        }
    }

    /**
     * @param pc {RTCPeerConnection}
     * @return {Promise<RTCSessionDescriptionInit>}
     */
    async createOffer(pc) {
        try {
            if (this.media.includes('microphone')) {
                // Mikrofonni orqa fonda tayyorlab qo'yamiz, video ochilishini to'xtatib qo'ymaymiz
                const initialTrack = (this.micStream && this.micStream.active) ? this.micStream.getAudioTracks()[0] : this._getSilentTrack();
                if (initialTrack) {
                    this.micTransceiver = pc.addTransceiver(initialTrack, {direction: 'sendonly'});
                } else {
                    this.micTransceiver = pc.addTransceiver('audio', {direction: 'sendonly'});
                }
                if (this.micTransceiver && 'setCodecPreferences' in this.micTransceiver && window.RTCRtpSender && RTCRtpSender.getCapabilities) {
                    try {
                        const caps = RTCRtpSender.getCapabilities('audio');
                        if (caps && caps.codecs) {
                            const pcma = caps.codecs.filter(c => /pcma/i.test(c.mimeType));
                            const pcmu = caps.codecs.filter(c => /pcmu/i.test(c.mimeType));
                            const opus = caps.codecs.filter(c => /opus/i.test(c.mimeType));
                            const rest = caps.codecs.filter(c => !/pcma|pcmu|opus/i.test(c.mimeType));
                            this.micTransceiver.setCodecPreferences([...pcma, ...pcmu, ...opus, ...rest]);
                        }
                    } catch (e) {
                        console.warn('[VideoRTC] setCodecPreferences:', e);
                    }
                }
            }
        } catch (e) {
            console.warn('[VideoRTC] Mic error:', e);
        }

        for (const kind of ['video', 'audio']) {
            if (this.media.includes(kind)) {
                pc.addTransceiver(kind, {direction: 'recvonly'});
            }
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        return offer;
    }

    setMicEnabled(enabled) {
        this.micEnabled = !!enabled;
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => {
                track.enabled = this.micEnabled;
            });
        }
    }

    async toggleMic() {
        if (!this.micStream || !this.micStream.active) {
            const stream = await this.initMicrophone();
            if (!stream) {
                return false;
            }
            return true;
        }

        const nextState = !this.micEnabled;
        this.setMicEnabled(nextState);
        if (!nextState && this._silentTrack && this.micTransceiver && this.micTransceiver.sender) {
            this.micTransceiver.sender.replaceTrack(this._silentTrack).catch(() => {});
        } else if (nextState && this.micStream && this.micTransceiver && this.micTransceiver.sender) {
            const track = this.micStream.getAudioTracks()[0];
            if (track) this.micTransceiver.sender.replaceTrack(track).catch(() => {});
        }
        return this.micEnabled;
    }

    /**
     * @param video2 {HTMLVideoElement}
     */
    onpcvideo(video2) {
        if (this.pc) {
            // Video+Audio > Video, H265 > H264, Video > Audio, WebRTC > MSE
            let rtcPriority = 0, msePriority = 0;

            /** @type {MediaStream} */
            const stream = video2.srcObject;
            if (stream.getVideoTracks().length > 0) {
                // not the best, but a pretty simple way to check a codec
                const isH265Supported =  this.pc.remoteDescription.sdp.includes('H265/90000');
                rtcPriority += isH265Supported ? 0x240 : 0x220;
            }
            if (stream.getAudioTracks().length > 0) rtcPriority += 0x102;

            if (this.mseCodecs.includes('hvc1.')) msePriority += 0x230;
            if (this.mseCodecs.includes('avc1.')) msePriority += 0x210;
            if (this.mseCodecs.includes('mp4a.')) msePriority += 0x101;

            if (rtcPriority >= msePriority) {
                this.video.srcObject = stream;
                this.play();

                this.pcState = WebSocket.OPEN;
                // Aloqa uzilmasligi va ikki tomonlama mikrofon ishlashi uchun WebSocket ochiq qoldiriladi
            } else {
                this.pcState = WebSocket.CLOSED;
                if (this.pc) {
                    this.pc.close();
                    this.pc = null;
                }
            }
        }

        video2.srcObject = null;
    }

    onmjpeg() {
        this.ondata = data => {
            this.video.controls = false;
            this.video.poster = 'data:image/jpeg;base64,' + VideoRTC.btoa(data);
        };

        this.send({type: 'mjpeg'});
    }

    onhls() {
        this.onmessage['hls'] = msg => {
            if (msg.type !== 'hls') return;

            const url = 'http' + this.wsURL.substring(2, this.wsURL.indexOf('/ws')) + '/hls/';
            const playlist = msg.value.replace('hls/', url);
            this.video.src = 'data:application/vnd.apple.mpegurl;base64,' + btoa(playlist);
            this.play();
        };

        this.send({type: 'hls', value: this.codecs(type => this.video.canPlayType(type))});
    }

    onmp4() {
        /** @type {HTMLCanvasElement} **/
        const canvas = document.createElement('canvas');
        /** @type {CanvasRenderingContext2D} */
        let context;

        /** @type {HTMLVideoElement} */
        const video2 = document.createElement('video');
        video2.autoplay = true;
        video2.playsInline = true;
        video2.muted = true;

        video2.addEventListener('loadeddata', () => {
            if (!context) {
                canvas.width = video2.videoWidth;
                canvas.height = video2.videoHeight;
                context = canvas.getContext('2d');
            }

            context.drawImage(video2, 0, 0, canvas.width, canvas.height);

            this.video.controls = false;
            this.video.poster = canvas.toDataURL('image/jpeg');
        });

        this.ondata = data => {
            video2.src = 'data:video/mp4;base64,' + VideoRTC.btoa(data);
        };

        this.send({type: 'mp4', value: this.codecs(this.video.canPlayType)});
    }

    static btoa(buffer) {
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        let binary = '';
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}

customElements.define('video-rtc', VideoRTC);
window.VideoRTC = VideoRTC;
