import { spawn } from 'node:child_process';
const PREBUFFER_CHUNKS = 25;
const REBUFFER_CHUNKS = 10;
const MAX_QUEUED_CHUNKS = 1024;
const RESUME_QUEUE_CHUNKS = 256;
const RESYNC_AFTER_MS = 250;
export class AudioFeeder {
    constructor(sampleRate, channels, framesPerChunk, onChunk, source = 'silence', hooks = {}) {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.framesPerChunk = framesPerChunk;
        this.onChunk = onChunk;
        this.source = source;
        this.onTrackStart = hooks.onTrackStart ?? (() => {});
        this.onTrackEnd = hooks.onTrackEnd ?? (() => {});
        this.onIdle = hooks.onIdle ?? (() => {});
        this.ffmpegPath = hooks.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
        this.droppedChunks = 0;
        this.underflowChunks = 0;
        this.bytesProduced = 0;
        this.chunksEmitted = 0;
        this.rebuffers = 0;
        this.tracksPlayed = 0;
        this._proc = null;
        this._playlist = [];
        this._current = null;
        this._sourceEnded = false;
        this._idle = false;
        this._pendingParts = [];
        this._pendingBytes = 0;
        this._queue = [];
        this._emitTimer = null;
        this._startedAtMs = 0;
        this._emitIndex = 0;
        this._buffering = true;
        this._hasStarted = false;
        this._running = false;
        this._chunkSamples = this.framesPerChunk * this.channels;
        this._chunkBytes = this._chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        this._chunkIntervalMs = (this.framesPerChunk / this.sampleRate) * 1000;
    }
    get queuedChunks() {
        return this._queue.length;
    }
    get playlistLength() {
        return this._playlist.length;
    }
    get currentTrack() {
        return this._current;
    }
    get idle() {
        return this._idle;
    }
    stats() {
        return {
            queued: this._queue.length,
            underflow: this.underflowChunks,
            rebuffers: this.rebuffers,
            dropped: this.droppedChunks,
            emitted: this.chunksEmitted,
            produced: this.bytesProduced,
        };
    }
    enqueue(source) {
        const tracks = Array.isArray(source) ? source : [source];
        for (const track of tracks) {
            if (track) {
                this._playlist.push(track);
            }
        }
        // Hanya auto-advance kalau memang idle. Saat decoder sudah selesai tapi queue
        // masih diputar, _proc null bukan berarti track selesai (jangan potong track).
        if (this._running && !this._current && !this._proc) {
            this._advance();
        }
        return this._playlist.length;
    }
    clearPlaylist() {
        this._playlist = [];
    }
    skip() {
        if (!this._proc && !this._queue.length && !this._pendingBytes) {
            return false;
        }
        this._stopSource();
        // Buang audio track lama yang sudah ter-decode di depan (buffer bisa sampai 20 dtk).
        this._queue = [];
        this._advance();
        return true;
    }
    start(playlist) {
        if (this._running) {
            return;
        }
        this._running = true;
        this._idle = false;
        this._buffering = true;
        this._hasStarted = false;
        this._emitIndex = 0;
        this._startedAtMs = 0;
        const initial = playlist ?? (this.source ? [this.source] : []);
        this._playlist = Array.isArray(initial) ? [...initial] : [initial];
        this._advance();
        this._schedule();
    }
    stop() {
        this._running = false;
        if (this._emitTimer) {
            clearTimeout(this._emitTimer);
            this._emitTimer = null;
        }
        this._stopSource();
        this._playlist = [];
        this._current = null;
        this._pendingParts = [];
        this._pendingBytes = 0;
        this._queue = [];
        this._buffering = true;
        this._hasStarted = false;
    }
    _stopSource() {
        const proc = this._proc;
        this._proc = null;
        if (proc) {
            proc.stdout?.removeAllListeners('data');
            proc.removeAllListeners('close');
            try {
                proc.kill?.('SIGTERM');
            }
            catch {}
        }
        // Sisa byte dari track lama jangan tercampur ke track berikutnya.
        this._pendingParts = [];
        this._pendingBytes = 0;
    }
    _advance() {
        const next = this._playlist.shift();
        if (!next) {
            this._current = null;
            if (!this._idle) {
                this._idle = true;
                this.onIdle();
            }
            return;
        }
        this._idle = false;
        this._current = next;
        this._sourceEnded = false;
        this._buffering = true;
        this._spawn(next);
        this.tracksPlayed += 1;
        this.onTrackStart(next);
    }
    _spawn(source) {
        const proc = spawn(this.ffmpegPath, [
            '-hide_banner',
            '-loglevel', 'error',
            '-thread_queue_size', '512',
            ...this._resolveInputArgs(source),
            '-f', 'f32le',
            '-ac', String(this.channels),
            '-ar', String(this.sampleRate),
            'pipe:1'
        ]);
        this._proc = proc;
        proc.stdout.on('data', chunk => this._absorb(chunk));
        proc.stderr.on('data', chunk => {
            process.stderr.write(`[AudioFeeder] ${chunk.toString().trim()}\n`);
        });
        proc.on('close', code => {
            if (this._proc !== proc) {
                return;
            }
            if (code !== 0 && code !== null) {
                process.stderr.write(`[AudioFeeder] ffmpeg exited with code=${code}\n`);
            }
            this._proc = null;
            this._sourceEnded = true;
            // Flush sisa byte yang sudah terbaca tapi belum jadi chunk.
            this._drainPending();
        });
    }
    _resolveInputArgs(source = this.source) {
        if (!source || source === 'silence') {
            // Sumber sintetis murah: biarkan realtime supaya tidak membuang CPU/pipe.
            return ['-re', '-f', 'lavfi', '-i', `aevalsrc=0:d=3600:s=${this.sampleRate}`];
        }
        if (source.startsWith('lavfi:')) {
            return ['-re', '-f', 'lavfi', '-i', source.slice('lavfi:'.length)];
        }
        // File/URL: JANGAN pakai -re. Biarkan decoder jalan di depan mengisi queue,
        // jadi event-loop jitter tidak langsung menyebabkan underflow/gap.
        return ['-i', source];
    }
    _absorb(chunk) {
        this._pendingParts.push(chunk);
        this._pendingBytes += chunk.length;
        this._drainPending();
    }
    _drainPending() {
        while (this._pendingBytes >= this._chunkBytes) {
            if (this._queue.length >= MAX_QUEUED_CHUNKS) {
                if (this._proc) {
                    this._proc.stdout.pause();
                    return;
                }
                // Proses sudah selesai: sisa tail tetap harus masuk queue.
            }
            this._queue.push(this._takeChunk());
        }
    }
    _takeChunk() {
        const frame = this._pendingParts.length === 1 && this._pendingParts[0].length === this._chunkBytes
            ? this._pendingParts.shift()
            : this._takeFromParts();
        this._pendingBytes -= this._chunkBytes;
        this.bytesProduced += this._chunkBytes;
        const out = new Float32Array(this._chunkSamples);
        out.set(new Float32Array(frame.buffer, frame.byteOffset, this._chunkSamples));
        return out;
    }
    _takeFromParts() {
        const frame = Buffer.allocUnsafe(this._chunkBytes);
        let filled = 0;
        while (filled < this._chunkBytes) {
            const part = this._pendingParts[0];
            const take = Math.min(part.length, this._chunkBytes - filled);
            part.copy(frame, filled, 0, take);
            filled += take;
            if (take === part.length) {
                this._pendingParts.shift();
            }
            else {
                this._pendingParts[0] = part.subarray(take);
            }
        }
        return frame;
    }
    _schedule() {
        if (!this._running) {
            return;
        }
        const now = performance.now();
        if (this._startedAtMs === 0) {
            this._startedAtMs = now;
        }
        let target = this._startedAtMs + this._emitIndex * this._chunkIntervalMs;
        if (now - target > RESYNC_AFTER_MS) {
            // Terlalu jauh tertinggal (mis. GC/CPU spike). Lewati bagian yang hilang
            // daripada menumpuk burst chunk yang membuat audio makin parah.
            this._startedAtMs = now - this._emitIndex * this._chunkIntervalMs;
            target = this._startedAtMs + this._emitIndex * this._chunkIntervalMs;
        }
        this._emitTimer = setTimeout(() => {
            this._emitTimer = null;
            this._tick();
        }, Math.max(0, target - now));
    }
    _tick() {
        if (!this._running && !this._proc) {
            return;
        }
        if (!this._proc && this._pendingBytes) {
            this._drainPending();
        }
        if (this._sourceEnded && !this._queue.length && !this._pendingBytes) {
            this._sourceEnded = false;
            const finished = this._current;
            this._current = null;
            this.onTrackEnd(finished);
            this._advance();
        }
        // Prebuffer hanya untuk awal playback. Setelah mulai, jangan pernah berhenti
        // mengirim chunk: WASM capture mengharapkan cadence tetap tiap chunk.
        if (!this._hasStarted) {
            if (this._buffering && this._queue.length < PREBUFFER_CHUNKS && this._proc) {
                this._startedAtMs = 0;
                this._emitIndex = 0;
                // Poll santai, jangan setTimeout(0) berulang saat menunggu prebuffer.
                this._emitTimer = setTimeout(() => {
                    this._emitTimer = null;
                    this._tick();
                }, 10);
                return;
            }
            this._buffering = false;
        }
        const chunk = this._queue.shift();
        if (chunk) {
            this._hasStarted = true;
            this.onChunk(chunk);
        }
        else {
            // Underflow: kirim silence supaya timeline WASM tidak melompat.
            // Saat memang idle (tidak ada track), silence ini normal, bukan underflow.
            if (this._current || this._proc) {
                this.underflowChunks += 1;
            }
            this.onChunk(new Float32Array(this._chunkSamples));
            if (this._proc) {
                this.rebuffers += 1;
            }
        }
        this.chunksEmitted += 1;
        this._emitIndex += 1;
        if (this._buffering && this._queue.length >= REBUFFER_CHUNKS) {
            this._buffering = false;
        }
        if (this._proc?.stdout.isPaused() && this._queue.length <= RESUME_QUEUE_CHUNKS) {
            this._proc.stdout.resume();
            this._drainPending();
        }
        this._schedule();
    }
}
export default AudioFeeder;
