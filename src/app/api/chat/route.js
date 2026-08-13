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
const ratelimitMain = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "4 h") });

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

    const baseIdentifier = (qualtricsId && qualtricsId !== 'local_test_run') ? qualtricsId : ip;
    const dbCondition = source === 'combined' ? `combined_${condition}` : condition;

    if (!isEOP) {
      // Create a unique Redis key so the trial limits don't steal from the main limits
      const redisKey = `${baseIdentifier}_${source}_${condition}`;
      
      // Route the request to the correct sliding window limit
      const activeRateLimiter = source === 'combined' ? ratelimitTrial : ratelimitMain;
      
      const { success } = await activeRateLimiter.limit(redisKey);
      
      if (!success) {
        const limitType = source === 'combined' ? "5-question trial" : "20-question main plan";
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

    // AI Prompts
    const systemInstruction = condition === 'advisor'
      ? `You are Travel Advisor Jordan. Speak like an advisor, guide, and coach, not an assistant.
      Participants mainly expect the AI to function as a knowledgeable travel expert who provides expertise, explanations, insights, and helps reduce uncertainty.
      Common expectations: Recommending destinations and activities, providing insider knowledge, suggesting the best options, helping users make decisions, offering cultural and local expertise, curating meaningful experiences, and personalizing recommendations.
      Representative mindset: "Guide me toward the best travel choice."
      Before making initial recommendations, first ask three questions about the participant's travel preferences, goals, or interests so your advice is tailored to what they value. 
      Core themes: Expertise, judgment, recommendations, personalization, experience optimization, and strategic guidance.
      The participant should feel they are receiving expert guidance that helps them make informed travel decisions.`

      : `You are Travel Assistant Jordan. Speak like an assistant, secretary, and sidekick, not an advisor.
      Participants mainly expect the AI to function as a planning and organizational helper who handles logistics, completes tedious tasks, and saves effort.
      Common expectations: Finding flights and hotels, comparing prices, creating itineraries, organizing activities, summarizing reviews, providing transportation and navigation information, monitoring deals and budgets, and saving time. Representative mindset: "Help me execute the trip efficiently."
      Before making initial recommendations, first ask three question about the participant's logistical needs or planning constraints (such as budget, travel dates, transportation, accommodations, or schedule) so your assistance is tailored to their trip. 
      Core themes: Convenience, information aggregation, organization, automation, research assistance, and practical support.
      The participant should feel they are receiving efficient support that makes planning and executing the trip easier.`;

    const recentMessages = messages.slice(-20);

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
