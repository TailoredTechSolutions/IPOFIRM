import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EntitySchema = z.object({
  legal_name: z.string().max(500),
  registry_id: z.string().max(200),
  registry_source: z.string().max(50),
  country: z.string().max(100),
  score: z.number().min(0).max(100).optional(),
  status: z.string().optional(),
  trading_name: z.string().max(500).optional(),
  company_type: z.string().optional(),
  jurisdiction: z.string().optional(),
  incorporation_date: z.string().optional(),
  website: z.string().optional(),
}).passthrough();

const CallbackSchema = z.object({
  job_id: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  entities: z.array(EntitySchema).max(1000).optional(),
  total_count: z.number().int().min(0).optional(),
  error_message: z.string().max(2000).optional().nullable()
}).transform((data) => ({
  ...data,
  job_id: data.job_id || data.jobId,
})).refine((data) => !!data.job_id, {
  message: "Either job_id or jobId is required"
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ============ SECURITY: Webhook Authentication ============
  // Validate webhook secret to prevent unauthorized data injection
  const webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
  const providedSecret = req.headers.get('X-Webhook-Token') || req.headers.get('x-webhook-token');
  
  if (!webhookSecret) {
    console.error('CRITICAL: N8N_WEBHOOK_TOKEN not configured - rejecting all requests');
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: webhook authentication not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  if (!providedSecret || providedSecret !== webhookSecret) {
    console.warn('Unauthorized webhook request - invalid or missing X-Webhook-Token');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing webhook token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log('Webhook authentication successful');

  try {
    const rawBody = await req.json();
    const validatedData = CallbackSchema.parse(rawBody);
    
    console.log(`[${validatedData.job_id}] Fast ACK: Received ${validatedData.entities?.length || 0} entities`);
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Store payload in inbox for async processing
    const { error: inboxError } = await supabaseClient
      .from('callback_inbox')
      .insert({
        job_id: validatedData.job_id,
        payload: rawBody,
        status: 'pending'
      });
    
    if (inboxError) {
      console.error(`[${validatedData.job_id}] Failed to store in inbox:`, inboxError);
      throw inboxError;
    }
    
    console.log(`[${validatedData.job_id}] ✅ Stored in inbox for processing`);
    
    // Trigger async processor in background (non-blocking)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      // Fire-and-forget: trigger processor without awaiting
      fetch(`${SUPABASE_URL}/functions/v1/process-callback-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => console.error('Failed to trigger processor:', err));
    }
    
    // Immediately return 202 Accepted (N8N gets response in <500ms)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Callback received and queued for processing',
        job_id: validatedData.job_id 
      }),
      { 
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in scrape-callback:', error);
    
    const message = error instanceof z.ZodError ? 'Invalid callback data' : 'Unable to process callback';
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
