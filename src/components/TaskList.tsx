import React, { useState } from "react";
import { Task } from "../types";
import { Plus, Trash2, Calendar, Clock, AlertCircle, CheckCircle, Circle, Sparkles, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TaskListProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'status'>) => void;
  onToggleTaskStatus: (id: string) => void;
  onDeleteTask: (id: string) => void;
  todayStr: string;
}

export default function TaskList({ tasks, onAddTask, onToggleTaskStatus, onDeleteTask, todayStr }: TaskListProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [duration, setDuration] = useState(2);
  const [importance, setImportance] = useState<'high' | 'medium' | 'low'>('medium');
  const [impact, setImpact] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Default next day for new task deadlines
  const getNextDayStr = () => {
    const next = new Date(todayStr || new Date());
    next.setDate(next.getDate() + 1);
    return next.toISOString().split("T")[0];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      deadline: deadline || getNextDayStr(),
      duration: Number(duration),
      importance,
      impact: impact.trim() || "Mild inconvenience / missed progression"
    });

    // Reset Form
    setTitle("");
    setDeadline("");
    setDuration(2);
    setImportance("medium");
    setImpact("");
    setIsOpen(false);
  };

  const getRelativeDays = (dateStr: string) => {
    const today = new Date(todayStr);
    today.setHours(0,0,0,0);
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    if (diffDays === -1) return "1 Day Overdue";
    if (diffDays < -1) return `${Math.abs(diffDays)} Days Overdue`;
    return `In ${diffDays} days`;
  };

  const getImportanceBadge = (imp: 'high' | 'medium' | 'low') => {
    switch (imp) {
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">🔴 High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">🟡 Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">🟢 Low</span>;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header and Toggle Add Task Form */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            📋 Workload Workspace
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
              {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
            </span>
          </h2>
          <p className="text-xs text-slate-500">Manage, prioritize, and adjust your pending duties.</p>
        </div>
        <button
          id="toggle-add-task-btn"
          onClick={() => setIsOpen(!isOpen)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
            isOpen 
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          }`}
        >
          {isOpen ? "Close" : "Add Task"}
          <Plus className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} />
        </button>
      </div>

      {/* Slide down Add Task Form */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm flex flex-col gap-4">
              <div className="border-b border-indigo-50 pb-2 mb-1">
                <span className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" /> Let&apos;s define a new target
                </span>
              </div>

              {/* Title input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Task Title</label>
                <input
                  id="task-title-input"
                  type="text"
                  required
                  placeholder="e.g. Finish history paper or Study for calculus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
                />
              </div>

              {/* Deadline & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Deadline Date
                  </label>
                  <input
                    id="task-deadline-input"
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={todayStr}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1 justify-between">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Time Commitment</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">{duration}h required</span>
                  </label>
                  <input
                    id="task-duration-slider"
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>1 hour</span>
                    <span>10 hours</span>
                    <span>20 hours</span>
                  </div>
                </div>
              </div>

              {/* Importance and Impact */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5 md:col-span-1">
                  <label className="text-xs font-semibold text-slate-700">Importance Rank</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                    {['low', 'medium', 'high'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setImportance(level as any)}
                        className={`py-1.5 text-xs font-semibold capitalize rounded-md transition-all ${
                          importance === level
                            ? level === 'high'
                              ? "bg-rose-500 text-white shadow-xs"
                              : level === 'medium'
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-emerald-500 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> What is the negative consequence if missed?
                  </label>
                  <input
                    id="task-impact-input"
                    type="text"
                    placeholder="e.g. Will lose 15% of project grade, client will walk away"
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Submit btn */}
              <button
                id="submit-task-btn"
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow-xs flex items-center justify-center gap-2"
              >
                Create Task Target
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task List Items */}
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
            <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No tasks on your board</h3>
            <p className="text-xs text-slate-400 max-w-[280px] mt-1">
              Add a custom task using the button above or select a Quick Workload Preset to populate immediately.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {tasks.map((task) => {
              const isCompleted = task.status === "completed";
              return (
                <motion.div
                  key={task.id}
                  layoutId={`task-card-${task.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group relative p-4 rounded-xl border transition-all duration-200 flex items-start gap-3 bg-white ${
                    isCompleted 
                      ? "border-slate-100 opacity-60 bg-slate-50/20" 
                      : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  {/* Status Toggle Box */}
                  <button
                    id={`toggle-status-btn-${task.id}`}
                    onClick={() => onToggleTaskStatus(task.id)}
                    className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-indigo-600 fill-indigo-50" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  {/* Task details */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold text-slate-800 tracking-tight truncate ${isCompleted ? "line-through text-slate-400" : ""}`}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1">
                        {getImportanceBadge(task.importance)}
                      </div>
                    </div>

                    {/* Metadata line */}
                    <div className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium flex-wrap mt-0.5">
                      <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-xs font-mono text-[10px]">
                        <Clock className="w-3 h-3" /> {task.duration}h needed
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" /> {task.deadline} ({getRelativeDays(task.deadline)})
                      </span>
                    </div>

                    {/* Consequence if missed */}
                    {task.impact && !isCompleted && (
                      <p className="text-xs text-slate-500 italic mt-1.5 flex items-start gap-1 bg-rose-50/40 p-2 rounded-md border border-rose-100/30">
                        <span className="font-semibold text-rose-600/80 uppercase tracking-widest text-[9px] mt-0.5 min-w-[34px]">Risk:</span>
                        <span className="text-slate-600 line-clamp-2">{task.impact}</span>
                      </p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    id={`delete-task-btn-${task.id}`}
                    onClick={() => onDeleteTask(task.id)}
                    className="text-slate-400 hover:text-rose-500 p-1 rounded-md hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
