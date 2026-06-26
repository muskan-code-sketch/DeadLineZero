import React from "react";
import { Task } from "../types";
import { motion } from "motion/react";
import { Zap, Calendar, Shuffle, Flame } from "lucide-react";

interface EisenhowerMatrixProps {
  tasks: Task[];
  criticalIds: string[];
  importantIds: string[];
  lowPriorityIds: string[];
  onToggleTaskStatus: (id: string) => void;
  todayStr: string;
}

interface TaskItemProps {
  task: Task;
  bgHover: string;
  onToggleTaskStatus: (id: string) => void;
  getRelativeDays: (dateStr: string) => string;
  key?: any;
}

const TaskItem = ({ task, bgHover, onToggleTaskStatus, getRelativeDays }: TaskItemProps) => {
  const isCompleted = task.status === "completed";
  return (
    <div 
      onClick={() => onToggleTaskStatus(task.id)}
      className={`flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-white shadow-3xs cursor-pointer transition-all duration-150 ${bgHover} ${
        isCompleted ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={() => {}} // handled by div click
          className="rounded-xs border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 pointer-events-none"
        />
        <span className={`text-xs font-semibold text-slate-700 truncate ${isCompleted ? "line-through text-slate-400 font-normal" : ""}`}>
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <span className="text-[9px] font-bold font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded-sm">
          {task.duration}h
        </span>
        <span className={`text-[9px] font-bold px-1 py-0.5 rounded-sm ${
          getRelativeDays(task.deadline) === 'Overdue' 
            ? "bg-rose-50 text-rose-600" 
            : getRelativeDays(task.deadline) === 'Today' 
            ? "bg-amber-50 text-amber-600" 
            : "bg-slate-100 text-slate-500"
        }`}>
          {getRelativeDays(task.deadline)}
        </span>
      </div>
    </div>
  );
};

export default function EisenhowerMatrix({
  tasks,
  criticalIds,
  importantIds,
  lowPriorityIds,
  onToggleTaskStatus,
  todayStr
}: EisenhowerMatrixProps) {

  const getRelativeDays = (dateStr: string) => {
    const today = new Date(todayStr);
    today.setHours(0,0,0,0);
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 0) return "Overdue";
    return `${diffDays}d left`;
  };

  // Smart local fallback if AI hasn't categorized yet
  const getCategorizedTasks = () => {
    const isAiCategorized = criticalIds.length > 0 || importantIds.length > 0 || lowPriorityIds.length > 0;

    if (isAiCategorized) {
      const q1 = tasks.filter(t => criticalIds.includes(t.id));
      const q2 = tasks.filter(t => importantIds.includes(t.id));
      
      const lowPriorityTasks = tasks.filter(t => lowPriorityIds.includes(t.id));
      const q3: Task[] = [];
      const q4: Task[] = [];

      lowPriorityTasks.forEach(t => {
        const d = new Date(t.deadline);
        const today = new Date(todayStr);
        const diffDays = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 2) {
          q3.push(t);
        } else {
          q4.push(t);
        }
      });

      // Any remaining tasks that weren't categorized by AI
      tasks.forEach(t => {
        if (!criticalIds.includes(t.id) && !importantIds.includes(t.id) && !lowPriorityIds.includes(t.id)) {
          if (t.importance === 'high') {
            q1.push(t);
          } else if (t.importance === 'medium') {
            q2.push(t);
          } else {
            q4.push(t);
          }
        }
      });

      return { q1, q2, q3, q4, isAi: true };
    } else {
      // Local Fallback Categorization Logic
      const q1: Task[] = [];
      const q2: Task[] = [];
      const q3: Task[] = [];
      const q4: Task[] = [];

      tasks.forEach(t => {
        const d = new Date(t.deadline);
        const today = new Date(todayStr);
        const diffDays = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

        const isUrgent = diffDays <= 2;
        const isImportant = t.importance === 'high' || t.importance === 'medium';

        if (isUrgent && isImportant) {
          q1.push(t);
        } else if (!isUrgent && isImportant) {
          q2.push(t);
        } else if (isUrgent && !isImportant) {
          q3.push(t);
        } else {
          q4.push(t);
        }
      });

      return { q1, q2, q3, q4, isAi: false };
    }
  };

  const { q1, q2, q3, q4, isAi } = getCategorizedTasks();

  const QuadrantHeader = ({ title, subtitle, colorClass, badgeColor, icon: Icon, count }: any) => (
    <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
      <div>
        <h4 className="font-bold text-xs text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
          <span className={`w-2 h-2 rounded-full ${badgeColor}`}></span>
          {title}
        </h4>
        <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-md border border-slate-100">
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        <span className="text-[11px] font-bold text-slate-700">{count}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-4">
      {/* Grid Banner */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            🎯 Eisenhower Priority Matrix
            {isAi ? (
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                ✨ AI Calibrated
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                🔍 Local Guess
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Tasks categorized by urgency and importance.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> Do First</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Schedule</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-400 rounded-full"></span> Delegate</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Defer</div>
        </div>
      </div>

      {/* 2x2 Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Q1: Do First */}
        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-rose-50/20 border border-rose-100 p-4 rounded-xl flex flex-col gap-2 min-h-[170px]"
        >
          <QuadrantHeader 
            title="Q1: Do NOW" 
            subtitle="Urgent & Important" 
            colorClass="text-rose-500" 
            badgeColor="bg-rose-500"
            icon={Flame} 
            count={q1.length}
          />
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
            {q1.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No critical tasks. Nice job!</div>
            ) : (
              q1.map(t => (
                <TaskItem 
                  key={t.id} 
                  task={t} 
                  bgHover="hover:bg-rose-50/35" 
                  onToggleTaskStatus={onToggleTaskStatus}
                  getRelativeDays={getRelativeDays}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Q2: Schedule */}
        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-amber-50/20 border border-amber-100 p-4 rounded-xl flex flex-col gap-2 min-h-[170px]"
        >
          <QuadrantHeader 
            title="Q2: Schedule It" 
            subtitle="Not Urgent but Important" 
            colorClass="text-amber-500" 
            badgeColor="bg-amber-500"
            icon={Calendar} 
            count={q2.length}
          />
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
            {q2.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No scheduled tasks pending.</div>
            ) : (
              q2.map(t => (
                <TaskItem 
                  key={t.id} 
                  task={t} 
                  bgHover="hover:bg-amber-50/35" 
                  onToggleTaskStatus={onToggleTaskStatus}
                  getRelativeDays={getRelativeDays}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Q3: Delegate / Low Priority (Urgent, but low importance) */}
        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-blue-50/20 border border-blue-100 p-4 rounded-xl flex flex-col gap-2 min-h-[170px]"
        >
          <QuadrantHeader 
            title="Q3: Focus Next" 
            subtitle="Urgent but Less Critical" 
            colorClass="text-blue-500" 
            badgeColor="bg-blue-400"
            icon={Zap} 
            count={q3.length}
          />
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
            {q3.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">Clear from immediate noise.</div>
            ) : (
              q3.map(t => (
                <TaskItem 
                  key={t.id} 
                  task={t} 
                  bgHover="hover:bg-blue-50/35" 
                  onToggleTaskStatus={onToggleTaskStatus}
                  getRelativeDays={getRelativeDays}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Q4: Eliminate / Do Later (Not Urgent & Low Importance) */}
        <motion.div 
          whileHover={{ scale: 1.005 }}
          className="bg-emerald-50/10 border border-emerald-100 p-4 rounded-xl flex flex-col gap-2 min-h-[170px]"
        >
          <QuadrantHeader 
            title="Q4: Do Later" 
            subtitle="Not Urgent & Low Priority" 
            colorClass="text-emerald-500" 
            badgeColor="bg-emerald-500"
            icon={Shuffle} 
            count={q4.length}
          />
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
            {q4.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">No trivial items listed.</div>
            ) : (
              q4.map(t => (
                <TaskItem 
                  key={t.id} 
                  task={t} 
                  bgHover="hover:bg-emerald-50/25" 
                  onToggleTaskStatus={onToggleTaskStatus}
                  getRelativeDays={getRelativeDays}
                />
              ))
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
