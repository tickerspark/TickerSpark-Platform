import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const contentTypeMapping = {
  "trendingStockBrief": {},
  "premiumReport": {},
  "weeklyEarningsPreview": {},
  "macroUpdate": {},
  "macroRecap": {},
  "macroPreview": {},
  "earningsRecapWeekly": {},
  "earningsPreviewWeekly": {},
  "earningsArticle": {}
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const expectedSecret = Deno.env.get("BACKFILL_SECRET");
    const receivedSecret = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders
      });
    }
    const { skip = 0, limit = 50 } = await req.json();
    const spaceId = Deno.env.get("CONTENTFUL_SPACE_ID");
    const accessToken = Deno.env.get("CONTENTFUL_DELIVERY_API_KEY");
    const environment = Deno.env.get("CONTENTFUL_ENVIRONMENT") || "master";
    if (!spaceId || !accessToken) {
      throw new Error("Contentful credentials are not set in environment variables.");
    }
    const contentfulTypes = Object.keys(contentTypeMapping).join(',');
    // *** THE FIX IS HERE ***
    // We add `&select=sys.id,sys.publishedAt,sys.updatedAt` to the URL.
    // This tells Contentful to ONLY send back these three essential system fields,
    // ignoring all the large content fields.
    const contentfulUrl = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environment}/entries?limit=${limit}&skip=${skip}&sys.contentType.sys.id[in]=${contentfulTypes}&order=sys.createdAt&select=sys.id,sys.publishedAt,sys.updatedAt`;
    const contentfulResponse = await fetch(contentfulUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!contentfulResponse.ok) {
      const errorBody = await contentfulResponse.text();
      throw new Error(`Failed to fetch from Contentful: ${contentfulResponse.statusText}. Response: ${errorBody}`);
    }
    const { items } = await contentfulResponse.json();
    if (!items) throw new Error("Contentful response did not contain 'items' array.");
    const updatePromises = items.map((entry)=>{
      const contentfulId = entry.sys.id;
      const publishDate = entry.sys.publishedAt ?? entry.sys.updatedAt;
      if (!publishDate) {
        console.warn(`-> Skipping ${contentfulId}, no publish date found.`);
        return Promise.resolve();
      }
      return supabaseClient.rpc('backfill_publication_date', {
        p_source_id: contentfulId,
        p_new_date: publishDate
      });
    });
    await Promise.all(updatePromises);
    const processedCount = items.length;
    const nextSkip = skip + processedCount;
    console.log(`Successfully processed batch of ${processedCount} articles. Next skip: ${nextSkip}`);
    return new Response(JSON.stringify({
      processed: processedCount,
      next_skip: nextSkip,
      message: `Batch complete. If processed > 0, run again with the next_skip value.`
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error(`Error in date backfill: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
