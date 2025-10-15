import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import "https://deno.land/x/xhr@0.3.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
function extractTextFromRichText(richTextNode) {
  if (!richTextNode || !richTextNode.content) {
    return "";
  }
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
  if (typeof text !== 'string' || text.length === 0) {
    return [];
  }
  const paragraphs = text.split(/\n\s*\n/).filter((p)=>p.trim().length > 0);
  const chunks = [];
  let currentChunk = "";
  for (const paragraph of paragraphs){
    if (paragraph.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
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
      if (sentenceChunk.length > 0) {
        chunks.push(sentenceChunk);
      }
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
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
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
    const expectedSecret = Deno.env.get("CONTENTFUL_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-contentful-webhook-secret");
    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders
      });
    }
    const eventType = req.headers.get("X-Contentful-Topic");
    const payload = await req.json();
    const entryId = payload.sys.id;
    const contentTypeId = payload.sys.contentType.sys.id;
    const isDeleteEvent = eventType === "ContentManagement.Entry.unpublish" || eventType === "ContentManagement.Entry.archive" || eventType === "ContentManagement.Entry.delete";
    if (isDeleteEvent) {
      const { data, error } = await supabaseClient.rpc('delete_documents_by_source_id', {
        p_source_id: entryId
      });
      if (error) throw error;
      console.log(`Processed ${eventType} for entry ${entryId}. RPC deleted ${data} row(s).`);
      return new Response(JSON.stringify({
        success: true,
        action: "deleted",
        deletedCount: data
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    const isPublishEvent = eventType === "ContentManagement.Entry.publish" || eventType === "ContentManagement.Entry.create";
    if (isPublishEvent) {
      const mapping = contentTypeMapping[contentTypeId];
      if (!mapping) {
        return new Response(JSON.stringify({
          success: true,
          action: "skipped",
          reason: `Content type '${contentTypeId}' not in config`
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
      const { error: deleteError } = await supabaseClient.rpc('delete_documents_by_source_id', {
        p_source_id: entryId
      });
      if (deleteError) {
        console.warn(`Could not delete old chunks for entry ${entryId}, may result in duplicates:`, deleteError.message);
      }
      const rawContent = payload.fields[mapping.bodyField]?.['en-US'];
      if (!rawContent) {
        return new Response(JSON.stringify({
          success: true,
          action: "skipped",
          reason: `no content in field '${mapping.bodyField}'`
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
      const fullText = extractTextFromRichText(rawContent);
      const chunks = chunkText(fullText);
      const documentsToInsert = chunks.map((chunk, index)=>{
        const getMeta = (fieldName)=>fieldName ? payload.fields[fieldName]?.['en-US'] : undefined;
        const title = getMeta(mapping.metadataFields.title);
        const ticker = getMeta(mapping.metadataFields.ticker);
        const authoritativePublishDate = payload.sys.publishedAt ?? payload.sys.updatedAt;
        let enrichedChunk = "";
        if (title) enrichedChunk += `Title: ${title}\n`;
        if (ticker) enrichedChunk += `Ticker: ${ticker}\n`;
        if (contentTypeId) enrichedChunk += `Article Type: ${contentTypeId}\n\n`;
        enrichedChunk += chunk;
        return {
          content: enrichedChunk,
          document_type: 'external_article',
          published_at: authoritativePublishDate,
          source: {
            source_type: 'contentful',
            source_id: entryId
          },
          metadata: {
            title: title,
            ticker: ticker,
            tickers: getMeta(mapping.metadataFields.tickers),
            publicationDate: authoritativePublishDate,
            accessLevel: getMeta(mapping.metadataFields.accessLevel),
            chunk_index: index + 1,
            total_chunks: chunks.length,
            content_type_id: contentTypeId
          },
          owner_id: Deno.env.get("DEFAULT_OWNER_ID")
        };
      });
      if (documentsToInsert.length > 0) {
        await supabaseClient.from("intelligent_documents").insert(documentsToInsert);
      }
      console.log(`Successfully ingested ${chunks.length} chunks for entry ID: ${entryId} of type ${contentTypeId}.`);
      return new Response(JSON.stringify({
        success: true,
        action: "ingested",
        chunks: chunks.length
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    console.log(`Webhook received for an unhandled event type: "${eventType}"`);
    return new Response("Event type not handled", {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`);
    return new Response(`Server error: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});