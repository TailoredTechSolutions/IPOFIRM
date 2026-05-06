import { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Zap, Globe } from "lucide-react";

const HeroCanvas = lazy(() => import("@/components/HeroCanvas"));

// ── Word-stagger reveal ───────────────────────────────────────────────────────
function AnimatedHeadline({ text }: { text: string }) {
  return (
    <span className="flex flex-wrap justify-center gap-x-3 gap-y-1">
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  color,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="rounded-2xl p-6 border relative overflow-hidden group cursor-default"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderColor: `${color}20`,
      }}
    >
      {/* Glow bg */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}10, transparent 70%)` }}
      />

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 relative z-10"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold text-white/80 mb-2 relative z-10">{title}</h3>
      <p className="text-xs text-white/40 leading-relaxed relative z-10">{desc}</p>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Index() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{
        background: "#04080f",
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {/* Grid texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* 3D canvas background */}
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>

        {/* Radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 30%, #04080f 80%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-8"
            style={{
              background: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.25)",
              color: "#d4af37",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#d4af37", boxShadow: "0 0 8px #d4af3780" }}
            />
            VC Intelligence Platform
          </motion.div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl font-black leading-tight mb-6 text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            <AnimatedHeadline text="Identify Venture Capital" />
            <span className="block mt-2">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                style={{
                  background: "linear-gradient(90deg, #d4af37, #f59e0b, #00d4ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Before They Go Digital
              </motion.span>
            </span>
          </h1>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="text-base text-white/45 max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Scrape four global registries — Companies House, GLEIF, SEC EDGAR, and ASIC —
            to surface active VC entities with no web presence and available .com domains.
          </motion.p>

          {/* CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm tracking-wide"
              style={{
                background: "linear-gradient(135deg, #d4af37, #f59e0b)",
                color: "#04080f",
                boxShadow: "0 0 32px rgba(212,175,55,0.35)",
              }}
            >
              Open Dashboard
              <ArrowRight size={16} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm tracking-wide border"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              View Results
            </motion.button>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            <div className="w-1 h-2 rounded-full bg-white/30" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-black text-white/90 mb-3">
            End-to-End Filtering Pipeline
          </h2>
          <p className="text-sm text-white/35">
            Every entity passes six automated checks before reaching your results.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Shield size={20} />}
            title="AI Press Validation"
            desc="GPT-4o Mini reviews news articles to separate genuine negative press from false positives — not just keyword matching."
            color="#22c55e"
            delay={0.1}
          />
          <FeatureCard
            icon={<Globe size={20} />}
            title="Domain Availability"
            desc="Checks .com, .co, and .co.uk in parallel via RDAP. Qualifies if any TLD is unregistered and available to purchase."
            color="#d4af37"
            delay={0.2}
          />
          <FeatureCard
            icon={<Zap size={20} />}
            title="Online Presence Check"
            desc="Verifies active websites, LinkedIn, and Twitter. Targets entities with no web footprint — the best cold outreach candidates."
            color="#00d4ff"
            delay={0.3}
          />
        </div>

        {/* Registry grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            { flag: "🇬🇧", name: "Companies House", sub: "UK Registry" },
            { flag: "🌐", name: "GLEIF",            sub: "Global LEI" },
            { flag: "🇺🇸", name: "SEC EDGAR",       sub: "Form D Filers" },
            { flag: "🇦🇺", name: "ASIC / ABN",      sub: "Australia" },
          ].map((r) => (
            <div
              key={r.name}
              className="rounded-xl p-4 border text-center"
              style={{
                background: "rgba(255,255,255,0.025)",
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <div className="text-2xl mb-2">{r.flag}</div>
              <div className="text-xs font-bold text-white/70">{r.name}</div>
              <div className="text-[10px] text-white/30 mt-0.5 tracking-wide">{r.sub}</div>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
