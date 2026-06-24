"use client";

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function Home() {
  // UI State
  const [activeScreen, setActiveScreen] = useState('selection'); 
  const [condition, setCondition] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [isLimitReached, setIsLimitReached] = useState(false); // New rate limit state

  // Separated Chat Histories
  const [chatHistories, setChatHistories] = useState({
    assistant: [],
    advisor: []
  });

  // Tracking Data
  const [qualtricsId, setQualtricsId] = useState('local_test');
  const [tabOutCount, setTabOutCount] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [startTime, setStartTime] = useState(null);

  // Refs for UI and Tracking
  const latestData = useRef({ tabs: 0, clicks: 0, start: null, qId: 'local_test', cond: null });
  const inactivityTimer = useRef(null);
  const TIMEOUT_DURATION = 5 * 60 * 1000; 
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeScreen === 'chat') {
      scrollToBottom();
    }
  }, [chatHistories, isLoading, activeScreen]);

  // Keep ref up to date
  useEffect(() => {
    latestData.current = { tabs: tabOutCount, clicks: interactionCount, start: startTime, qId: qualtricsId, cond: condition };
  }, [tabOutCount, interactionCount, startTime, qualtricsId, condition]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('cc_sessionId');
    if (qId) setQualtricsId(qId);

    const now = Date.now();
    setStartTime(now);
    latestData.current.start = now; 

    const handleVisibilityChange = () => {
      if (document.hidden) setTabOutCount(prev => prev + 1);
    };

    const logEOP = (reason) => {
      const data = latestData.current;
      if (!data.start || !data.cond) return; 
      const elapsedSeconds = Math.floor((Date.now() - data.start) / 1000);

      fetch('/api/chat', {
        method: 'POST',
        keepalive: true, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [], 
          condition: data.cond,
          qualtricsId: data.qId,
          tabOutCount: data.tabs,
          interactionCount: data.clicks,
          totalTimeSeconds: elapsedSeconds,
          isEOP: true,
          eopReason: reason
        }),
      }).catch(err => console.log("EOP log failed"));
    };

    const resetTimeout = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        logEOP('inactivity_timeout');
      }, TIMEOUT_DURATION);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener('beforeunload', () => logEOP('tab_closed'));
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);
    
    resetTimeout(); 

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener('beforeunload', () => logEOP('tab_closed'));
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const handleModeSelection = (selectedCondition) => {
    setCondition(selectedCondition);
    setActiveScreen('chat');
  };

  const handleBackToSelection = () => {
    setActiveScreen('selection');
    setCondition(null);
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {

    // Prevent sending conditions
    if (!input.trim() || !condition || isLimitReached) return;

    const currentInteractions = interactionCount + 1;
    setInteractionCount(currentInteractions);
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    const activeMessages = chatHistories[condition];
    const newMessages = [...activeMessages, { role: 'user', content: input }];
    
    setChatHistories(prev => ({ ...prev, [condition]: newMessages }));
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          condition: condition,
          qualtricsId: qualtricsId,
          tabOutCount: tabOutCount,
          interactionCount: currentInteractions,
          totalTimeSeconds: elapsedSeconds
        }),
      });

      const data = await response.json();

      // Rate limiter
      if (response.status === 429) {
        setIsLimitReached(true);
        setChatHistories(prev => ({
          ...prev,
          [condition]: [...newMessages, { 
            role: 'assistant', 
            content: "**System Message:** You have reached the maximum number of messages allowed for this study. Please return to Qualtrics to complete the final survey." 
          }]
        }));
        return;
      }

      if (data.result) {
        setChatHistories(prev => ({
          ...prev,
          [condition]: [...newMessages, { role: 'assistant', content: data.result }]
        }));
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // FRONTEND
  if (activeScreen === 'selection') {
    return (
      <div className="layout-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: '640px', width: '100%', padding: '40px 24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
          
          <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', color: '#0f172a', fontWeight: '700', textAlign: 'center', letterSpacing: '-0.02em' }}>Select your planning style</h1>
          <p style={{ color: '#64748b', marginBottom: '48px', fontSize: '16px', lineHeight: '1.5', textAlign: 'center' }}>Choose how you prefer the AI to assist you with your itinerary today.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="selection-card"
              onClick={() => handleModeSelection('assistant')}
              style={{ padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '20px', alignItems: 'flex-start' }}
            >
              <div style={{ padding: '12px', borderRadius: '10px', background: '#f1f5f9', color: '#334155' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div style={{ paddingTop: '2px' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '18px', fontWeight: '600' }}>The Execution Assistant</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>Follows your precise instructions strictly. Best if you already know exactly where you want to go and what you want to do.</p>
              </div>
            </button>

            <button 
              className="selection-card"
              onClick={() => handleModeSelection('advisor')}
              style={{ padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '20px', alignItems: 'flex-start' }}
            >
              <div style={{ padding: '12px', borderRadius: '10px', background: '#f1f5f9', color: '#334155' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
              </div>
              <div style={{ paddingTop: '2px' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '18px', fontWeight: '600' }}>The Strategic Advisor</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '15px', lineHeight: '1.5' }}>Challenges assumptions and proactively suggests optimized itineraries. Best for discovering new ideas and better logistics.</p>
              </div>
            </button>
          </div>
        </div>
        <CSSStyles />
      </div>
    );
  }

  // CHAT SCREEN
  const currentMessages = chatHistories[condition] || [];

  return (
    <div className="layout-bg" style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
      
      {/* header */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', background: '#ffffff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
        <button 
          className="header-btn"
          onClick={handleBackToSelection}
          style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#475569', cursor: 'pointer', fontSize: '14px', fontWeight: '500', padding: '6px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Menu
        </button>
        <h2 style={{ margin: '0', flex: 1, textAlign: 'center', color: '#0f172a', fontSize: '15px', fontWeight: '600' }}>
          Travel {condition === 'advisor' ? 'Advisor' : 'Assistant'}
        </h2>
        <div style={{ width: '80px' }}></div> 
      </div>

      {/* chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {currentMessages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', padding: '12vh 20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a', fontWeight: '600', letterSpacing: '-0.01em' }}>How can I help you plan?</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '16px' }}>I am acting as your {condition} today.</p>
            </div>
          )}
          
          {currentMessages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              
              {/* ai profile */}
              {msg.role === 'assistant' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
              )}

              {/* message ui */}
              <div style={{ 
                background: msg.role === 'user' ? '#f1f5f9' : 'transparent',
                padding: msg.role === 'user' ? '12px 18px' : '2px 0', 
                borderRadius: msg.role === 'user' ? '16px' : '0',
                maxWidth: msg.role === 'user' ? '75%' : '90%',
                fontSize: '15.5px',
                lineHeight: '1.65',
                color: '#1e293b',
                whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                overflowWrap: 'break-word',
              }}>
                {msg.role === 'user' ? msg.content : (
                  <div className="markdown-body">
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p style={{margin: '0 0 16px 0'}} {...props} />,
                        ul: ({node, ...props}) => <ul style={{margin: '0 0 16px 0', paddingLeft: '24px'}} {...props} />,
                        ol: ({node, ...props}) => <ol style={{margin: '0 0 16px 0', paddingLeft: '24px'}} {...props} />,
                        li: ({node, ...props}) => <li style={{marginBottom: '8px'}} {...props} />,
                        strong: ({node, ...props}) => <strong style={{fontWeight: '600', color: '#0f172a'}} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{margin: '28px 0 14px 0', fontSize: '20px', fontWeight: '600', color: '#0f172a'}} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{margin: '22px 0 10px 0', fontSize: '17px', fontWeight: '600', color: '#0f172a'}} {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'flex-start', animation: 'fadeIn 0.2s ease-in' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <div style={{ padding: '5px 0', color: '#94a3b8', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot-pulse"></span>
                <span className="dot-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="dot-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* input */}
      <div style={{ padding: '24px 20px', background: 'linear-gradient(to top, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 100%)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>
          <div className="input-wrapper" style={{ 
            display: 'flex', 
            alignItems: 'flex-end',
            backgroundColor: '#ffffff',
            padding: '10px 12px',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            transition: 'all 0.2s ease'
          }}>
            <textarea 
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isLimitReached} // Disable when limit hit
              placeholder={isLimitReached ? "Study portion complete." : (condition === 'assistant' ? "Message Assistant..." : "Message Advisor...")} // Update placeholder
              rows={1}
              style={{ 
                flex: 1, 
                padding: '4px 8px 4px 12px', 
                fontSize: '15.5px', 
                lineHeight: '1.5',
                background: 'transparent', 
                border: 'none', 
                outline: 'none',
                color: '#0f172a',
                resize: 'none',
                minHeight: '24px',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'inherit',
                opacity: isLimitReached ? 0.6 : 1
              }}
            />
            <button 
              className="send-btn"
              onClick={sendMessage} 
              disabled={isLoading || !input.trim() || isLimitReached}
              style={{ 
                padding: '6px', 
                margin: '0 0 2px 8px',
                borderRadius: '10px', 
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: (isLoading || !input.trim() || isLimitReached) ? '#e2e8f0' : '#0f172a', 
                color: (isLoading || !input.trim() || isLimitReached) ? '#94a3b8' : 'white', 
                border: 'none', 
                cursor: (isLoading || !input.trim() || isLimitReached) ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
            Travel {condition === 'advisor' ? 'Advisor' : 'Assistant'} can make mistakes. Verify important information.
          </div>
        </div>
      </div>
      <CSSStyles />
    </div>
  );
}

const CSSStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    .layout-bg {
      background-color: #ffffff;
      /* Very subtle grid pattern for a technical/professional feel */
      background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
      background-size: 24px 24px;
    }

    .selection-card {
      transition: all 0.2s ease;
    }
    
    .selection-card:hover {
      border-color: #94a3b8 !important;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02) !important;
      transform: translateY(-2px);
    }

    .input-wrapper:focus-within {
      border-color: #94a3b8 !important;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05) !important;
    }

    .send-btn:not(:disabled):hover {
      background: #334155 !important;
    }

    .header-btn:hover {
      background: #f8fafc !important;
      border-color: #cbd5e1 !important;
      color: #0f172a !important;
    }

    .dot-pulse {
      width: 6px;
      height: 6px;
      background-color: #94a3b8;
      border-radius: 50%;
      display: inline-block;
      animation: pulse-animation 1.4s infinite ease-in-out both;
    }

    @keyframes pulse-animation {
      0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `}} />
);