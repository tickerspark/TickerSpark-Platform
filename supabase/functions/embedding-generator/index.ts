import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import * as postgres from "https://deno.land/x/postgres@v0.17.0/mod.ts";
console.log("Embedding generator function booted.");
// A standard Supabase client for simple operations like updates.
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
// Create a connection pool for direct database access.
// This is more efficient than creating a new connection for every invocation.
const pool = new postgres.Pool(Deno.env.get("SUPABASE_DB_URL"), 3, true);
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
async function generateEmbedding(text) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  // The 'cleanText' variable is gone, and we are now correctly using 'text' below.
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text // <-- This is the corrected line
    })
  });
  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`OpenAI API request failed: ${errorBody.error.message}`);
  }
  const { data } = await response.json();
  if (!data || data.length === 0) {
    throw new Error("OpenAI API returned no embedding data.");
  }
  return data[0].embedding;
}
serve(async (req)=>{
  // Security check is unchanged and correct.
  const expectedSecret = Deno.env.get("EMBEDDING_CRON_SECRET");
  const authorization = req.headers.get("Authorization");
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: corsHeaders
    });
  }
  // A connection will be acquired from the pool and released automatically.
  const connection = await pool.connect();
  try {
    // Step 1: Read messages directly from the 'pgmq' schema using a raw SQL query.
    // The database connection will respect the search_path we set for the service_role.
    const readResult = await connection.queryObject("SELECT * FROM pgmq.read('embedding_jobs', 45, 300)");
    const jobs = readResult.rows;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({
        message: "No jobs to process."
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Received ${jobs.length} embedding job(s) from the queue.`);
    const jobIdsToDelete = [];
    for (const job of jobs){
      const documentId = job.message.document_id;
      try {
        const { data: document, error: docError } = await supabaseAdmin.from("intelligent_documents").select("content").eq("id", documentId).single();
        if (docError || !document || !document.content) {
          console.warn(`Skipping job ${job.msg_id}: Could not fetch content for doc ${documentId}. Archiving job.`);
          jobIdsToDelete.push(job.msg_id);
          continue;
        }
        const embeddingVector = await generateEmbedding(document.content);
        const { error: updateError } = await supabaseAdmin.from("intelligent_documents").update({
          embedding: embeddingVector
        }).eq("id", documentId);
        if (updateError) throw updateError;
        jobIdsToDelete.push(job.msg_id);
        console.log(`Successfully processed and marked for deletion message ID: ${job.msg_id}`);
      } catch (processingError) {
        console.error(`Error processing message ${job.msg_id}:`, processingError.message);
      }
    }
    if (jobIdsToDelete.length > 0) {
      // Step 3: Delete the processed messages directly from the 'pgmq' schema.
      await connection.queryObject(`SELECT pgmq.delete('embedding_jobs', ARRAY[${jobIdsToDelete.join(',')}]::bigint[])`);
      console.log(`Successfully deleted ${jobIdsToDelete.length} message(s) from the queue.`);
    }
    return new Response(JSON.stringify({
      message: `Attempted to process ${jobs.length} jobs.`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally{
    // CRITICAL: Always release the connection back to the pool.
    connection.release();
  }
});