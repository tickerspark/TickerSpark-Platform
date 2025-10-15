import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import "https://deno.land/x/xhr@0.3.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
// Helper functions are correct and unchanged
function extractTextFromRichText(richTextNode) {
  if (!richTextNode || !richTextNode.content) return "";
  let text = "";
  for (const node of richTextNode.content){
    if (node.nodeType === 'text' && node.value) {
      text += node.value;
    } else if (node.content) {
      text += extractTextFromRichText(node) + (node.nodeType === 'paragraph' ? '\n\n' : '');
    }
  }
  return text.trim();
}
function chunkText(text, minChunkSize = 500, maxChunkSize = 2000) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const paragraphs = text.split(/\n\s*\n/).filter((p)=>p.trim().length > 0);
  const chunks = [];
  let currentChunk = "";
  for (const paragraph of paragraphs){
    if (paragraph.length > maxChunkSize) {
      if (currentChunk.length > 0) chunks.push(currentChunk);
      currentChunk = "";
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [
        paragraph
      ];
      let sentenceChunk = "";
      for (const sentence of sentences){
        if (sentenceChunk.length + sentence.length > maxChunkSize) {
          chunks.push(sentenceChunk);
          sentenceChunk = "";
        }
        sentenceChunk += sentence;
      }
      if (sentenceChunk.length > 0) chunks.push(sentenceChunk);
      continue;
    }
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      if (currentChunk.length > minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
    }
    currentChunk += (currentChunk.length > 0 ? "\n\n" : "") + paragraph;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}
const contentTypeMapping = {
  "trendingStockBrief": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      ticker: "tickerSymbol",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "premiumReport": {
    bodyField: "reportBody",
    metadataFields: {
      title: "reportTitle",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "weeklyEarningsPreview": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      ticker: "tickerSymbol",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "macroUpdate": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "macroRecap": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "macroPreview": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "earningsRecapWeekly": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      ticker: "tickerSymbol",
      tickers: "tickers",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "earningsPreviewWeekly": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      ticker: "tickerSymbol",
      tickers: "tickers",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  },
  "earningsArticle": {
    bodyField: "briefBody",
    metadataFields: {
      title: "briefTitle",
      ticker: "tickerSymbol",
      publicationDate: "publicationDate",
      accessLevel: "accessLevel"
    }
  }
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
    const { skip = 0, limit = 25 } = await req.json();
    const spaceId = Deno.env.get("CONTENTFUL_SPACE_ID");
    const accessToken = Deno.env.get("CONTENTFUL_DELIVERY_API_KEY");
    const environment = Deno.env.get("CONTENTFUL_ENVIRONMENT") || "master";
    if (!spaceId || !accessToken) {
      throw new Error("Contentful credentials are not set.");
    }
    const contentfulTypes = Object.keys(contentTypeMapping).join(',');
    const contentfulUrl = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environment}/entries?limit=${limit}&skip=${skip}&sys.contentType.sys.id[in]=${contentfulTypes}&order=sys.createdAt`;
    const contentfulResponse = await fetch(contentfulUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    if (!contentfulResponse.ok) {
      const errorText = await contentfulResponse.text();
      throw new Error(`Failed to fetch from Contentful: ${contentfulResponse.statusText}. Response: ${errorText}`);
    }
    const articles = await contentfulResponse.json();
    if (!articles.items) throw new Error("Contentful response did not contain 'items' array.");
    let allDocumentsToInsert = [];
    const entryIdsInBatch = [];
    for (const entry of articles.items){
      const entryId = entry.sys.id;
      const contentTypeId = entry.sys.contentType.sys.id;
      const mapping = contentTypeMapping[contentTypeId];
      if (!mapping) {
        console.warn(`Skipping entry ${entryId}: No mapping found for content type ${contentTypeId}`);
        continue;
      }
      const getField = (fieldName)=>{
        if (!fieldName || !entry.fields[fieldName]) return undefined;
        return entry.fields[fieldName]['en-US'] || entry.fields[fieldName];
      };
      const rawContent = getField(mapping.bodyField);
      if (!rawContent) {
        console.warn(`Skipping entry ${entryId}: No content found in body field '${mapping.bodyField}'`);
        continue;
      }
      entryIdsInBatch.push(entryId);
      const fullText = extractTextFromRichText(rawContent);
      const chunks = chunkText(fullText);
      // 1. Get the authoritative publish date for the entire entry from its system metadata.
      const authoritativePublishDate = entry.sys.publishedAt ?? entry.sys.updatedAt;
      const documentsForEntry = chunks.map((chunk, index)=>{
        const title = getField(mapping.metadataFields.title);
        const ticker = getField(mapping.metadataFields.ticker);
        let enrichedChunk = "";
        if (title) enrichedChunk += `Title: ${title}\n`;
        if (ticker) enrichedChunk += `Ticker: ${ticker}\n`;
        if (contentTypeId) enrichedChunk += `Article Type: ${contentTypeId}\n\n`;
        enrichedChunk += chunk;
        return {
          content: enrichedChunk,
          document_type: 'external_article',
          // 2. Add the top-level `published_at` field for the new column.
          published_at: authoritativePublishDate,
          source: {
            source_type: 'contentful',
            source_id: entryId
          },
          metadata: {
            title: title,
            ticker: ticker,
            tickers: getField(mapping.metadataFields.tickers),
            // 3. Update the metadata field to use the correct date.
            publicationDate: authoritativePublishDate,
            accessLevel: getField(mapping.metadataFields.accessLevel),
            chunk_index: index + 1,
            total_chunks: chunks.length,
            content_type_id: contentTypeId
          },
          owner_id: Deno.env.get("DEFAULT_OWNER_ID")
        };
      });
      allDocumentsToInsert.push(...documentsForEntry);
    }
    if (allDocumentsToInsert.length > 0) {
      // First, delete all old chunks for the entries in this batch.
      await supabaseClient.rpc('delete_multiple_documents_by_source_id', {
        p_source_ids: entryIdsInBatch
      });
      // Then, insert the new, corrected chunks.
      const { error } = await supabaseClient.from("intelligent_documents").insert(allDocumentsToInsert);
      if (error) throw new Error(`Supabase insert error: ${error.message}`);
    }
    const processedCount = articles.items.length;
    const nextSkip = skip + processedCount;
    console.log(`Successfully processed batch of ${processedCount} articles. Total documents inserted: ${allDocumentsToInsert.length}. Next skip: ${nextSkip}`);
    return new Response(JSON.stringify({
      processed: processedCount,
      inserted_chunks: allDocumentsToInsert.length,
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
    console.error(`Error processing backfill: ${error.message}`);
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