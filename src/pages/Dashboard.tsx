import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Search, History, ChevronRight } from "lucide-react";
import AnimatedStat from "@/components/AnimatedStat";
import RegistrySelector from "@/components/RegistrySelector";
import ResultsPanel from "@/components/ResultsPanel";
import JobsPanel from "@/components/JobsPanel";
import { useEntities, useJobs } from "@/hooks/useScraper";

// ── Sidebar nav ───────────────────────────────────────────────────────────────
const NAV = [
  { id: "scrape",   label: "Scrape",   icon: <Search size={16} />        },
  { id: "results",  label: "Results",  icon: <LayoutDashboard size={16} />},
  { id: "history",  label: "History",  icon: <History size={16} />        },
];

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const { data: qualified = [] } = useEntities("qualified");
  const { data: rejected  = [] } = useEntities("rejected");
  const { data: jobs      = [] } = useJobs();

  const total = qualified.length + rejected.length;
  const rate  = total > 0 ? Math.round((qualified.length / total) * 100) : 0;
  const running = jobs.filter((j) => j.status === "running").length;

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-px"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      {[
        { value: qualified.length, label: "Qualified",  suffix: "",  color: "#22c55e", delay: 0    },
        { value: rejected.length,  label: "Rejected",   suffix: "",  color: "#ef4444", delay: 0.1  },
        { value: rate,             label: "Pass Rate",  suffix: "%", color: "#d4af37", delay: 0.2  },
        { value: running,          label: "Active Jobs", suffix: "", color: "#00d4ff", delay: 0.3  },
      ].map((s) => (
        <div
          key={s.label}
          className="flex items-center justify-center py-5"
          style={{ background: "#04080f" }}
        >
          <AnimatedStat {...s} />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState("scrape");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "#04080f",
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(212,175,55,0.12)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black"
            style={{ background: "linear-gradient(135deg,#d4af37,#f59e0b)", color: "#04080f" }}
          >
            I
          </div>
          <div>
            <span className="font-bold text-white/90 text-sm tracking-wide">IPO Firm</span>
            <span className="text-white/25 text-sm"> · VC Intelligence</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <motion.button
              key={n.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActive(n.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all"
              style={{
                background: active === n.id ? "rgba(212,175,55,0.1)" : "transparent",
                color: active === n.id ? "#d4af37" : "rgba(255,255,255,0.35)",
                border: active === n.id ? "1px solid rgba(212,175,55,0.25)" : "1px solid transparent",
              }}
            >
              {n.icon}
              {n.label}
            </motion.button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e80" }}
          />
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Live</span>
        </div>
      </motion.header>

      {/* Stats */}
      <StatsBar />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (mobile nav) */}
        <aside
          className="hidden lg:flex flex-col w-16 border-r py-4 items-center gap-2"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {NAV.map((n) => (
            <motion.button
              key={n.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActive(n.id)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              title={n.label}
              style={{
                background: active === n.id ? "rgba(212,175,55,0.15)" : "transparent",
                color: active === n.id ? "#d4af37" : "rgba(255,255,255,0.25)",
              }}
            >
              {n.icon}
            </motion.button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
            {/* Section header */}
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <div className="text-white/20 text-xs flex items-center gap-1.5">
                Dashboard
                <ChevronRight size={11} />
                <span className="text-white/60 capitalize font-semibold">{active}</span>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {active === "scrape" && (
                <motion.div
                  key="scrape"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {/* Scraper card */}
                  <div
                    className="rounded-2xl p-6 border"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      borderColor: "rgba(212,175,55,0.12)",
                    }}
                  >
                    <h2 className="text-sm font-bold text-white/80 mb-1 tracking-wide">
                      Registry Scraper
                    </h2>
                    <p className="text-xs text-white/30 mb-6">
                      Select a registry and enter a search term to discover qualified VC entities.
                    </p>
                    <RegistrySelector />
                  </div>

                  {/* Filter criteria card */}
                  <div
                    className="rounded-2xl p-6 border"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      borderColor: "rgba(0,212,255,0.1)",
                    }}
                  >
                    <h2 className="text-sm font-bold text-white/80 mb-1 tracking-wide">
                      Qualification Criteria
                    </h2>
                    <p className="text-xs text-white/30 mb-5">
                      Applied uniformly across all four registries.
                    </p>
                    <div className="space-y-3">
                      {[
                        { label: "Active company status",          color: "#22c55e" },
                        { label: ".com / .co / .co.uk available",  color: "#d4af37" },
                        { label: "No negative press (AI-checked)", color: "#d4af37" },
                        { label: "No active website",              color: "#00d4ff" },
                        { label: "No social media presence",       color: "#00d4ff" },
                        { label: "Low web footprint (<50 results)",color: "#00d4ff" },
                      ].map((c, i) => (
                        <motion.div
                          key={c.label}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="flex items-center gap-3 text-xs"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: c.color, boxShadow: `0 0 6px ${c.color}60` }}
                          />
                          <span className="text-white/55">{c.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {active === "results" && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <ResultsPanel />
                </motion.div>
              )}

              {active === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className="rounded-2xl p-6 border"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      borderColor: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <h2 className="text-sm font-bold text-white/80 mb-1">Job History</h2>
                    <p className="text-xs text-white/30 mb-5">
                      All scraping runs. Auto-refreshes every 5 seconds.
                    </p>
                    <JobsPanel />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
