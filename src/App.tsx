import React, { useState, useEffect } from "react";
import { Task, AIAnalysis, ChatMessage, AIScheduleItem, AIWarning } from "./types";
import TaskList from "./components/TaskList";
import EisenhowerMatrix from "./components/EisenhowerMatrix";
import ScheduleTimeline from "./components/ScheduleTimeline";
import TipsAndWarnings from "./components/TipsAndWarnings";
import ChatCompanion from "./components/ChatCompanion";
import WorkloadPresets from "./components/WorkloadPresets";
import { WorkloadTemplate } from "./data/templates";
import { Bot, Sparkles, RefreshCw, Calendar, Clock, CheckSquare, ShieldAlert, BookOpen, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TODAY_DATE = getLocalDateString(); // Dynamic real local date

export default function App() {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criticalIds, setCriticalIds] = useState<string[]>([]);
  const [importantIds, setImportantIds] = useState<string[]>([]);
  const [lowPriorityIds, setLowPriorityIds] = useState<string[]>([]);
  const [aiSchedule, setAiSchedule] = useState<AIScheduleItem[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<AIWarning[]>([]);
  const [summary, setSummary] = useState("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load state on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem("deadlinezero_tasks");
    const savedMessages = localStorage.getItem("deadlinezero_messages");
    const savedAnalysis = localStorage.getItem("deadlinezero_analysis");

    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    } else {
      // Default initial small task list
      const initial: Task[] = [
        {
          id: "def-1",
          title: "Prepare Marketing Pitch Deck",
          deadline: "2026-06-27",
          duration: 4,
          importance: "high",
          impact: "Lose core client launch opportunity",
          status: "pending"
        },
        {
          id: "def-2",
          title: "Review lease terms",
          deadline: "2026-06-29",
          duration: 2,
          importance: "low",
          impact: "Mild late lease fee",
          status: "pending"
        }
      ];
      setTasks(initial);
      localStorage.setItem("deadlinezero_tasks", JSON.stringify(initial));
    }

    if (savedMessages) {
      setChatMessages(JSON.parse(savedMessages));
    } else {
      const initialMsgs: ChatMessage[] = [
        {
          id: "welcome-1",
          sender: "assistant",
          text: "Welcome to **DeadlineZero**! I'm your high-performance productivity companion. My objective is to keep you from missing any deadlines.\n\nAdd your current tasks on the left, load one of the **workload presets** below, or chat with me. Click **Prioritize & Align Workspace** to activate my full-matrix planning!",
          timestamp: new Date().toISOString()
        }
      ];
      setChatMessages(initialMsgs);
      localStorage.setItem("deadlinezero_messages", JSON.stringify(initialMsgs));
    }

    if (savedAnalysis) {
      try {
        const parsed = JSON.parse(savedAnalysis) as AIAnalysis;
        setCriticalIds(parsed.criticalIds || []);
        setImportantIds(parsed.importantIds || []);
        setLowPriorityIds(parsed.lowPriorityIds || []);
        setAiSchedule(parsed.schedule || []);
        setTips(parsed.tips || []);
        setWarnings(parsed.warnings || []);
        setSummary(parsed.summary || "");
      } catch (e) {
        console.error("Could not parse saved analysis state", e);
      }
    }
  }, []);

  // Save tasks to localStorage when changed
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem("deadlinezero_tasks", JSON.stringify(newTasks));
  };

  // Save messages to localStorage
  const saveMessages = (newMsgs: ChatMessage[]) => {
    setChatMessages(newMsgs);
    localStorage.setItem("deadlinezero_messages", JSON.stringify(newMsgs));
  };

  // Trigger main AI Prioritization API call
  const handleAnalyzeWorkload = async (currentTasksList = tasks) => {
    if (currentTasksList.length === 0) {
      setApiError("Your workload board is currently empty. Add tasks or choose a preset first!");
      return;
    }

    setIsAnalyzing(true);
    setApiError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: currentTasksList,
          currentTime: TODAY_DATE
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data: AIAnalysis = await response.json();
      
      // Update states
      setCriticalIds(data.criticalIds);
      setImportantIds(data.importantIds);
      setLowPriorityIds(data.lowPriorityIds);
      setAiSchedule(data.schedule);
      setTips(data.tips);
      setWarnings(data.warnings);
      setSummary(data.summary);

      // Save analysis state
      localStorage.setItem("deadlinezero_analysis", JSON.stringify(data));

      // Append companion comment to chat automatically
      const helperMessage: ChatMessage = {
        id: `analysis-alert-${Date.now()}`,
        sender: "assistant",
        text: `✨ **Workspace Calibrated successfully!**\n\nI have prioritized your tasks using the Eisenhower Matrix. I categorized **${data.criticalIds.length}** as Critical (Do NOW) and designed a customized schedule starting from **${TODAY_DATE}**.\n\n${data.warnings.length > 0 ? `⚠️ **ALERT:** I flagged **${data.warnings.length}** deadline risks. Check the Warnings panel below.` : "✅ Your schedule is looking clean and risk-free!"}`,
        timestamp: new Date().toISOString()
      };
      saveMessages([...chatMessages, helperMessage]);

    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Something went wrong during AI analysis. Using local priority fallbacks instead.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handlers
  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'status'>) => {
    const freshTask: Task = {
      ...newTaskData,
      id: `task-${Date.now()}`,
      status: 'pending'
    };
    const updated = [...tasks, freshTask];
    saveTasks(updated);

    // Auto update chat to notify companion
    const updatedMsgs: ChatMessage[] = [
      ...chatMessages,
      {
        id: `add-notify-${Date.now()}`,
        sender: "assistant",
        text: `Added task: **"${newTaskData.title}"** (due ${newTaskData.deadline}, requiring ${newTaskData.duration}h).\n\nClick **Prioritize & Align Workspace** to recalculate the schedule!`,
        timestamp: new Date().toISOString()
      }
    ];
    saveMessages(updatedMsgs);
  };

  const handleToggleTaskStatus = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'completed' ? 'pending' as const : 'completed' as const };
      }
      return t;
    });
    saveTasks(updated);

    // Optionally re-trigger prioritize silently if AI has ran once
    const hasAiRan = aiSchedule.length > 0;
    if (hasAiRan) {
      handleAnalyzeWorkload(updated);
    }
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);

    // Filter out from quadrant lists
    setCriticalIds(prev => prev.filter(i => i !== id));
    setImportantIds(prev => prev.filter(i => i !== id));
    setLowPriorityIds(prev => prev.filter(i => i !== id));
    // Clean schedule
    setAiSchedule(prev => prev.map(day => ({
      ...day,
      tasks: day.tasks.filter(t => t.taskId !== id)
    })).filter(day => day.tasks.length > 0));
  };

  const handleLoadTemplate = (template: WorkloadTemplate) => {
    saveTasks(template.tasks);
    
    // Clear old messages and analysis
    const initialTplMsgs: ChatMessage[] = [
      {
        id: `tpl-load-${Date.now()}`,
        sender: "assistant",
        text: `Loaded preset workload: **${template.name}**.\n\nI am compiling task profiles now to calibrate your timeline. Give me a moment to prioritize...`,
        timestamp: new Date().toISOString()
      }
    ];
    saveMessages(initialTplMsgs);
    
    // Immediate AI priority calculation
    handleAnalyzeWorkload(template.tasks);
  };

  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `chat-user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toISOString()
    };
    
    const updatedMsgs = [...chatMessages, userMsg];
    saveMessages(updatedMsgs);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMsgs,
          tasks,
          currentTime: TODAY_DATE
        })
      });

      if (!response.ok) {
        throw new Error("Chat response failed");
      }

      const data = await response.json();
      
      const assistantMsg: ChatMessage = {
        id: `chat-asst-${Date.now()}`,
        sender: "assistant",
        text: data.text,
        timestamp: new Date().toISOString()
      };

      saveMessages([...updatedMsgs, assistantMsg]);
      return data;
    } catch (err) {
      console.error("Chat message error:", err);
      saveMessages([
        ...updatedMsgs,
        {
          id: `chat-error-${Date.now()}`,
          sender: "assistant",
          text: "My communications link stuttered. Could you re-send that?",
          timestamp: new Date().toISOString()
        }
      ]);
      return null;
    }
  };

  const handleApplyAdjustment = (adj: any) => {
    let updatedTasks = [...tasks];

    if (adj.type === 'update_task') {
      updatedTasks = tasks.map(t => {
        if (t.id === adj.taskId) {
          return {
            ...t,
            ...adj.taskData
          };
        }
        return t;
      });
    } else if (adj.type === 'create_task') {
      const created: Task = {
        id: `task-${Date.now()}`,
        title: adj.taskData?.title || "New Task from Chat",
        deadline: adj.taskData?.deadline || TODAY_DATE,
        duration: adj.taskData?.duration || 2,
        importance: adj.taskData?.importance || 'medium',
        impact: adj.taskData?.impact || "Mild progression block",
        status: 'pending'
      };
      updatedTasks.push(created);
    } else if (adj.type === 'delete_task') {
      updatedTasks = tasks.filter(t => t.id !== adj.taskId);
    }

    saveTasks(updatedTasks);
    // Re-run analyze to align everything
    handleAnalyzeWorkload(updatedTasks);
  };

  const handleResetBoard = () => {
    if (confirm("Are you sure you want to completely clear your workspace?")) {
      saveTasks([]);
      setCriticalIds([]);
      setImportantIds([]);
      setLowPriorityIds([]);
      setAiSchedule([]);
      setTips([]);
      setWarnings([]);
      setSummary("");
      const clearMsgs: ChatMessage[] = [
        {
          id: `clear-${Date.now()}`,
          sender: "assistant",
          text: "Workspace swept clean. Add some tasks manually or select an **Instant Preset** below to begin!",
          timestamp: new Date().toISOString()
        }
      ];
      saveMessages(clearMsgs);
      localStorage.removeItem("deadlinezero_analysis");
    }
  };

  // Stats calculation
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.length - completedCount;
  const totalHours = tasks.reduce((sum, t) => sum + (t.status === 'pending' ? t.duration : 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-800">
      
      {/* Top Notification bar */}
      <div className="bg-indigo-600 text-white text-xs py-2 px-4 font-semibold text-center flex items-center justify-center gap-2 relative">
        <Sparkles className="w-4 h-4 animate-spin" />
        <span>DeadlineZero workspace activated. Current target date set to <strong>{TODAY_DATE}</strong></span>
      </div>

      {/* Main Header Container */}
      <header className="max-w-7xl mx-auto px-4 pt-6 pb-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-3xs">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                DeadlineZero
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">Companion App</span>
              </h1>
              <p className="text-xs text-slate-500">Beat clock drifts. Schedule and crush workloads before deadlines collapse.</p>
            </div>
          </div>

          {/* Core App Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              id="analyze-workload-btn"
              onClick={() => handleAnalyzeWorkload()}
              disabled={isAnalyzing || tasks.length === 0}
              className={`flex-1 md:flex-initial px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                isAnalyzing
                  ? "bg-indigo-50 text-indigo-500 cursor-wait border border-indigo-100"
                  : tasks.length === 0
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md hover:scale-[1.01]"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
              {isAnalyzing ? "Calibrating Workspace..." : "Prioritize & Align Workspace"}
            </button>
            
            <button
              id="reset-board-btn"
              onClick={handleResetBoard}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-white border border-rose-100 hover:bg-rose-600 transition-all flex items-center justify-center gap-1.5"
            >
              Clear Slate
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 pb-12 flex flex-col gap-6">

        {/* Api Error Alerts */}
        {apiError && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">Analysis Notice</h4>
              <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">{apiError}</p>
            </div>
          </div>
        )}

        {/* Summary Block */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 text-slate-100 p-5 rounded-2xl shadow-lg border border-slate-800 flex gap-4 items-center"
          >
            <div className="bg-indigo-500/20 p-3 rounded-xl hidden sm:flex items-center justify-center">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                🗣️ DeadlineZero Coach Analysis
              </span>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-300 font-medium">
                &ldquo;{summary}&rdquo;
              </p>
            </div>
          </motion.div>
        )}

        {/* System Health Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
            <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tasks Completed</span>
              <span className="text-sm font-extrabold text-slate-800">{completedCount} of {tasks.length}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Workload</span>
              <span className="text-sm font-extrabold text-slate-800">{totalHours} Hours</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${warnings.length > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Alerts</span>
              <span className="text-sm font-extrabold text-slate-800">{warnings.length} Flagged</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-3xs flex items-center gap-3">
            <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Local Date target</span>
              <span className="text-sm font-extrabold text-slate-800">{TODAY_DATE}</span>
            </div>
          </div>
        </div>

        {/* Preset quickloads container */}
        <WorkloadPresets onSelectTemplate={handleLoadTemplate} todayStr={TODAY_DATE} />

        {/* Interactive Workspace (Split Panel Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Tasks Board (lg: 5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            <TaskList 
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTaskStatus={handleToggleTaskStatus}
              onDeleteTask={handleDeleteTask}
              todayStr={TODAY_DATE}
            />
          </section>

          {/* Right Column: AI Center (lg: 7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Split layout: Matrix and Chat side-by-side or stacked nicely */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Chat companion (md: 12 cols, stacked beautifully) */}
              <div className="md:col-span-12">
                <ChatCompanion 
                  messages={chatMessages}
                  onSendMessage={handleSendChatMessage}
                  tasks={tasks}
                  onApplyAdjustment={handleApplyAdjustment}
                  isAnalyzing={isAnalyzing}
                />
              </div>

              {/* Eisenhower grid */}
              <div className="md:col-span-12">
                <EisenhowerMatrix 
                  tasks={tasks}
                  criticalIds={criticalIds}
                  importantIds={importantIds}
                  lowPriorityIds={lowPriorityIds}
                  onToggleTaskStatus={handleToggleTaskStatus}
                  todayStr={TODAY_DATE}
                />
              </div>

            </div>

            {/* Daily Schedule Roadmap */}
            <ScheduleTimeline 
              tasks={tasks}
              aiSchedule={aiSchedule}
              onToggleTaskStatus={handleToggleTaskStatus}
              todayStr={TODAY_DATE}
            />

            {/* Warnings and Tips */}
            <TipsAndWarnings 
              warnings={warnings}
              tips={tips}
              tasksCount={tasks.length}
            />

          </section>

        </div>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white/40 py-6 text-center text-xs text-slate-400 font-medium">
        DeadlineZero App • Powered by Gemini AI Studio • Operational Workspace Time: {TODAY_DATE}
      </footer>

    </div>
  );
}
