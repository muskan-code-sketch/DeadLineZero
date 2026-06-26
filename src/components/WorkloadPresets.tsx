import React from "react";
import { getWorkloadTemplates, WorkloadTemplate } from "../data/templates";
import { GraduationCap, Rocket, Home, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface WorkloadPresetsProps {
  onSelectTemplate: (template: WorkloadTemplate) => void;
  todayStr: string;
}

export default function WorkloadPresets({ onSelectTemplate, todayStr }: WorkloadPresetsProps) {
  const templates = getWorkloadTemplates(todayStr);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "graduation-cap":
        return <GraduationCap className="w-5 h-5 text-indigo-600" />;
      case "rocket":
        return <Rocket className="w-5 h-5 text-indigo-600" />;
      case "home":
        return <Home className="w-5 h-5 text-indigo-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          🚀 Instant Workload Presets
        </h3>
        <p className="text-xs text-slate-500">Select a pre-configured scenario to test DeadlineZero instantly.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {templates.map((tpl) => (
          <motion.div
            key={tpl.name}
            whileHover={{ y: -2, borderColor: "rgba(79, 70, 229, 0.3)" }}
            onClick={() => onSelectTemplate(tpl)}
            className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/20 hover:bg-white cursor-pointer transition-all duration-150 flex flex-col gap-1.5 shadow-3xs"
          >
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50 p-1.5 rounded-lg border border-indigo-100/40">
                {getIcon(tpl.icon)}
              </div>
              <h4 className="font-bold text-xs text-slate-800 leading-tight">
                {tpl.name}
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {tpl.description}
            </p>
            <div className="mt-1 text-[10px] font-bold font-mono text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded-sm self-start">
              {tpl.tasks.length} Pre-filled Tasks
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
