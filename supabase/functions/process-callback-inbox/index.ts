import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const COMPANIES_HOUSE_API_KEY = Deno.env.get('COMPANIES_HOUSE_API_KEY');

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|llc|corp|corporation|plc|co|company|group|holdings)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateCandidateDomains(name: string): string[] {
  const normalized = normalizeCompany(name);
  const words = normalized.split(' ').filter(w => w.length > 0);
  
  const domains = [];
  
  // Only use first word for speed (most common pattern)
  if (words.length > 0) {
    domains.push(words[0]);
  }
  
  // Full name as fallback
  if (words.length > 1) {
    domains.push(words.join(''));
  }
  
  return [...new Set(domains)];
}

async function checkWebsiteExistsStrict(companyName: string): Promise<{
  exists: boolean;
  url?: string;
  domain?: string;
  similarityScore?: number;
}> {
  try {
    const candidates = generateCandidateDomains(companyName);
    
    // Only check first candidate with .com for speed
    for (const candidate of candidates.slice(0, 1)) {
      const domain = `${candidate}.com`;
      const url = `https://${domain}`;
      
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(1000), // Ultra-fast 1s timeout
        });
        
        if (response.ok) {
          console.log(`Found website: ${url}`);
          return {
            exists: true,
            url,
            domain: candidate,
            similarityScore: 1.0,
          };
        }
      } catch {
        // Continue to next candidate
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking website:', error);
    return { exists: false };
  }
}

async function checkCompanyActive(companyName: string): Promise<{
  active: boolean;
  source: string;
  note?: string;
  matches?: any[];
}> {
  if (!COMPANIES_HOUSE_API_KEY) {
    console.warn(`checkCompanyActive: No API key configured — skipping active check for "${companyName}"`);
    return { active: true, source: 'unknown', note: 'No API key configured — check skipped, entity passed by default' };
  }
  
  try {
    const searchUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(companyName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': COMPANIES_HOUSE_API_KEY,
      },
      signal: AbortSignal.timeout(2000), // Fast 2s timeout
    });
    
    if (!response.ok) {
      console.error(`checkCompanyActive: Companies House API returned ${response.status} for "${companyName}" — failing closed`);
      return { active: false, source: 'companies_house', note: `API returned HTTP ${response.status} — could not verify active status` };
    }
    
    const data = await response.json();
    const companies = data.items || [];
    
    if (companies.length === 0) {
      console.log(`checkCompanyActive: No matches found for "${companyName}" in Companies House — failing closed`);
      return { active: false, source: 'companies_house', note: 'No matching company found in registry' };
    }
    
    // Check if any match is active
    const normalizedSearch = normalizeCompany(companyName);
    const exactMatch = companies.find((c: any) => 
      normalizeCompany(c.title) === normalizedSearch
    );
    
    if (exactMatch) {
      const isActive = (exactMatch.company_status || '').toLowerCase() === 'active';
      return {
        active: isActive,
        source: 'companies_house',
        matches: [exactMatch],
      };
    }
    
    // If no exact match, check if any similar company is active
    const anyActive = companies.some((c: any) => 
      (c.company_status || '').toLowerCase() === 'active'
    );
    
    return {
      active: anyActive,
      source: 'companies_house',
      note: 'No exact match, found similar companies',
      matches: companies.slice(0, 3),
    };
  } catch (error) {
    console.error(`checkCompanyActive: Error checking "${companyName}":`, error);
    return { active: false, source: 'companies_house', note: `Error during check: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

function calculateEntityScore(entity: any): number {
  let score = 0;
  
  const fields = [
    entity.legal_name,
    entity.registry_id,
    entity.country,
    entity.status,
    entity.incorporation_date,
    entity.company_type,
    entity.jurisdiction,
    entity.address,
    entity.website,
    entity.officers,
    entity.psc,
  ];
  const filledFields = fields.filter(f => f && (Array.isArray(f) ? f.length > 0 : true)).length;
  score += (filledFields / fields.length) * 40;
  
  const status = (entity.status || '').toLowerCase();
  if (status === 'active') score += 25;
  else if (status === 'inactive') score += 10;
  else if (status === 'dissolved') score += 0;
  else score += 5;
  
  if (entity.website) score += 20;
  else if (entity.raw_payload?.api_response?.links) score += 10;
  
  if (entity.incorporation_date) {
    const incDate = new Date(entity.incorporation_date);
    const yearsOld = (Date.now() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsOld < 2) score += 15;
    else if (yearsOld < 5) score += 10;
    else if (yearsOld < 10) score += 5;
  }
  
  return Math.min(Math.max(Math.round(score), 0), 100);
}

async function processInboxItem(inboxId: string, supabaseClient: any) {
  console.log(`\n[${inboxId}] ===== Processing inbox item =====`);
  
  try {
    // Fetch inbox item
    const { data: inboxItem, error: fetchError } = await supabaseClient
      .from('callback_inbox')
      .select('*')
      .eq('id', inboxId)
      .single();
    
    if (fetchError || !inboxItem) {
      throw new Error(`Failed to fetch inbox item: ${fetchError?.message}`);
    }
    
    // Mark as processing
    await supabaseClient
      .from('callback_inbox')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', inboxId);
    
    const payload = inboxItem.payload;
    const jobId = payload.job_id || payload.jobId;
    const entities = payload.entities || [];
    
    console.log(`[${inboxId}] Job ${jobId}: Processing ${entities.length} entities`);
    
    // Load suppression list
    const { data: suppressionData } = await supabaseClient
      .from('suppression_list')
      .select('canonical_name');
    
    const suppressedNames = new Set(
      (suppressionData || []).map((s: any) => s.canonical_name)
    );
    console.log(`[${inboxId}] Loaded ${suppressedNames.size} suppressed companies`);
    
    const strictFilteredEntities = [];
    const rejectedEntities = [];

    // Process entities with tight per-entity timeout
    for (const entity of entities) {
      const entityCanonical = normalizeCompany(entity.legal_name);
      
      // Check suppression list
      if (suppressedNames.has(entityCanonical)) {
        console.log(`  ❌ ${entity.legal_name}: suppressed`);
        rejectedEntities.push({ entity: entity.legal_name, reason: 'suppressed' });
        
        await supabaseClient.from('filtering_audit').insert({
          company_name: entity.legal_name,
          scraping_job_id: jobId,
          filter_type: 'suppressed',
          blocked: true,
          decision_details: { canonical: entityCanonical }
        });
        
        continue;
      }
      
      // Check website (tight timeout)
      const websiteCheck = await checkWebsiteExistsStrict(entity.legal_name);
      
      if (!websiteCheck.exists) {
        console.log(`  ❌ ${entity.legal_name}: no website`);
        rejectedEntities.push({ entity: entity.legal_name, reason: 'no_website' });
        
        await supabaseClient.from('filtering_audit').insert({
          company_name: entity.legal_name,
          scraping_job_id: jobId,
          filter_type: 'no_website',
          blocked: true,
          decision_details: websiteCheck
        });
        
        continue;
      }

      // Check company active status
      const activeCheck = await checkCompanyActive(entity.legal_name);
      
      if (!activeCheck.active) {
        console.log(`  ❌ ${entity.legal_name}: inactive`);
        rejectedEntities.push({ entity: entity.legal_name, reason: 'inactive' });
        
        await supabaseClient.from('filtering_audit').insert({
          company_name: entity.legal_name,
          scraping_job_id: jobId,
          filter_type: 'inactive',
          blocked: true,
          decision_details: activeCheck
        });
        
        continue;
      }

      // All checks passed
      console.log(`  ✅ ${entity.legal_name}: passed`);
      entity.website = websiteCheck.url;
      entity.web_presence_score = websiteCheck.similarityScore;
      
      await supabaseClient.from('filtering_audit').insert({
        company_name: entity.legal_name,
        scraping_job_id: jobId,
        filter_type: 'passed',
        blocked: false,
        decision_details: {
          website: websiteCheck.url,
          webPresenceScore: websiteCheck.similarityScore
        }
      });
      
      strictFilteredEntities.push(entity);
    }

    console.log(`[${inboxId}] Filtering complete: ${strictFilteredEntities.length}/${entities.length} passed`);
    
    // Update job status
    await supabaseClient
      .from('scraping_jobs')
      .update({
        status: payload.status,
        records_fetched: payload.total_count || 0,
        records_processed: strictFilteredEntities.length,
        error_message: payload.error_message,
        completed_at: payload.status === 'completed' || payload.status === 'failed' 
          ? new Date().toISOString() 
          : null
      })
      .eq('id', jobId);

    // Insert entities if any passed
    if (strictFilteredEntities.length > 0) {
      // Check for existing duplicates
      const { data: existingEntities } = await supabaseClient
        .from('entities')
        .select('id, legal_name, registry_id');
      
      const existingCanonicalSet = new Set(
        (existingEntities || []).map((e: any) => normalizeCompany(e.legal_name))
      );
      
      const existingRegistryIds = new Set(
        (existingEntities || []).map((e: any) => e.registry_id)
      );
      
      // Filter out duplicates
      const uniqueEntities = strictFilteredEntities.filter((e: any) => {
        const canonical = normalizeCompany(e.legal_name);
        if (existingCanonicalSet.has(canonical)) {
          console.log(`  🗑️ Skipping duplicate: ${e.legal_name}`);
          return false;
        }
        if (existingRegistryIds.has(e.registry_id)) {
          console.log(`  🗑️ Skipping duplicate by registry ID: ${e.legal_name}`);
          return false;
        }
        return true;
      });
      
      console.log(`[${inboxId}] Upserting ${uniqueEntities.length} unique entities`);
      
      if (uniqueEntities.length > 0) {
        const { error: entitiesError } = await supabaseClient
          .from('entities')
          .upsert(uniqueEntities.map((e: any) => ({
            ...e,
            score: calculateEntityScore(e)
          })), { onConflict: 'registry_id,registry_source' });

        if (entitiesError) {
          console.error(`[${inboxId}] Error upserting entities:`, entitiesError);
          throw entitiesError;
        }
      }
    }
    
    // Mark inbox item as completed
    await supabaseClient
      .from('callback_inbox')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', inboxId);
    
    console.log(`[${inboxId}] ===== Processing complete =====\n`);
    
    return { success: true, processed: strictFilteredEntities.length };
  } catch (error) {
    console.error(`[${inboxId}] Processing error:`, error);
    
    // Mark as failed
    await supabaseClient
      .from('callback_inbox')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', inboxId);
    
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Fetch all pending inbox items
    const { data: pendingItems, error: fetchError } = await supabaseClient
      .from('callback_inbox')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process up to 10 at a time
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`Found ${pendingItems?.length || 0} pending inbox items`);
    
    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items to process' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Process each item
    const results = [];
    for (const item of pendingItems) {
      const result = await processInboxItem(item.id, supabaseClient);
      results.push({ id: item.id, ...result });
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-callback-inbox:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});