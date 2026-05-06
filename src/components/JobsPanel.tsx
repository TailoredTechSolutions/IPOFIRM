import { motion } from "framer-motion";
import { Clock, CheckCircle, XCircle, Loader } from "lucide-react";
import { useJobs } from "@/hooks/useScraper";

const STATUS_ICON = {
  pending:   <Clock size={13} className="text-yellow-400" />,
  running:   <Loader size={13} className="text-cyan-400 animate-spin" />,
  completed: <CheckCircle size={13} className="text-green-400" />,
  failed:    <XCircle size={13} className="text-red-400" />,
};

export default function JobsPanel() {
  const { data: jobs = [], isLoading } = useJobs();

  if (isLoading) return (
    <div className="py-8 flex justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="w-5 h-5 rounded-full border-2 border-white/10 border-t-yellow-400"
      />
    </div>
  );

  if (jobs.length === 0) return (
    <p className="text-white/25 text-xs text-center py-8">No jobs run yet.</p>
  );

  return (
    <div className="space-y-2">
      {jobs.map((job, i) => (
        <motion.div
          key={job.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="px-4 py-3 rounded-xl border flex items-center gap-3"
          style={{
            background: "rgba(255,255,255,0.025)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          {STATUS_ICON[job.status] ?? STATUS_ICON.pending}

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/80 truncate">
              {job.search_term || "—"}
            </div>
            <div className="text-[10px] text-white/30 mt-0.5 font-mono">
              {job.source} · {new Date(job.created_at).toLocaleString()}
            </div>
          </div>

          {job.status === "completed" && (
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-green-400">{job.qualified_count} qualified</div>
              <div className="text-[10px] text-white/25">{job.rejected_count} rejected</div>
            </div>
          )}

          {job.status === "failed" && (
            <div className="text-xs text-red-400 max-w-[100px] truncate text-right">
              {job.error_message || "Error"}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
