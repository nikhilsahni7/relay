"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "denied"
  | "error";

const BAR_COUNT = 56;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * Mic recording with a live level meter. Wraps MediaRecorder (webm/opus) plus
 * an AnalyserNode that feeds a rolling array of amplitudes for the waveform.
 * Auto-stops at `maxSeconds`, and fully tears down the stream on stop/unmount.
 */
export function useRecorder(maxSeconds = 120) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(0)
  );
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const maxRef = useRef(maxSeconds);
  maxRef.current = maxSeconds;

  const teardown = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setSeconds(0);
    levelsRef.current = new Array(BAR_COUNT).fill(0);
    setLevels(levelsRef.current);
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("denied");
      setError("Microphone access was blocked.");
      return;
    }
    streamRef.current = stream;

    // Level metering.
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioCtx = new AudioCtx();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyserRef.current = analyser;
    const buffer = new Uint8Array(analyser.fftSize);

    // Recorder.
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = mimeType || "audio/webm";
      setBlob(new Blob(chunksRef.current, { type }));
      setStatus("stopped");
      teardown();
    };

    recorder.start();
    startedAtRef.current = performance.now();
    setStatus("recording");

    const tick = () => {
      const analyserNode = analyserRef.current;
      if (!analyserNode) return;
      analyserNode.getByteTimeDomainData(buffer);
      // RMS deviation from the 128 midpoint -> 0..1 amplitude.
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);
      const amp = Math.min(1, rms * 2.4);
      const next = levelsRef.current.slice(1);
      next.push(amp);
      levelsRef.current = next;
      setLevels(next);

      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      setSeconds(Math.floor(elapsed));
      if (elapsed >= maxRef.current) {
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stop, teardown]);

  const reset = useCallback(() => {
    stop();
    teardown();
    setStatus("idle");
    setSeconds(0);
    setBlob(null);
    setError(null);
    levelsRef.current = new Array(BAR_COUNT).fill(0);
    setLevels(levelsRef.current);
  }, [stop, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { status, seconds, levels, blob, error, start, stop, reset };
}
