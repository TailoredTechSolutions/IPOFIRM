import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink, Globe, Newspaper, CheckCircle, XCircle } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { useEntities, type VCEntity } from "@/hooks/useScraper";

// ── Entity row ────────────────────────────────────────────────────────────────
function EntityRow({ entity, index }: { entity: VCEntity; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const byTld = (entity.domain_status as any)?.by_tld ?? {};

  const domainChips = [
    { tld: ".com",   avail: byTld["com"]?.available },
    { tld: ".co",    avail: byTld["co"]?.available  },
    { tld: ".co.uk", avail: byTld["co.uk"]?.available },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden border"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderColor:
          entity.filter_status === "qualified"
            ? "rgba(34,197,94,0.2)"
            : "rgba(255,255,255,0.06)",
      }}
    >
      {/* Row header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Registry pill */}
        <span
          className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded uppercase shrink-0"
          style={{
            background: "rgba(212,175,55,0.12)",
            color: "#d4af37",
            border: "1px solid rgba(212,175,55,0.2)",
          }}
        >
          {entity.registry_source}
        </span>

        {/* Name + country */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white/90 truncate">
            {entity.legal_name}
          </div>
          <div className="text-xs text-white/35 mt-0.5">
            {entity.country} · {entity.company_type}
          </div>
        </div>

        {/* Domain chips */}
        <div className="hidden md:flex gap-1 shrink-0">
          {domainChips.map((chip) => (
            <span
              key={chip.tld}
              className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
              style={{
                background:
                  chip.avail === true
                    ? "rgba(34,197,94,0.15)"
                    : chip.avail === false
                    ? "rgba(239,68,68,0.1)"
                    : "rgba(255,255,255,0.05)",
                color:
                  chip.avail === true
                    ? "#22c55e"
                    : chip.avail === false
                    ? "#ef4444"
                    : "#ffffff30",
              }}
            >
              {chip.tld}
            </span>
          ))}
        </div>

        <StatusBadge
          status={entity.filter_status as any}
          score={entity.filter_score}
        />

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-white/30 shrink-0"
        >
          <ChevronDown size={15} />
        </motion.div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4 border-t"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              {/* Checks */}
              <div className="md:col-span-1 space-y-2 pt-4">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  Filter Checks
                </div>
                {entity.passed_checks.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs text-green-400">
                    <CheckCircle size={11} />
                    {c}
                  </div>
                ))}
                {entity.failed_checks.map((c) => (
                  <div key={c} className="flex items-center gap-2 text-xs text-red-400">
                    <XCircle size={11} />
                    {c}
                  </div>
                ))}
              </div>

              {/* Domain detail */}
              <div className="pt-4 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  Domain Status
                </div>
                {domainChips.map((chip) => {
                  const detail = byTld[chip.tld.replace(".", "")] ?? byTld[chip.tld.slice(1)];
                  return (
                    <div key={chip.tld} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-white/60">{chip.tld}</span>
                      <span
                        className="font-semibold"
                        style={{
                          color:
                            chip.avail === true
                              ? "#22c55e"
                              : chip.avail === false
                              ? "#ef4444"
                              : "#ffffff40",
                        }}
                      >
                        {chip.avail === true
                          ? "Available"
                          : chip.avail === false
                          ? "Registered"
                          : "Unknown"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Presence + press */}
              <div className="pt-4 space-y-3">
                <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
                  Online Presence
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Globe size={11} className="text-white/40" />
                  <span className="text-white/50">Website:</span>
                  <span
                    className="font-semibold"
                    style={{
                      color: (entity.social_media_presence as any)?.website_active
                        ? "#ef4444"
                        : "#22c55e",
                    }}
                  >
                    {(entity.social_media_presence as any)?.website_active
                      ? "Active"
                      : "None"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Newspaper size={11} className="text-white/40" />
                  <span className="text-white/50">Press:</span>
                  <span
                    className="font-semibold"
                    style={{
                      color: (entity.news_mentions as any)?.has_negative_press
                        ? "#ef4444"
                        : "#22c55e",
                    }}
                  >
                    {(entity.news_mentions as any)?.has_negative_press
                      ? "Negative found"
                      : "Clean"}
                  </span>
                </div>
                {entity.ai_enhanced && (
                  <div
                    className="text-[10px] px-2 py-1 rounded-md inline-flex items-center gap-1"
                    style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff" }}
                  >
                    🤖 AI-validated
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function ResultsPanel() {
  const [tab, setTab] = useState<"qualified" | "rejected">("qualified");
  const { data: entities = [], isLoading } = useEntities(tab);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div
        className="inline-flex rounded-lg p-1"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        {(["qualified", "rejected"] as const).map((t) => (
          <motion.button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-xs font-semibold capitalize tracking-wide relative"
            style={{ color: tab === t ? "#04080f" : "rgba(255,255,255,0.4)" }}
          >
            {tab === t && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-md"
                style={{
                  background:
                    t === "qualified"
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : "linear-gradient(135deg,#ef4444,#dc2626)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            )}
            <span className="relative z-10">{t}</span>
          </motion.button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-7 h-7 rounded-full border-2 border-white/10 border-t-yellow-400"
          />
        </div>
      ) : entities.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 text-white/30 text-sm"
        >
          No {tab} entities yet.
          <br />
          <span className="text-xs">Launch a scrape to populate results.</span>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {entities.map((e, i) => (
            <EntityRow key={e.id} entity={e} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
