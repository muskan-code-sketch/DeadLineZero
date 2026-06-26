export interface Task {
  id: string;
  title: string;
  deadline: string; // YYYY-MM-DD
  duration: number; // in hours
  importance: 'high' | 'medium' | 'low';
  impact: string; // What happens if missed
  status: 'pending' | 'completed';
  notes?: string;
}

export interface AIScheduleItem {
  date: string; // YYYY-MM-DD or readable day
  tasks: {
    taskId: string;
    taskTitle: string;
    allocatedHours: number;
    notes: string;
  }[];
}

export interface AIWarning {
  taskId: string;
  taskTitle: string;
  message: string;
  severity: 'danger' | 'warning';
}

export interface AIAnalysis {
  criticalIds: string[];    // Do Now
  importantIds: string[];   // Schedule It
  lowPriorityIds: string[]; // Do Later
  schedule: AIScheduleItem[];
  tips: string[];
  warnings: AIWarning[];
  summary: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
