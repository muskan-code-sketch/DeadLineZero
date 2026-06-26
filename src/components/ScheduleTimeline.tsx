import React from "react";
import { Task, AIScheduleItem } from "../types";
import { CalendarDays, Clock, Check, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface ScheduleTimelineProps {
  tasks: Task[];
  aiSchedule: AIScheduleItem[];
  onToggleTaskStatus: (id: string) => void;
  todayStr: string;
}

export default function ScheduleTimeline({
  tasks,
  aiSchedule,
  onToggleTaskStatus,
  todayStr
}: ScheduleTimelineProps) {

  // Generate fallback schedule if AI hasn't made one yet
  const getFallbackSchedule = (): AIScheduleItem[] => {
    if (tasks.length === 0) return [];

    // Sort tasks by deadline
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    
    // Group tasks by deadline
    const groups: { [date: string]: typeof sortedTasks } = {};
    sortedTasks.forEach(task => {
      if (!groups[task.deadline]) {
        groups[task.deadline] = [];
      }
      groups[task.deadline].push(task);
    });

    // Map to AIScheduleItem array
    return Object.keys(groups).sort().map(date => ({
      date,
      tasks: groups[date].map(t => ({
        taskId: t.id,
        taskTitle: t.title,
        allocatedHours: t.duration,
        notes: `Focus on making steady progress. Due date is ${date}.`
      }))
    }));
  };

  const currentSchedule = aiSchedule.length > 0 ? aiSchedule : getFallbackSchedule();

  const getReadableDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getRelativeDayName = (dateStr: string) => {
    const today = new Date(todayStr);
    today.setHours(0,0,0,0);
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1) return `In ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  };

  const getLoadIndicator = (hours: number) => {
    if (hours === 0) return { label: "No tasks", color: "bg-slate-100 text-slate-500", bar: "bg-slate-200" };
    if (hours <= 3) return { label: "Light Load", color: "bg-emerald-50 text-emerald-700 border-emerald-100", bar: "bg-emerald-500" };
    if (hours <= 6) return { label: "Moderate", color: "bg-amber-50 text-amber-700 border-amber-100", bar: "bg-amber-500" };
    return { label: "Heavy / Overload", color: "bg-rose-50 text-rose-700 border-rose-100 animate-pulse", bar: "bg-rose-500" };
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            📅 Suggested Day-by-Day Roadmap
            {aiSchedule.length > 0 ? (
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                ✨ AI Calibrated
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                ⏳ Basic Timeline
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">Chronological daily work allocation designed to beat the clock.</p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Add tasks to generate your custom timeline schedule.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-100 ml-4 pl-6 flex flex-col gap-6 my-2">
          {currentSchedule.map((dayPlan, dayIdx) => {
            // Find completed tasks count for this day
            const dayTasksWithDetails = dayPlan.tasks.map(scheduleTask => {
              const fullTask = tasks.find(t => t.id === scheduleTask.taskId);
              return {
                ...scheduleTask,
                isCompleted: fullTask ? fullTask.status === "completed" : false,
                fullTask
              };
            });

            const totalHours = dayTasksWithDetails.reduce((acc, t) => acc + (t.isCompleted ? 0 : t.allocatedHours), 0);
            const load = getLoadIndicator(totalHours);
            const allDone = dayTasksWithDetails.length > 0 && dayTasksWithDetails.every(t => t.isCompleted);

            return (
              <div key={dayPlan.date} className="relative">
                {/* Timeline node circle */}
                <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white transition-all duration-200 ${
                  allDone 
                    ? "border-emerald-500 bg-emerald-50 text-emerald-500 flex items-center justify-center" 
                    : totalHours > 6 
                    ? "border-rose-500 bg-rose-50" 
                    : "border-slate-300"
                }`}>
                  {allDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>

                {/* Day Header */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h4 className="font-bold text-sm text-slate-800 tracking-tight">
                    {getReadableDate(dayPlan.date)}
                  </h4>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {getRelativeDayName(dayPlan.date)}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${load.color}`}>
                    {load.label} ({totalHours}h)
                  </span>
                </div>

                {/* Tasks List for Day */}
                <div className="flex flex-col gap-2.5">
                  {dayTasksWithDetails.map((item, taskIdx) => {
                    const hasStatus = !!item.fullTask;
                    return (
                      <motion.div
                        whileHover={{ x: 2 }}
                        key={`${dayPlan.date}-${item.taskId}-${taskIdx}`}
                        onClick={() => item.fullTask && onToggleTaskStatus(item.taskId)}
                        className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                          item.isCompleted 
                            ? "bg-slate-50/40 border-slate-100 opacity-50" 
                            : totalHours > 6 
                            ? "bg-white border-rose-100 hover:border-rose-200"
                            : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-3xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* Checkmark indicator */}
                            <div className="mt-0.5">
                              {item.isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`text-xs font-bold text-slate-700 block truncate ${item.isCompleted ? "line-through text-slate-400 font-normal" : ""}`}>
                                {item.taskTitle}
                              </span>
                              
                              {/* Daily notes from DeadlineZero */}
                              {item.notes && !item.isCompleted && (
                                <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                                  <span className="text-indigo-500 font-bold shrink-0">✨ tip:</span>
                                  <span>{item.notes}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Allocated Hours badge */}
                          <div className="flex flex-col items-end gap-1 font-mono shrink-0">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" /> {item.allocatedHours}h
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar indicator */}
                        {!item.isCompleted && (
                          <div className="mt-2 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${load.bar}`} 
                              style={{ width: `${Math.min((item.allocatedHours / 8) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
