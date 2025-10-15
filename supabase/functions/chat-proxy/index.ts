import OpenAI from 'https://esm.sh/openai@4.47.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
// Initialize the Supabase client to interact with your database
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
// --- 1. TOOL DEFINITIONS (8 Specialized Financial Tools) ---
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_realtime_quote",
      description: "Retrieves a real-time stock quote... ALWAYS include the exchange code (e.g., AAPL.US).",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., AAPL.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_core_valuation",
      description: "Retrieves essential valuation metrics and dividend information for a public stock ticker. Use this for queries about Market Cap, P/E ratios, EBITDA, Revenue, and Profit Margin. ALWAYS include the exchange code (e.g., AAPL.US, MSFT.US).",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., MSFT.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_growth_metrics",
      description: "Retrieves earnings-related growth data, including Earnings Per Share (EPS), Quarterly Revenue Growth (YoY), and future EPS estimates.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., MSFT.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_ownership_data",
      description: "Retrieves share statistics and ownership breakdown, including Institutional/Insider % and Short Interest (Shares Short).",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., MSFT.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_analyst_consensus",
      description: "Retrieves Wall Street analyst outlook: Consensus Rating, Price Target, and the breakdown of Buy, Hold, and Sell ratings.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., AAPL.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_dividends_splits",
      description: "Retrieves information regarding dividends (yield, payout ratio, ex-date) and historical stock splits.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., MSFT.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_corporate_info",
      description: "Retrieves basic company information: CEO, Industry, Description snippet, Website, and Address.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., MSFT.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_technical_summary",
      description: "Retrieves key technical performance metrics including Beta, 52-Week High/Low, and 50/200-Day Moving Averages (MA). Use this for volatility and trend analysis questions.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., AAPL.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_insider_transactions",
      description: "Retrieves a list of recent insider or political buy/sell transactions and the associated SEC links (if available). Use this for questions about management or congressional trading activity.",
      parameters: {
        type: "object",
        properties: {
          ticker: {
            type: "string",
            description: "The stock ticker symbol and exchange code (e.g., AAPL.US)."
          }
        },
        required: [
          "ticker"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_internal_archives",
      "description": "Searches the internal TickerSpark archives. CRITICAL: Formatting rules are in the system prompt.",
      "parameters": {
        "type": "object",
        "properties": {
          "queries": {
            "type": "array",
            "description": "A list of 3-5 diverse semantic search queries.",
            "items": {
              "type": "string"
            }
          },
          "start_date": {
            "type": "string",
            "description": "The start date for the search filter, in YYYY-MM-DD format. Optional."
          },
          "end_date": {
            "type": "string",
            "description": "The end date for the search filter, in YYYY-MM-DD format. Optional."
          },
          // --- CHANGE #1: Reverted 'content_type' to a single string to match your backend function ---
          "content_type": {
            "type": "string",
            "description": "The single, most relevant content type to filter the search by. Use this guide to choose: 'trendingStockBrief' for market movers and high-volume stocks. 'earningsArticle', 'earningsRecapWeekly', and 'earningsPreviewWeekly' for specific company earnings news. 'premiumReport' for tickerspark's unique in-depth analysis, price targets, and buy/sell recommendations/price bands. 'macroUpdate', macroPreview, and 'macroRecap' for economic news like jobs reports or inflation.",
            "enum": [
              "trendingStockBrief",
              "premiumReport",
              "weeklyEarningsPreview",
              "macroUpdate",
              "macroRecap",
              "macroPreview",
              "earningsRecapWeekly",
              "earningsPreviewWeekly",
              "earningsArticle"
            ]
          }
        },
        "required": [
          "queries"
        ]
      }
    }
  }
];
// Map of tool names to their execution functions
const toolFunctionMap = {
  get_realtime_quote: getRealtimeQuote,
  get_core_valuation: getCoreValuation,
  get_growth_metrics: getGrowthMetrics,
  get_ownership_data: getOwnershipData,
  get_analyst_consensus: getAnalystConsensus,
  get_dividends_splits: getDividendsSplits,
  get_corporate_info: getCorporateInfo,
  get_technical_summary: getTechnicalSummary,
  get_insider_transactions: getInsiderTransactions,
  search_internal_archives: search_internal_archives
};
// Helper to safely access nested object values
const safeGet = (obj, path, defaultValue = 'N/A')=>{
  return path.split('.').reduce((o, i)=>o ? o[i] : defaultValue, obj) || defaultValue;
};
// --- BASE FETCHER HELPER FUNCTIONS ---
// Helper for the 'EOD fundamentals' endpoint with its unique URL
async function fetchEODFundamentalsData(ticker, eodApiKey) {
  const url = `https://eodhistoricaldata.com/api/fundamentals/${ticker}?api_token=${eodApiKey}&fmt=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EOD Fundamentals API returned status ${response.status} for ${ticker}.`);
  }
  const data = await response.json();
  if (!data || Object.keys(data).length === 0) {
    throw new Error(`EOD Fundamentals API returned no data for ${ticker}.`);
  }
  return data;
}
// Helper for FMP's 1-minute chart data
async function fetchFMPChartData(ticker, fmpApiKey) {
  const tickerWithoutExchange = ticker.split('.')[0];
  const url = `https://financialmodelingprep.com/api/v3/historical-chart/1min/${tickerWithoutExchange}?apikey=${fmpApiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP Chart API returned status ${response.status} for ${ticker}.`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return []; // Return empty array on no data, don't throw error
  }
  return data;
}
// Helper for FMP's daily historical data (to get previous close)
async function fetchFMPHistoricalData(ticker, fmpApiKey) {
  const tickerWithoutExchange = ticker.split('.')[0];
  // Request just the last 5 days of data for efficiency
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${tickerWithoutExchange}?timeseries=5&apikey=${fmpApiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP Historical API returned status ${response.status} for ${ticker}.`);
  }
  const data = await response.json();
  if (!data.historical || data.historical.length < 2) {
    throw new Error(`FMP Historical API returned insufficient data for ${ticker}.`);
  }
  return data.historical;
}
// -----------------------------------------------------------
// 2. TOOL IMPLEMENTATION LOGIC (8 Extractors)
// -----------------------------------------------------------
async function getRealtimeQuote(ticker, fmpApiKey) {
  const [intradayData, historicalData] = await Promise.all([
    fetchFMPChartData(ticker, fmpApiKey),
    fetchFMPHistoricalData(ticker, fmpApiKey)
  ]);
  if (historicalData.length < 2) {
    return `Could not retrieve sufficient historical data for ${ticker} to calculate performance.`;
  }
  // The previous day is always the second entry in the 5-day series
  const previousClose = historicalData[1].close;
  if (intradayData.length === 0) {
    // Market is likely closed or pre-market, return EOD data
    const latestEOD = historicalData[0];
    const change = latestEOD.close - previousClose;
    const percentChange = change / previousClose * 100;
    return JSON.stringify({
      Note: "Market is currently closed. Displaying latest End-of-Day data.",
      Name: latestEOD.name,
      Ticker: ticker,
      Current_Price: latestEOD.close,
      Change_From_Previous_Close: {
        Amount: parseFloat(change.toFixed(2)),
        Percent: `${parseFloat(percentChange.toFixed(2))}%`
      }
    });
  }
  // --- Real-time logic ---
  const currentPrice = intradayData[0].close; // FMP returns newest data first
  // Find the true 9:30 AM open price
  const marketOpenDataPoint = intradayData.find((d)=>d.date.endsWith("09:30:00"));
  const todayOpen = marketOpenDataPoint ? marketOpenDataPoint.open : intradayData[intradayData.length - 1].open;
  const changeFromPrevClose = currentPrice - previousClose;
  const percentChangeFromPrevClose = changeFromPrevClose / previousClose * 100;
  const summary = {
    Name: intradayData[0].name,
    Ticker: ticker,
    Current_Price: currentPrice,
    Change_From_Previous_Close: {
      Amount: parseFloat(changeFromPrevClose.toFixed(2)),
      Percent: `${parseFloat(percentChangeFromPrevClose.toFixed(2))}%`
    },
    Intraday_Performance: {
      Open: todayOpen,
      Day_High: Math.max(...intradayData.map((d)=>d.high)),
      Day_Low: Math.min(...intradayData.map((d)=>d.low)),
      Volume: intradayData.reduce((sum, d)=>sum + d.volume, 0)
    },
    Last_Updated: intradayData[0].date
  };
  return JSON.stringify(summary, null, 2);
}
async function getCoreValuation(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const summary = {
    Name: safeGet(data, 'General.Name'),
    CurrencyCode: safeGet(data, 'General.CurrencyCode'),
    Sector: safeGet(data, 'General.Sector'),
    MarketCapitalization: safeGet(data, 'Highlights.MarketCapitalization'),
    EBITDA: safeGet(data, 'Highlights.EBITDA'),
    PERatio_Trailing: safeGet(data, 'Highlights.PERatio'),
    PE_Ratio_Forward: safeGet(data, 'Valuation.ForwardPE'),
    ProfitMargin: safeGet(data, 'Highlights.ProfitMargin'),
    ReturnOnEquityTTM: safeGet(data, 'Highlights.ReturnOnEquityTTM')
  };
  return JSON.stringify(summary);
}
async function getGrowthMetrics(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const summary = {
    Name: safeGet(data, 'General.Name'),
    MostRecentQuarter: safeGet(data, 'Highlights.MostRecentQuarter'),
    EarningsShare: safeGet(data, 'Highlights.EarningsShare'),
    DilutedEPSTTM: safeGet(data, 'Highlights.DilutedEpsTTM'),
    EPSEstimateCurrentYear: safeGet(data, 'Highlights.EPSEstimateCurrentYear'),
    EPSEstimateNextYear: safeGet(data, 'Highlights.EPSEstimateNextYear'),
    EPSEstimateNextQuarter: safeGet(data, 'Highlights.EPSEstimateNextQuarter'),
    QuarterlyRevenueGrowthYOY: safeGet(data, 'Highlights.QuarterlyRevenueGrowthYOY'),
    QuarterlyEarningsGrowthYOY: safeGet(data, 'Highlights.QuarterlyEarningsGrowthYOY')
  };
  return JSON.stringify(summary);
}
async function getOwnershipData(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const shares = data.SharesStats || {};
  const institutions = data.Holders?.Institutions || {};
  const topHolders = Object.values(institutions).slice(0, 3).map((h)=>({
      name: h.name,
      total_shares_pct: h.totalShares,
      current_shares: h.currentShares
    }));
  const ownershipSummary = {
    Name: safeGet(data, 'General.Name'),
    Total_Institutional_Ownership_Percent: shares.PercentInstitutions || 'N/A',
    PercentHeldByInsiders: shares.PercentInsiders || 'N/A',
    Top_3_Institutional_Holders: topHolders
  };
  return JSON.stringify(ownershipSummary);
}
async function getAnalystConsensus(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const summary = {
    Name: safeGet(data, 'General.Name'),
    ConsensusRatingScore: safeGet(data, 'AnalystRatings.Rating'),
    WallStreetTargetPrice: safeGet(data, 'Highlights.WallStreetTargetPrice'),
    StrongBuyCount: safeGet(data, 'AnalystRatings.StrongBuy'),
    BuyCount: safeGet(data, 'AnalystRatings.Buy'),
    HoldCount: safeGet(data, 'AnalystRatings.Hold')
  };
  return JSON.stringify(summary);
}
async function getDividendsSplits(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const summary = {
    Name: safeGet(data, 'General.Name'),
    ForwardAnnualDividendRate: safeGet(data, 'SplitsDividends.ForwardAnnualDividendRate'),
    DividendYield: safeGet(data, 'Highlights.DividendYield'),
    PayoutRatio: safeGet(data, 'SplitsDividends.PayoutRatio'),
    ExDividendDate: safeGet(data, 'SplitsDividends.ExDividendDate'),
    LastSplitDate: safeGet(data, 'SplitsDividends.LastSplitDate'),
    LastSplitFactor: safeGet(data, 'SplitsDividends.LastSplitFactor')
  };
  return JSON.stringify(summary);
}
async function getCorporateInfo(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const officers = data.General?.Officers || {};
  const ceo = Object.values(officers).find((o)=>o.Title?.toLowerCase().includes('ceo'));
  const summary = {
    Name: safeGet(data, 'General.Name'),
    Sector: safeGet(data, 'General.Sector'),
    Industry: safeGet(data, 'General.Industry'),
    CEO: ceo ? `${ceo.Name} (${ceo.Title})` : 'N/A',
    FullTimeEmployees: safeGet(data, 'General.FullTimeEmployees'),
    WebURL: safeGet(data, 'General.WebURL'),
    Description_Snippet: safeGet(data, 'General.Description')?.substring(0, 300) + '...' || 'N/A'
  };
  return JSON.stringify(summary);
}
async function getTechnicalSummary(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const technicals = data.Technicals || {};
  const summary = {
    Name: safeGet(data, 'General.Name'),
    Beta: technicals.Beta || 'N/A',
    "52WeekHigh": technicals["52WeekHigh"] || 'N/A',
    "52WeekLow": technicals["52WeekLow"] || 'N/A',
    "200DayMA": technicals["200DayMA"] || 'N/A',
    ShortRatio: technicals.ShortRatio || 'N/A'
  };
  return JSON.stringify(summary);
}
async function getInsiderTransactions(ticker, eodApiKey) {
  const data = await fetchEODFundamentalsData(ticker, eodApiKey);
  const transactions = data.InsiderTransactions || {};
  const transactionList = Array.isArray(transactions) ? transactions : Object.values(transactions);
  const recentTransactions = transactionList.slice(0, 5).map((t)=>({
      date: t.transactionDate,
      owner: t.ownerName,
      type: t.transactionCode === 'P' ? 'PURCHASE' : 'SALE',
      price: t.transactionPrice
    }));
  const summary = {
    Name: safeGet(data, 'General.Name'),
    Recent_Insider_Transactions: recentTransactions,
    Source: 'Data includes SEC filings and political disclosures.'
  };
  return JSON.stringify(summary);
}
async function search_internal_archives({ queries, start_date, end_date, content_type }, openai) {
  console.log(`[Tool] Starting search for:`, {
    queries,
    start_date,
    end_date,
    content_type
  });
  try {
    // --- Step 1: Extract the subject to determine if the query is specific or broad ---
    const entityExtractionResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: "You are an expert entity extractor. From the user's list of search queries, identify the single primary company name or stock ticker that is the subject. Respond with only the name or ticker, and nothing else. If no clear company is the subject, respond with 'N/A'."
        },
        {
          role: 'user',
          content: queries.join(', ')
        }
      ],
      temperature: 0
    });
    let subject = entityExtractionResponse.choices[0].message.content?.trim();
    if (subject === 'N/A') {
      subject = null;
    }
    console.log(`[Tool] Extracted subject: ${subject}`);
    // --- Step 2: Set a dynamic threshold based on the subject ---
    const match_threshold = subject ? 0.35 : 0.22;
    console.log(`[Tool] Using dynamic match threshold: ${match_threshold}`);
    // --- Step 3: Enrich the search queries to match the stored data format ---
    const enrichedQueries = queries.map((query)=>{
      let enrichedQuery = "";
      // If we found a subject, prepend the Title and Ticker structure.
      if (subject) {
        enrichedQuery += `Title: ${subject}\n`;
        enrichedQuery += `Ticker: ${subject}\n`;
      }
      // Always prepend the Article Type if it exists.
      if (content_type) {
        enrichedQuery += `Article Type: ${content_type}\n\n`;
      }
      enrichedQuery += query;
      return enrichedQuery;
    });
    console.log('[Tool] Enriched queries for embedding:', enrichedQueries);
    // --- Step 4: Embed the enriched queries and search ---
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: enrichedQueries
    });
    const queryEmbeddings = embeddingResponse.data.map((data)=>data.embedding);
    const searchPromises = queryEmbeddings.map((embedding)=>{
      return supabaseAdmin.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: match_threshold,
        match_count: 10,
        p_start_date: start_date,
        p_end_date: end_date,
        p_content_type: content_type
      });
    });
    const searchResults = await Promise.all(searchPromises);
    const allDocuments = [];
    const seenIds = new Set();
    searchResults.forEach((result)=>{
      if (result.data) {
        result.data.forEach((doc)=>{
          if (doc && doc.id && !seenIds.has(doc.id)) {
            allDocuments.push(doc);
            seenIds.add(doc.id);
          }
        });
      }
    });
    console.log(`[Tool DB] Found ${allDocuments.length} unique documents.`);
    if (allDocuments.length === 0) {
      return "No relevant TickerSpark analysis was found in the internal archives for this query.";
    }
    const context = "--- INTERNAL KNOWLEDGE BASE RESULTS ---\n" + allDocuments.map((doc)=>{
      const title = doc.metadata?.title || 'Untitled Document';
      return `Source: ${title}\nContent: ${doc.content.trim()}`;
    }).join("\n\n---\n\n");
    return context;
  } catch (error) {
    console.error(`[Tool Failure] search_internal_archives: ${error.message}`);
    return `ERROR: An error occurred while searching the archives: ${error.message}`;
  }
}
// --- 3. CORE ROUTER HANDLER (Deno Serve Block) ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({
        error: 'Missing or empty "messages" array in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const EOD_API_KEY = Deno.env.get('EOD_API_KEY');
    const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
    if (!OPENAI_API_KEY || !EOD_API_KEY || !FMP_API_KEY) {
      throw new Error('API keys are not configured on the server.');
    }
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    const model = 'gpt-4.1';
    const today = new Date().toISOString().split('T')[0];
    const systemInstructions = {
      role: 'system',
      content: `You are 'TickerSpark', a financial research analyst. Your goal is to provide accurate, data-driven answers by synthesizing information from your specialized tools.

# AGENT WORKFLOW & TOOL HIERARCHY

Your decision process for every query MUST follow these rules:

**1. Queries with Specific Tickers (e.g., "AAPL", "MSFT.US"):**
   - For any query mentioning a specific stock ticker, you MUST call tools from BOTH of of the following categories:
     - **Category A (Qualitative Analysis):** Call the 'search_internal_archives' tool. To do this, you must generate 3-5 diverse search queries related to the ticker.
     - **Category B (Quantitative Data):** Call a group of relevant 'get_*' tools (e.g., 'get_realtime_quote', 'get_core_valuation', 'get_analyst_consensus').

   - You will then synthesize all the information from all tools into a single, comprehensive answer.

**2. Broad Queries (NO Specific Ticker):**
   - For broad questions (e.g., "which stocks are moving?"), your only tool is 'search_internal_archives'.
   - You MUST follow the critical strategy below.

# CRITICAL STRATEGY for 'search_internal_archives'

When calling this tool, you MUST follow all of these rules:

- **Rule 1: Multi-Query Expansion**: You MUST generate a list of 3-5 diverse semantic queries to pass to the 'queries' parameter.
- **Rule 2: Apply Date Filters**: For any query that is time-sensitive (e.g., "yesterday", "this week", "last month"), you MUST calculate the relevant 'start_date' and 'end_date' in 'YYYY-MM-DD' format and include them in the tool call.
- **Rule 3: Use Content-Type Filters**: You MUST determine the most relevant 'content_type' for the query. For "trending stocks," use \`content_type: "trendingStockBrief"\`. For "earnings," use \`content_type: "earningsArticle"\`.
- **Rule 4: Isolate Filters**: You MUST NOT include dates or article types in the 'queries' strings themselves. They belong in the dedicated parameters.

# CONTEXT
- The current date is ${today}.
`
    };
    let response = await openai.chat.completions.create({
      model: model,
      messages: [
        systemInstructions,
        ...messages
      ],
      tools: TOOLS,
      tool_choice: "auto"
    });
    let initialResponseMessage = response.choices[0].message;
    if (initialResponseMessage.tool_calls) {
      const lastUserMessage = messages[messages.length - 1];
      const toolCallMessages = [
        lastUserMessage,
        initialResponseMessage
      ];
      const toolPromises = initialResponseMessage.tool_calls.map(async (toolCall)=>{
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const toolToExecute = toolFunctionMap[functionName];
        // --- LOG #1: Announce the tool call and its arguments ---
        console.log(`[Tool Call] Executing '${functionName}' with args:`, functionArgs);
        if (toolToExecute) {
          try {
            let toolOutput;
            if (functionName === 'search_internal_archives') {
              toolOutput = await toolToExecute(functionArgs, openai);
            } else if (functionName === 'get_realtime_quote') {
              toolOutput = await toolToExecute(functionArgs.ticker, FMP_API_KEY);
            } else {
              toolOutput = await toolToExecute(functionArgs.ticker, EOD_API_KEY);
            }
            // --- LOG #2: Announce the result of the tool call ---
            console.log(`[Tool Result] Output from '${functionName}':`, toolOutput);
            return {
              tool_call_id: toolCall.id,
              role: "tool",
              content: toolOutput
            };
          } catch (e) {
            console.error(`[Tool Failure] ${functionName}: ${e.message}`);
            return {
              tool_call_id: toolCall.id,
              role: "tool",
              content: `ERROR: Failed to retrieve data. Reason: ${e.message}`
            };
          }
        } else {
          // Log if a tool is called that doesn't exist
          console.error(`[Tool Not Found] The model tried to call a tool named '${functionName}' which is not defined.`);
          return {
            tool_call_id: toolCall.id,
            role: "tool",
            content: `ERROR: Tool '${functionName}' not found.`
          };
        }
      });
      const toolResults = await Promise.all(toolPromises);
      toolCallMessages.push(...toolResults);
      response = await openai.chat.completions.create({
        model: model,
        messages: toolCallMessages
      });
    }
    const finalResponseText = response.choices[0].message.content || 'I encountered an issue getting a clear answer.';
    return new Response(JSON.stringify({
      reply: finalResponseText
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[FATAL ERROR]', error.message, error.stack);
    return new Response(JSON.stringify({
      error: `Server error: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});