import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashProps {
  onFinish: () => void;
}

export default function Splash({ onFinish }: SplashProps) {
  const [phase, setPhase] = useState<"video" | "fade-out">("video");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fallback = setTimeout(() => setPhase("fade-out"), 3000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (phase === "fade-out") {
      const t = setTimeout(onFinish, 500);
      return () => clearTimeout(t);
    }
  }, [phase, onFinish]);

  const handleVideoEnd = () => setPhase("fade-out");
  const handleVideoError = () => setPhase("fade-out");

  return (
    <AnimatePresence>
      {phase !== "fade-out" ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black cursor-pointer"
          onClick={() => setPhase("fade-out")}
        >
          <video
            ref={videoRef}
            src="/collision.mp4"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />

          <div className="relative z-10 flex flex-col items-center">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-3xl font-bold tracking-tighter text-white"
            >
              OpenCERN
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xs mt-2 tracking-widest uppercase text-white/40"
            >
              Particle Physics Analysis Platform
            </motion.p>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            className="absolute bottom-6 text-xs text-white/20"
          >
            Click anywhere to continue
          </motion.p>
        </motion.div>
      ) : (
        <motion.div
          key="fade"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 bg-black"
        />
      )}
    </AnimatePresence>
  );
}
