import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Fetch a single row to simulate activity and keep the DB awake
    const { data, error } = await supabase
      .from('study_logs')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: "Database pinged successfully to prevent pausing." 
    });
    
  } catch (error) {
    console.error("Keep-alive ping failed:", error);
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500 }
    );
  }
}