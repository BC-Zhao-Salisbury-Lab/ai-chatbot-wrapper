import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { 
      messages, 
      condition, 
      qualtricsId, 
      tabOutCount, 
      interactionCount, 
      totalTimeSeconds,
      isHeartbeat // background tick (might change to EOP version)
    } = await req.json();


    if (isHeartbeat) {
      const { error: heartbeatError } = await supabase.from('study_logs').insert([{
        qualtrics_response_id: qualtricsId || 'local_test_run',
        condition: condition,
        user_message: "[BACKGROUND TICK]",
        ai_response: "[AUTO-SAVE]",
        tab_out_count: tabOutCount,
        interaction_count: interactionCount,
        total_time_seconds: totalTimeSeconds
      }]);
      
      if (heartbeatError) console.error("Heartbeat log failed:", heartbeatError);
      
      return NextResponse.json({ result: "Heartbeat logged" });
    }

    if (!messages) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const systemInstruction = condition === 'advisor'
      ? "You are a strategic travel advisor. Proactively evaluate logistics, challenge the user's assumptions, and offer optimized structural alternatives. Do not just blindly follow instructions."
      : "You are an execution travel assistant. Provide direct, literal answers. Do not offer unsolicited strategic guidance, and strictly follow user instructions.";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6", // update to active model
      max_tokens: 1000, 
      system: systemInstruction, 
      messages: messages, 
    });

    const aiText = response.content[0].text;
    const userText = messages[messages.length - 1].content; 

    const { error: supabaseError } = await supabase
      .from('study_logs')
      .insert([
        {
          qualtrics_response_id: qualtricsId || 'local_test_run',
          condition: condition,
          user_message: userText,
          ai_response: aiText,
          tab_out_count: tabOutCount,
          interaction_count: interactionCount,
          total_time_seconds: totalTimeSeconds
        }
      ]);

    if (supabaseError) {
      console.error("Supabase Logging Error:", supabaseError);
    }

    return NextResponse.json({ result: aiText });

  } catch (error) { 
    console.error("API Wrapper Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}