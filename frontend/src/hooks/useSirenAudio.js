import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * useSirenAudio Hook
 * Synthesizes a realistic dual-tone security alarm siren using the native Web Audio API.
 * No external MP3 audio files required.
 */
export default function useSirenAudio() {
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sirenIntervalRef = useRef(null);

  // Initialize Web Audio Context on user interaction
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Start dual-tone oscillating siren
  const startSiren = useCallback(() => {
    if (isMuted || isPlaying) return;

    try {
      const ctx = getAudioContext();

      // Create oscillator and gain nodes
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime); // Controlled volume

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      oscRef.current = osc;
      gainNodeRef.current = gain;
      setIsPlaying(true);

      // Modulate frequency between 750Hz and 1250Hz (classic police/security siren pitch)
      let highTone = false;
      sirenIntervalRef.current = setInterval(() => {
        if (!oscRef.current || !audioCtxRef.current) return;
        const now = audioCtxRef.current.currentTime;
        const targetFreq = highTone ? 1250 : 750;
        oscRef.current.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.2);
        highTone = !highTone;
      }, 250);

    } catch (err) {
      console.warn('[FlowGuard WebAudio] Could not start siren:', err);
    }
  }, [getAudioContext, isMuted, isPlaying]);

  // Stop siren immediately
  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }

    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        // Safe ignore
      }
      oscRef.current = null;
    }

    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // Safe ignore
      }
      gainNodeRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) stopSiren();
      return next;
    });
  }, [stopSiren]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSiren();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stopSiren]);

  return {
    startSiren,
    stopSiren,
    toggleMute,
    isMuted,
    isPlaying
  };
}
