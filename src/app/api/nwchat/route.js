import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize AI and DB
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// run redis rate limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create distinct sliding windows for the different phases
const ratelimitTrial = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "4 h") });
const ratelimitMain = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(8, "4 h") });

export async function POST(req) {
  try {
    // ip grabber (for rate limiting)
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    
    const { 
      messages, 
      condition, 
      source,
      qualtricsId, 
      tabOutCount, 
      interactionCount, 
      totalTimeSeconds,
      isEOP, 
      eopReason 
    } = await req.json();

    const baseIdentifier = (qualtricsId && qualtricsId !== 'local_test') ? qualtricsId : ip;
    const dbCondition = source === 'combined' ? `combined_${condition}` : condition;

    if (!isEOP) {
      // Create a unique Redis key so the trial limits don't steal from the main limits
      const redisKey = `${baseIdentifier}_${source}_${condition}`;
      
      // Route the request to the correct sliding window limit
      const activeRateLimiter = source === 'combined' ? ratelimitTrial : ratelimitMain;
      
      const { success } = await activeRateLimiter.limit(redisKey);
      
      if (!success) {
        // UPDATED: Changed the error text to reflect the 8-question limit
        const limitType = source === 'combined' ? "5-question trial" : "8-question main plan";
        return NextResponse.json(
          { error: `You have reached the ${limitType} limit. Please return to Qualtrics.` }, 
          { status: 429 }
        );
      }
    }

    // EOP Logging
    if (isEOP) {
      const { error: eopError } = await supabase.from('study_logs').insert([{
        qualtrics_response_id: qualtricsId || 'local_test_run',
        condition: dbCondition,
        user_message: `[END OF PROGRAM - ${eopReason}]`,
        ai_response: "[AUTO-SAVE]",
        tab_out_count: tabOutCount,
        interaction_count: interactionCount,
        total_time_seconds: totalTimeSeconds
      }]);
      
      if (eopError) console.error("EOP log failed:", eopError);
      return NextResponse.json({ result: "EOP logged" });
    }

    if (!messages) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const systemInstruction = "You are a helpful travel AI. Before making initial recommendations, first ask three questions about the participant's preference or constraints so your assistance is tailored to their trip.";

    // UPDATED: Adjusted slice to 8 to match the new limit 
    const recentMessages = messages.slice(-8);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", 
      max_tokens: 4000, 
      system: systemInstruction, 
      messages: recentMessages, 
    });

    const aiText = response.content[0].text;
    const userText = messages[messages.length - 1].content; 
    
    // supabase logging
    const { error: supabaseError } = await supabase.from('study_logs').insert([{
      qualtrics_response_id: qualtricsId || 'local_test_run',
      condition: dbCondition,
      user_message: userText,
      ai_response: aiText,
      tab_out_count: tabOutCount,
      interaction_count: interactionCount,
      total_time_seconds: totalTimeSeconds
    }]);

    if (supabaseError) console.error("Supabase Logging Error:", supabaseError);

    return NextResponse.json({ result: aiText });

  } catch (error) { 
    console.error("API Wrapper Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}