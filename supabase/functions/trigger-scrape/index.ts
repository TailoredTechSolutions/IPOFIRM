import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TriggerScrapeSchema = z.object({
  source: z.enum(['COMPANIES_HOUSE', 'CH', 'GLEIF', 'SEC_EDGAR', 'ASIC']),
  searchTerm: z.string().max(500).optional(),
  filters: z.record(z.unknown()).optional()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT is verified by platform - extract user ID from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user ID from JWT token (format: "Bearer <token>")
    let userId: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      console.log('User authenticated:', userId);
    } catch (e) {
      console.error('Failed to decode JWT:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const rawBody = await req.json();
    let { source, searchTerm, filters } = TriggerScrapeSchema.parse(rawBody);
    
    // Keep original source for external workflows, normalize for internal storage
    const originalSource = source;
    const normalizedSource = source === 'CH' ? 'COMPANIES_HOUSE' : source;
    if (!searchTerm && originalSource === 'CH') {
      // Sensible default aligning with Companies House example query
      searchTerm = 'venture capital';
    }
    
    console.log('Creating scraping job', userId ? `for user: ${userId}` : '(no auth)', { originalSource, normalizedSource, searchTerm });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create a job record with optional user tracking
    const { data: job, error: jobError } = await supabaseAdmin
      .from('scraping_jobs')
      .insert({
        source: normalizedSource,
        search_term: searchTerm,
        filters,
        status: 'pending',
        created_by: userId,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    console.log('Job created:', job.id);

    // Call N8N webhook with retry logic and proper timeout
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      throw new Error('N8N_WEBHOOK_URL environment variable not configured');
    }
    const webhookToken = Deno.env.get('N8N_WEBHOOK_TOKEN'); // Optional auth token
    
    const MAX_RETRIES = 3;
    // Supabase Edge Functions have a 300s (5 minute) hard execution limit.
    // We set timeout to 270s to leave 30s buffer for DB operations and response.
    const TIMEOUT_MS = 270000; // 4.5 minutes (buffer below Supabase's 300s limit)
    let lastError: string = '';
    let webhookSuccess = false;

    console.log(`Calling n8n webhook: ${n8nWebhookUrl}`);

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': job.id, // Prevent duplicate processing in n8n
        };
        
        // Add optional webhook authentication
        if (webhookToken) {
          headers['X-Webhook-Token'] = webhookToken;
        }

        const webhookPayload = {
          jobId: job.id,
          source: originalSource, // short code for n8n compatibility (e.g., 'CH')
          registrySource: normalizedSource, // normalized for clarity (e.g., 'COMPANIES_HOUSE')
          searchTerm,
          filters,
          callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/scrape-callback`
        };

        console.log(`Attempt ${attempt}/${MAX_RETRIES} - Payload:`, JSON.stringify(webhookPayload, null, 2));

        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(webhookPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const statusCode = response.status;
        const responseBody = await response.text();

        if (response.ok) {
          console.log(`✅ N8N webhook success (attempt ${attempt}): ${statusCode} - ${responseBody.substring(0, 200)}`);
          webhookSuccess = true;
          
          await supabaseAdmin
            .from('scraping_jobs')
            .update({ status: 'running' })
            .eq('id', job.id);
          
          break; // Success, exit retry loop
        } else {
          lastError = `HTTP ${statusCode}: ${responseBody.substring(0, 500)}`;
          console.error(`❌ N8N webhook failed (attempt ${attempt}): ${lastError}`);
          
          // Don't retry on 4xx client errors (except 429 rate limit)
          if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
            console.log('Client error detected, not retrying');
            break;
          }
          
          // Retry on 5xx server errors or 429 rate limit
          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000); // 2s, 4s, 8s (max 30s)
            console.log(`Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      } catch (webhookError) {
        clearTimeout(timeoutId);

        const isTimeout = webhookError instanceof Error && webhookError.name === 'AbortError';
        const errorMsg = isTimeout
          ? `Timeout after ${TIMEOUT_MS}ms (${TIMEOUT_MS / 1000}s) - n8n workflow did not respond in time`
          : webhookError instanceof Error ? webhookError.message : 'Unknown error';
        
        lastError = errorMsg;
        console.error(`❌ Webhook error (attempt ${attempt}/${MAX_RETRIES}):`, errorMsg);

        // Retry on timeout or network errors
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
          console.log(`Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Update job status based on final result
    if (!webhookSuccess) {
      console.error(`🔴 All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`);
      await supabaseAdmin
        .from('scraping_jobs')
        .update({
          status: 'failed',
          error_message: `N8N webhook failed after ${MAX_RETRIES} attempts: ${lastError}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
    }

    return new Response(
      JSON.stringify({ 
        success: webhookSuccess, 
        jobId: job.id,
        status: webhookSuccess ? 'running' : 'failed',
        error: webhookSuccess ? null : `N8N webhook failed after ${MAX_RETRIES} attempts: ${lastError}`
      }),
      { status: webhookSuccess ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in trigger-scrape:', error);
    
    let statusCode = 400;
    let message = 'Invalid request data';
    
    if (error instanceof z.ZodError) {
      message = 'Invalid request data';
    } else if (error instanceof Error && error.message.includes('auth')) {
      statusCode = 401;
      message = 'Authentication required';
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
