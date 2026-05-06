import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Registry = "CH" | "GLEIF" | "EDGAR" | "ASIC";

export interface ScraperJob {
  id: string;
  job_id: string;
  source: Registry;
  search_term: string;
  status: "pending" | "running" | "completed" | "failed";
  total_scraped: number;
  qualified_count: number;
  rejected_count: number;
  filter_summary: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface VCEntity {
  id: string;
  legal_name: string;
  registry_id: string;
  registry_source: Registry;
  country: string;
  jurisdiction: string;
  status: string;
  company_type: string;
  incorporation_date: string | null;
  address: Record<string, string>;
  filter_status: "qualified" | "rejected" | "pending";
  filter_score: number;
  filter_notes: string[];
  passed_checks: string[];
  failed_checks: string[];
  domain_status: Record<string, unknown>;
  news_mentions: Record<string, unknown>;
  social_media_presence: Record<string, unknown>;
  ai_enhanced: boolean;
  domain_summary?: string;
  created_at: string;
}

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL ?? "";

// ── Queries ───────────────────────────────────────────────────────────────────
export function useJobs() {
  return useQuery({
    queryKey: ["scrape_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrape_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ScraperJob[];
    },
    refetchInterval: 5000, // poll every 5s while jobs might be running
  });
}

export function useEntities(filterStatus?: "qualified" | "rejected") {
  return useQuery({
    queryKey: ["vc_entities", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("vc_entities")
        .select("*")
        .order("filter_score", { ascending: false })
        .limit(200);
      if (filterStatus) q = q.eq("filter_status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data as VCEntity[];
    },
    refetchInterval: 8000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useTriggerScrape() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(
    async (source: Registry, searchTerm: string) => {
      if (!N8N_WEBHOOK_URL) {
        setError("VITE_N8N_WEBHOOK_URL is not configured.");
        return;
      }

      setIsLoading(true);
      setError(null);

      const jobId = `${source}-${Date.now()}`;

      // Pre-create the job record so the UI shows it immediately
      await supabase.from("scrape_jobs").insert({
        job_id: jobId,
        source,
        search_term: searchTerm,
        status: "running",
        started_at: new Date().toISOString(),
      });

      try {
        const res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, searchTerm, jobId }),
        });
        if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
        await queryClient.invalidateQueries({ queryKey: ["scrape_jobs"] });
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        // Mark job as failed
        await supabase
          .from("scrape_jobs")
          .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
          .eq("job_id", jobId);
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient]
  );

  return { trigger, isLoading, error };
}
