import { useRef, useCallback } from "react";

type AlarmPattern = "start" | "tick" | "half" | "end" | "rest_end" | "exercise_done";

export function useAlarmSynthesizer() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playAlarmSound = useCallback((pattern: AlarmPattern = "end") => {
    try {
      // 소리 설정 OFF면 무시
      if (typeof window !== "undefined" && localStorage.getItem("ohunjal_settings_sound") === "false") return;
      const ctx = getAudioCtx();
      const t = ctx.currentTime;

      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -3;
      master.knee.value = 3;
      master.ratio.value = 3;
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.8;
      master.connect(masterGain);
      masterGain.connect(ctx.destination);

      const moktak = (start: number, vol: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(480, start);
        o.frequency.exponentialRampToValueAtTime(180, start + 0.08);
        o.connect(g);
        g.connect(master);
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        o.start(start); o.stop(start + 0.12);
        const bLen = Math.floor(ctx.sampleRate * 0.008);
        const buf = ctx.createBuffer(1, bLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bLen, 3);
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const nG = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 800;
        f.Q.value = 3;
        n.connect(f);
        f.connect(nG);
        nG.connect(master);
        nG.gain.setValueAtTime(vol * 0.7, start);
        nG.gain.exponentialRampToValueAtTime(0.001, start + 0.02);
        n.start(start);
      };

      const smallBell = (start: number, vol: number, decay: number) => {
        const freqs = [1200, 2400, 3180, 4200];
        const gains = [1, 0.5, 0.3, 0.15];
        freqs.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          o.connect(g);
          g.connect(master);
          const v = vol * gains[i];
          g.gain.setValueAtTime(v, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + decay * (1 - i * 0.1));
          o.start(start); o.stop(start + decay);
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.type = "sine";
          o2.frequency.value = freq * 1.004;
          o2.connect(g2);
          g2.connect(master);
          g2.gain.setValueAtTime(v * 0.4, start);
          g2.gain.exponentialRampToValueAtTime(0.001, start + decay * (1 - i * 0.1));
          o2.start(start); o2.stop(start + decay);
        });
        const bLen = Math.floor(ctx.sampleRate * 0.006);
        const buf = ctx.createBuffer(1, bLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bLen, 2);
        const n = ctx.createBufferSource();
        n.buffer = buf;
        const nG = ctx.createGain();
        const nF = ctx.createBiquadFilter();
        nF.type = "highpass";
        nF.frequency.value = 4000;
        n.connect(nF);
        nF.connect(nG);
        nG.connect(master);
        nG.gain.setValueAtTime(vol * 0.5, start);
        nG.gain.exponentialRampToValueAtTime(0.001, start + 0.015);
        n.start(start);
      };

      const ripple = (start: number, vol: number) => {
        const notes = [1047, 1319, 1568, 1760, 2093];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const m = ctx.createOscillator();
          const mG = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          m.type = "sine";
          m.frequency.value = freq * 3.5;
          m.connect(mG);
          mG.connect(osc.frequency);
          const s = start + i * 0.065;
          mG.gain.setValueAtTime(freq * 1.5, s);
          mG.gain.exponentialRampToValueAtTime(freq * 0.02, s + 0.4);
          osc.connect(g);
          g.connect(master);
          const v = vol * (0.6 + i * 0.08);
          g.gain.setValueAtTime(v, s);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.5 - i * 0.04);
          osc.start(s); osc.stop(s + 0.5);
          m.start(s); m.stop(s + 0.5);
        });
      };

      switch (pattern) {
        case "start": {
          const wb = ctx.createOscillator();
          const wbG = ctx.createGain();
          wb.type = "sine";
          wb.frequency.setValueAtTime(480, t);
          wb.frequency.exponentialRampToValueAtTime(180, t + 0.08);
          wb.connect(wbG);
          wbG.connect(master);
          wbG.gain.setValueAtTime(0.9, t);
          wbG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          wb.start(t); wb.stop(t + 0.12);
          const wLen = Math.floor(ctx.sampleRate * 0.008);
          const wBuf = ctx.createBuffer(1, wLen, ctx.sampleRate);
          const wD = wBuf.getChannelData(0);
          for (let i = 0; i < wLen; i++) wD[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / wLen, 3);
          const wN = ctx.createBufferSource();
          wN.buffer = wBuf;
          const wNG = ctx.createGain();
          const wF = ctx.createBiquadFilter();
          wF.type = "bandpass";
          wF.frequency.value = 800;
          wF.Q.value = 3;
          wN.connect(wF);
          wF.connect(wNG);
          wNG.connect(master);
          wNG.gain.setValueAtTime(0.7, t);
          wNG.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
          wN.start(t);
          break;
        }
        case "tick":
          moktak(t, 0.8);
          break;
        case "half":
          ripple(t, 0.55);
          break;
        case "end":
          smallBell(t, 0.8, 0.8);
          smallBell(t + 0.3, 0.8, 0.8);
          smallBell(t + 0.6, 0.8, 0.8);
          break;
        case "rest_end":
          smallBell(t, 0.85, 0.8);
          smallBell(t + 0.3, 0.85, 0.8);
          smallBell(t + 0.6, 0.85, 0.8);
          break;
        case "exercise_done":
          smallBell(t, 0.9, 1.0);
          smallBell(t + 0.35, 0.9, 1.0);
          smallBell(t + 0.7, 0.9, 1.2);
          break;
      }
    } catch (e) {}
  }, []);

  return playAlarmSound;
}
