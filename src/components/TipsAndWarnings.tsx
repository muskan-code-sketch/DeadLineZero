import React from "react";
import { AIWarning } from "../types";
import { AlertTriangle, Lightbulb, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";

interface TipsAndWarningsProps {
  warnings: AIWarning[];
  tips: string[];
  tasksCount: number;
}

export default function TipsAndWarnings({ warnings, tips, tasksCount }: TipsAndWarningsProps) {
  // Local default tips if AI hasn't run yet
  const defaultTips = [
    "Focus on single-tasking. Multitasking splits your cognitive capacity and increases error rates by up to 40%.",
    "Use the 50-10 Pomodoro block: Work focused for 50 minutes, then completely disconnect for 10 minutes.",
    "Prioritize Q1 (Urgent + Important) tasks immediately when your energy level is highest in the morning."
  ];

  const currentTips = tips.length > 0 ? tips : defaultTips;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Warnings Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Critical Alerts & Risk Vectors
        </h3>

        {tasksCount === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl">
            No active workload to assess. Add tasks above.
          </div>
        ) : warnings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4 bg-emerald-50/40 border border-emerald-100 rounded-xl gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <div>
              <h4 className="text-xs font-bold text-emerald-900">Zero Critical Risks Detetcted</h4>
              <p className="text-[11px] text-emerald-600 mt-0.5">Your current timeline has sufficient safety margins. Keep pushing!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px]">
            {warnings.map((warn, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border text-xs flex gap-2.5 items-start ${
                  warn.severity === 'danger'
                    ? "bg-rose-50 text-rose-800 border-rose-100"
                    : "bg-amber-50 text-amber-800 border-amber-100"
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${warn.severity === 'danger' ? 'text-rose-500' : 'text-amber-500'}`} />
                <div>
                  <span className="font-bold block text-slate-800 tracking-tight mb-0.5">{warn.taskTitle || "Task Alert"}</span>
                  <p className="leading-relaxed text-slate-600">{warn.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Personalized Tips Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-indigo-500" />
          💡 Personalized Productivity Advice
        </h3>

        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[220px]">
          {currentTips.map((tip, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-3 bg-indigo-50/20 border border-indigo-50 rounded-lg text-xs flex gap-2.5 items-start"
            >
              <div className="bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-xs text-[9px] font-mono shrink-0 mt-0.5">
                0{idx + 1}
              </div>
              <p className="leading-relaxed text-slate-600 font-medium">{tip}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
