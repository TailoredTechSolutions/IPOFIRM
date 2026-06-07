import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CompaniesHouseCompany {
  company_number: string
  title: string
  company_status: string
  company_type: string
  date_of_creation: string
  address: {
    locality?: string
    postal_code?: string
    premises?: string
    address_line_1?: string
    address_line_2?: string
    country?: string
  }
  description?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { searchTerm, itemsPerPage = 100 } = await req.json();
    
    if (!searchTerm) {
      return new Response(
        JSON.stringify({ error: 'searchTerm is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');
    if (!apiKey) {
      throw new Error('COMPANIES_HOUSE_API_KEY not configured');
    }

    console.log(`Searching Companies House for: ${searchTerm}`);

    // Companies House uses Basic Auth with API key as username and empty password
    const basicAuth = btoa(`${apiKey}:`);
    
    const apiUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}&items_per_page=${itemsPerPage}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Companies House API error:', response.status, errorText);
      throw new Error(`Companies House API returned ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.items?.length || 0} companies`);

    // Transform the data to match our entity structure
    const entities = (data.items || []).map((company: CompaniesHouseCompany) => ({
      legal_name: company.title,
      registry_id: company.company_number,
      registry_source: 'COMPANIES_HOUSE',
      country: 'GB', // Companies House is UK only
      status: company.company_status,
      company_type: company.company_type,
      incorporation_date: company.date_of_creation,
      address: {
        locality: company.address.locality,
        postal_code: company.address.postal_code,
        premises: company.address.premises,
        address_line_1: company.address.address_line_1,
        address_line_2: company.address.address_line_2,
        country: company.address.country
      },
      description: company.description,
      raw_data: company
    }));

    // Store entities in callback_inbox for processing
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user ID from JWT
    let userId: string | null = null;
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch (e) {
      console.error('Failed to decode JWT:', e);
    }

    // Create a job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('scraping_jobs')
      .insert({
        source: 'COMPANIES_HOUSE',
        search_term: searchTerm,
        status: 'running',
        created_by: userId,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw jobError;
    }

    // Insert entities into callback_inbox for processing
    const { error: inboxError } = await supabaseAdmin
      .from('callback_inbox')
      .insert({
        job_id: job.id,
        payload: {
          jobId: job.id,
          source: 'COMPANIES_HOUSE',
          results: entities
        },
        status: 'pending'
      });

    if (inboxError) {
      console.error('Error creating inbox item:', inboxError);
      await supabaseAdmin
        .from('scraping_jobs')
        .update({ 
          status: 'failed', 
          error_message: 'Failed to queue results for processing',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
      throw inboxError;
    }

    // Update job status
    await supabaseAdmin
      .from('scraping_jobs')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // Trigger the processing function via HTTP fetch (more reliable than SDK invoke)
    const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-callback-inbox`;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (processUrl && serviceKey) {
      fetch(processUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      }).catch(err => console.error('Error triggering process-callback-inbox:', err));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: job.id,
        totalResults: entities.length,
        entities: entities.slice(0, 10) // Return first 10 for preview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-companies-house:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
