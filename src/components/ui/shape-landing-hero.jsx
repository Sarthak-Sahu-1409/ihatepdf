import { motion } from "framer-motion";

function ElegantShape({
  style: positionStyle = {},
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  color = "rgba(99,102,241,0.35)",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      style={{ position: "absolute", ...positionStyle }}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ width, height, position: "relative" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: `linear-gradient(to right, ${color}, transparent)`,
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            border: "2px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px 0 rgba(255,255,255,0.1)",
          }}
        />
        {/* Inner radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2), transparent 70%)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

function ShapeLandingHero() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Subtle ambient gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom right, rgba(99,102,241,0.12), transparent, rgba(244,63,94,0.12))",
          filter: "blur(48px)",
        }}
      />

      <ElegantShape
        delay={0.3}
        width={600}
        height={140}
        rotate={12}
        color="rgba(99,102,241,0.35)"
        style={{ left: "-5%", top: "20%" }}
      />

      <ElegantShape
        delay={0.5}
        width={500}
        height={120}
        rotate={-15}
        color="rgba(244,63,94,0.35)"
        style={{ right: "0%", top: "75%" }}
      />

      <ElegantShape
        delay={0.4}
        width={300}
        height={80}
        rotate={-8}
        color="rgba(139,92,246,0.35)"
        style={{ left: "10%", bottom: "10%" }}
      />

      <ElegantShape
        delay={0.6}
        width={200}
        height={60}
        rotate={20}
        color="rgba(245,158,11,0.35)"
        style={{ right: "20%", top: "15%" }}
      />

      <ElegantShape
        delay={0.7}
        width={150}
        height={40}
        rotate={-25}
        color="rgba(6,182,212,0.35)"
        style={{ left: "25%", top: "10%" }}
      />

      {/* Top/bottom fade overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, #030303, transparent, rgba(3,3,3,0.8))",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export { ShapeLandingHero };
