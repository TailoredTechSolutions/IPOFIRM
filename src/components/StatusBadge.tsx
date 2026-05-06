import { motion } from "framer-motion";

type Status = "qualified" | "rejected" | "pending" | "running";

const CONFIG: Record<Status, { label: string; color: string; bg: string; pulse: boolean }> = {
  qualified: { label: "Qualified",  color: "#22c55e", bg: "rgba(34,197,94,0.12)",   pulse: false },
  rejected:  { label: "Rejected",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",    pulse: false },
  pending:   { label: "Pending",    color: "#d4af37", bg: "rgba(212,175,55,0.12)",   pulse: false },
  running:   { label: "Running…",  color: "#00d4ff", bg: "rgba(0,212,255,0.12)",    pulse: true  },
};

interface StatusBadgeProps {
  status: Status;
  score?: number;
}

export default function StatusBadge({ status, score }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.pending;

  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
    >
      {/* Indicator dot */}
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="rounded-full inline-flex h-full w-full"
          style={{ background: cfg.color }}
        />
        {cfg.pulse && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: cfg.color }}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </span>
      {cfg.label}
      {score !== undefined && (
        <span className="ml-0.5 opacity-70">· {score}%</span>
      )}
    </motion.span>
  );
}
