/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Send, Volume2, VolumeX, MessageCircle, Heart, Sparkles, User, Info } from 'lucide-react';
import { auraService, Message } from './services/auraService';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (!isSpeaking && isHandsFree && !isTyping && messages.length > 0) {
      // Small delay to prevent echo or catching its own voice
      const timer = setTimeout(() => {
        if (!isSpeakingRef.current && isHandsFree && !isTyping) {
          toggleListening();
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isHandsFree, isTyping, messages]);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  };

  const playAudio = async (base64Audio: string) => {
    if (!isSoundEnabled) return;
    initAudio();
    setIsSpeaking(true);
    
    try {
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      // It's raw PCM 16-bit little endian, 24kHz
      const pcm16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = audioContextRef.current!.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioContextRef.current!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current!.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    // Welcome message
    const welcome = async () => {
      setIsTyping(true);
      const reply = "Hey! Main Aura hoon. Aapka ek dost jo aapko bina kisi jugdment ke sunne ke liye hamesha yahan hai. Aaj kaisa feel kar rahe ho?";
      setTimeout(async () => {
        setIsTyping(false);
        setMessages([{ role: 'model', text: reply }]);
        if (isSoundEnabled) {
          try {
            const audio = await auraService.generateSpeech(reply);
            playAudio(audio);
          } catch (e) {
            console.error(e);
          }
        }
      }, 1500);
    };
    welcome();
  }, []);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'hi-IN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      initAudio(); // Initialize audio context on user interaction
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const userText = overrideText || input.trim();
    if (!userText || isTyping) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      const { text: reply, toolCall } = await auraService.sendMessage(userText);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
      
      if (toolCall) {
        if (toolCall.name === 'send_whatsapp_message') {
          const { phone, message } = toolCall.args;
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: `Thoda sa wait karo, main WhatsApp link open kar rahi hoon... (${phone})` 
          }]);
          window.open(url, '_blank');
        }
      }

      if (isSoundEnabled) {
        const audio = await auraService.generateSpeech(reply);
        playAudio(audio);
      }
    } catch (err) {
      console.error(err);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'model', text: "Hmm, kuch error aa gaya. Par main yahi hoon aapke liye." }]);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8">
      <div className="atmosphere">
        <div className="mesh-1" />
        <div className="mesh-2" />
        <div className="mesh-3" />
      </div>
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-rose-400 flex items-center justify-center shadow-lg">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-sans text-xl font-medium tracking-tight uppercase">Aura AI</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
             onClick={() => setIsHandsFree(!isHandsFree)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isHandsFree ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-white/5 border-white/10 text-white/40'}`}
          >
            <div className={`w-2 h-2 rounded-full ${isHandsFree ? 'bg-orange-400 animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Hands Free</span>
          </button>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full ${isTyping || isSpeaking ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">
              {isSpeaking ? 'Sync Active' : isTyping ? 'Processing' : 'Aura Active'}
            </span>
          </div>
          <button 
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <Info size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl flex flex-col items-center justify-center flex-grow z-10 pt-24 pb-32 overflow-hidden">
        
        {/* Aura Core Visualizer */}
        <div className="flex-1 flex flex-col items-center justify-center relative py-12 w-full">
          <div className="relative flex items-center justify-center">
            {/* Outer Glow Rings */}
            <div className="aura-ring w-[420px] h-[420px] hidden md:block" />
            <div className="aura-ring w-[360px] h-[360px] hidden md:block" />
            
            <motion.div 
              animate={{
                scale: isSpeaking ? [1, 1.05, 1] : isTyping ? [1, 1.05, 1] : [1, 1.02, 1],
                shadow: isSpeaking ? "0 0 100px -10px rgba(168,85,247,0.4)" : "0 0 80px -20px rgba(168,85,247,0.3)"
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="aura-core w-48 h-48 md:w-64 md:h-64 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-rose-500/10" />
              <AnimatePresence mode="wait">
                {isSpeaking ? (
                  <motion.div 
                    key="speaking"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-end gap-1.5 h-20"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: [12, 32, 12] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        className={`w-1 rounded-full ${i === 3 ? 'bg-white h-20' : i % 2 === 0 ? 'bg-rose-400 h-12' : 'bg-indigo-400 h-14'} opacity-80`}
                      />
                    ))}
                  </motion.div>
                ) : isTyping ? (
                  <motion.div 
                    key="typing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-white/40 flex gap-1"
                  >
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-100" />
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-200" />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-white/20"
                  >
                    <Heart size={40} className="animate-pulse" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Subtitle / Latest Message */}
          <div className="mt-16 text-center max-w-2xl px-6">
            <AnimatePresence mode="wait">
              {messages.length > 0 && messages[messages.length-1].role === 'model' && (
                <motion.p 
                  key={messages.length}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl md:text-3xl font-light leading-relaxed text-slate-200"
                >
                  "{messages[messages.length-1].text}"
                </motion.p>
              )}
            </AnimatePresence>
            <p className="mt-4 text-[10px] font-semibold text-indigo-400 uppercase tracking-[0.3em] opacity-80">
              {isSpeaking ? 'Aura is speaking' : isTyping ? 'Aura is thinking' : 'Aura is listening'}
            </p>
          </div>
        </div>

        {/* Chat Messages Scrolling */}
        <div 
          ref={scrollRef}
          className="w-full max-h-[30vh] overflow-y-auto px-6 scrolling-content space-y-4 pb-4"
        >
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] px-5 py-3 glass-card rounded-2xl text-sm ${msg.role === 'user' ? 'bg-white/10' : 'bg-black/20'}`}>
                <p className="leading-relaxed opacity-90">{msg.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="fixed bottom-0 left-0 right-0 p-8 md:p-12 z-50 flex flex-col items-center gap-8 w-full max-w-7xl mx-auto">
        
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* Emotion Status */}
          <div className="hidden md:flex flex-col gap-2 p-5 glass-card">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Emotional Resonance</span>
            <div className="flex justify-between items-end">
              <span className="text-base font-medium">Empathetic</span>
              <span className="text-xs text-rose-300">98% Harmony</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-rose-400 w-[98%]"></div>
            </div>
          </div>

          {/* Input Interaction Bar */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-full max-w-md glass-card p-1.5 flex items-center gap-2 shadow-2xl">
              <button 
                onClick={toggleListening}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-rose-500 animate-pulse text-white' : 'hover:bg-white/10 text-white/60'}`}
              >
                <Mic size={18} />
              </button>
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Kuch kaho..."
                className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm placeholder:text-white/20"
              />
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 rounded-2xl bg-white text-slate-900 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Context Status */}
          <div className="hidden md:flex flex-col gap-2 p-5 glass-card">
            <span className="text-[10px] uppercase tracking-widest text-slate-400">Deep Context</span>
            <div className="flex flex-col">
              <span className="text-sm text-slate-200">Processing: Dynamic Interaction</span>
              <span className="text-[10px] text-indigo-300 mt-1 italic">"Adaptive to your emotional tone..."</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full glass-card p-12 text-center flex flex-col gap-6"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="font-serif text-3xl">Aura</h2>
              <p className="text-white/70 leading-relaxed font-sans">
                Main ek ai companion hoon jo aapki feelings ko samjhti hai. 
                Mujhse aap kisi bhi dost ki tarah baat kar sakte hain. 
                Robotic nahi, humesha aapke saath. 
              </p>
              <div className="flex flex-col gap-2 text-sm text-white/40">
                <p>• Human-like Conversational AI</p>
                <p>• Empathetic Emotional Intelligence</p>
                <p>• High-Quality Voice Synthesis</p>
              </div>
              <button 
                onClick={() => setShowInfo(false)}
                className="mt-4 px-8 py-3 rounded-full bg-white text-black font-medium hover:bg-white/80 transition-colors"
              >
                Theek Hai
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
