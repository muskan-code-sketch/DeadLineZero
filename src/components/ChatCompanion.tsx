import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Task } from "../types";
import { Send, Bot, User, Sparkles, Check, ArrowRight, CornerDownRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SuggestedAdjustment {
  type: 'update_task' | 'create_task' | 'delete_task';
  taskId?: string;
  taskData?: {
    title?: string;
    deadline?: string;
    duration?: number;
    importance?: 'high' | 'medium' | 'low';
    impact?: string;
    status?: 'pending' | 'completed';
  };
  reason: string;
}

interface ChatCompanionProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<{ text: string; suggestedAdjustments?: SuggestedAdjustment[] } | null>;
  tasks: Task[];
  onApplyAdjustment: (adj: SuggestedAdjustment) => void;
  isAnalyzing: boolean;
}

export default function ChatCompanion({
  messages,
  onSendMessage,
  tasks,
  onApplyAdjustment,
  isAnalyzing
}: ChatCompanionProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<SuggestedAdjustment[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeSuggestions]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    setIsLoading(true);
    setActiveSuggestions([]); // Reset previous suggestions

    try {
      const response = await onSendMessage(userText);
      if (response && response.suggestedAdjustments && response.suggestedAdjustments.length > 0) {
        setActiveSuggestions(response.suggestedAdjustments);
      }
    } catch (err) {
      console.error("Chat sending error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (idx: number) => {
    const adj = activeSuggestions[idx];
    onApplyAdjustment(adj);
    // Remove the applied suggestion
    setActiveSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDismissSuggestion = (idx: number) => {
    setActiveSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  const formatTextWithMarkdown = (text: string) => {
    // Basic formatting helper for bold, bullet points, and clean paragraphs
    return text.split('\n').map((line, idx) => {
      let content = line;
      let isBullet = false;

      // Match bullets
      if (content.trim().startsWith('- ') || content.trim().startsWith('* ')) {
        content = content.replace(/^[-*]\s+/, '');
        isBullet = true;
      }

      // Handle bold tags (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        const textBefore = content.substring(lastIndex, match.index);
        const boldText = match[1];
        parts.push(textBefore);
        parts.push(<strong key={match.index} className="font-bold text-slate-900">{boldText}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      parts.push(content.substring(lastIndex));

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-700 text-xs leading-relaxed mb-1">
            {parts}
          </li>
        );
      }

      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-slate-700 text-xs leading-relaxed mb-1.5">
          {parts}
        </p>
      );
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-xs flex flex-col h-[520px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              DeadlineZero Companion
            </h3>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Live Assistant
            </span>
          </div>
        </div>
        <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-mono">
          Model: gemini-3.1-flash-lite
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
        {messages.map((msg) => {
          const isAssistant = msg.sender === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[85%] ${
                isAssistant ? 'self-start' : 'self-end flex-row-reverse'
              }`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                isAssistant ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                {isAssistant ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>

              {/* Speech bubble */}
              <div className={`p-3 rounded-xl text-xs ${
                isAssistant 
                  ? 'bg-slate-50 border border-slate-100 rounded-tl-none' 
                  : 'bg-indigo-600 text-white rounded-tr-none'
              }`}>
                {isAssistant ? (
                  formatTextWithMarkdown(msg.text)
                ) : (
                  <p className="leading-relaxed font-semibold">{msg.text}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-2.5 self-start max-w-[85%]">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 animate-bounce" />
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl rounded-tl-none flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}

        {/* Structured Recommendations Box */}
        <AnimatePresence>
          {activeSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col gap-2 mt-2"
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Pending Action Suggested
                </span>
                <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-sm">
                  {activeSuggestions.length} {activeSuggestions.length === 1 ? 'Action' : 'Actions'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {activeSuggestions.map((adj, idx) => {
                  let actionLabel = "";
                  let detail = "";
                  
                  if (adj.type === "update_task") {
                    const matched = tasks.find(t => t.id === adj.taskId);
                    actionLabel = `Update: "${matched?.title || 'Task'}"`;
                    
                    const changes = [];
                    if (adj.taskData?.deadline) changes.push(`deadline: ${adj.taskData.deadline}`);
                    if (adj.taskData?.importance) changes.push(`importance: ${adj.taskData.importance}`);
                    if (adj.taskData?.status) changes.push(`status: ${adj.taskData.status}`);
                    detail = `Tweak ${changes.join(", ")}`;
                  } else if (adj.type === "create_task") {
                    actionLabel = `Create: "${adj.taskData?.title || 'New Task'}"`;
                    detail = `Set due date for ${adj.taskData?.deadline || 'soon'} (${adj.taskData?.duration || 2}h)`;
                  } else if (adj.type === "delete_task") {
                    const matched = tasks.find(t => t.id === adj.taskId);
                    actionLabel = `Delete: "${matched?.title || 'Task'}"`;
                    detail = "Will completely remove this item";
                  }

                  return (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-indigo-100/50 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1">
                            <CornerDownRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            {actionLabel}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium block pl-4">
                            {detail}
                          </span>
                          {adj.reason && (
                            <p className="text-[10px] text-indigo-700 italic font-medium pl-4 mt-0.5">
                              Why: {adj.reason}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDismissSuggestion(idx)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleApply(idx)}
                        className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Execute Workspace Change
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex gap-2">
        <input
          id="chat-message-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "DeadlineZero is planning..." : "Ask DeadlineZero to shift deadlines, add work, or ask advice..."}
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
        />
        <button
          id="send-chat-btn"
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
