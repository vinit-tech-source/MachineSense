import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-msg',
      sender: 'bot',
      text: "Hello! I am your MachineSense AI Assistant. How can I help you analyze your production data today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { selectedMachineId } = useMachine();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const lowerInput = userMsg.text.toLowerCase();
      let replyText = "I can help you monitor metrics and analyze alerts. What specific machine data are you looking for?";
      
      if (lowerInput.includes('yield') || lowerInput.includes('quality')) {
        replyText = "To improve yield, I recommend checking the manual analytics dashboard for recent reject counts. Would you like me to flag the latest QA incidents?";
      } else if (lowerInput.includes('energy') || lowerInput.includes('power')) {
        replyText = `The current Specific Energy Consumption (SEC) trend for ${selectedMachineId} is looking stable. Have you checked the idle energy wastage?`;
      } else if (lowerInput.includes('alert') || lowerInput.includes('warning') || lowerInput.includes('fail')) {
        replyText = "If you are experiencing anomalies, check the Alerts tab to see the latest vibration and temperature signatures.";
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: replyText,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '70px',
          right: '0',
          width: '350px',
          height: '500px',
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--cyan) 0%, #0c4a6e 100%)',
            padding: '16px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-default)'
          }}>
            <div className="flex items-center gap-2">
              <Sparkles size={18} color="#67e8f9" />
              <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '0.02em' }}>MachineSense AI</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', opacity: 0.8 }}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Messages Area */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-base)' }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', gap: '8px', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: msg.sender === 'user' ? 'var(--bg-elevated)' : 'var(--cyan-dim)',
                  color: msg.sender === 'user' ? 'var(--text-secondary)' : 'var(--cyan)'
                }}>
                  {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div style={{
                  background: msg.sender === 'user' ? 'var(--cyan)' : 'var(--bg-surface)',
                  color: msg.sender === 'user' ? 'white' : 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '14px 14px 0 14px' : '14px 14px 14px 0',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  maxWidth: '80%',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--border-default)'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: 'var(--cyan-dim)', color: 'var(--cyan)'
                }}>
                  <Bot size={16} />
                </div>
                <div style={{ display: 'flex', gap: '4px', padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '14px 14px 14px 0', border: '1px solid var(--border-default)' }}>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--cyan)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></div>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--cyan)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
                  <div className="typing-dot" style={{ width: '6px', height: '6px', background: 'var(--cyan)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div style={{ padding: '12px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your machines..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button 
                type="submit"
                disabled={!input.trim()}
                style={{
                  background: input.trim() ? 'var(--cyan)' : 'var(--bg-elevated)',
                  color: input.trim() ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  transition: 'background 0.2s'
                }}
              >
                <Send size={18} style={{ marginLeft: '2px' }} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div style={{ position: 'relative' }}>
        {!isOpen && (
          <div 
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '10px',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              animation: 'pulseBadge 2s infinite'
            }}
          >
            AI
          </div>
        )}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="ai-chat-btn"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--cyan) 0%, #0369a1 100%)',
            color: 'white',
            border: 'none',
            boxShadow: '0 8px 24px rgba(8, 145, 178, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: isOpen ? 'scale(0.8) rotate(90deg)' : 'scale(1) rotate(0deg)'
          }}
        >
          {isOpen ? <X size={28} /> : <Bot size={28} />}
        </button>
      </div>

      {/* Custom Styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
        @keyframes pulseBadge {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .ai-chat-btn:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 12px 28px rgba(8, 145, 178, 0.6) !important;
        }
      `}</style>
    </div>
  );
}
