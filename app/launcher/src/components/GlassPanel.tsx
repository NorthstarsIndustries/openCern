import React from "react";
import { motion } from "framer-motion";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  subtle?: boolean;
  padding?: string;
  onClick?: () => void;
}

export default function GlassPanel({
  children,
  className = "",
  hover = false,
  subtle = false,
  padding = "p-4",
  onClick,
}: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={onClick}
      className={`
        ${subtle ? "glass-subtle" : "glass"}
        ${hover ? "glass-hover cursor-pointer" : ""}
        ${padding}
        ${className}
      `}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
