import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Create Express app
const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// =====================================================================
// Local Smart Heuristic Fallback Engines (Keyless Execution Support)
// =====================================================================

interface HeuristicTask {
  id: string;
  title: string;
  deadline?: string;
  duration?: number;
  importance?: string;
  impact?: string;
  status?: string;
}

interface HeuristicWarningMessage {
  taskId: string;
  taskTitle: string;
  message: string;
  severity: "danger" | "warning";
}

interface HeuristicTaskAllocation {
  taskId: string;
  taskTitle: string;
  allocatedHours: number;
  notes: string;
}

interface HeuristicDailySchedule {
  date: string;
  tasks: HeuristicTaskAllocation[];
}

interface HeuristicAnalysisResponse {
  criticalIds: string[];
  importantIds: string[];
  lowPriorityIds: string[];
  schedule: HeuristicDailySchedule[];
  tips: string[];
  warnings: HeuristicWarningMessage[];
  summary: string;
}

function runLocalHeuristicAnalysis(tasks: HeuristicTask[], currentTimeStr?: string): HeuristicAnalysisResponse {
  let today = new Date();
  if (currentTimeStr) {
    const parsed = Date.parse(currentTimeStr);
    if (!isNaN(parsed)) {
      today = new Date(parsed);
    }
  }
  today.setHours(0, 0, 0, 0);

  const criticalIds: string[] = [];
  const importantIds: string[] = [];
  const lowPriorityIds: string[] = [];
  const warnings: HeuristicWarningMessage[] = [];

  const pendingTasks: {
    id: string;
    title: string;
    deadlineDate: Date | null;
    duration: number;
    importance: string;
  }[] = [];

  for (const t of tasks) {
    if (!t || !t.id) continue;
    const taskId = String(t.id);
    const title = t.title || "Untitled Task";
    const importance = (t.importance || "medium").toLowerCase();
    const status = (t.status || "pending").toLowerCase();
    const deadlineStr = t.deadline || "";
    const duration = Number(t.duration) || 0;

    let deadlineDate: Date | null = null;
    if (deadlineStr) {
      const parsed = Date.parse(deadlineStr);
      if (!isNaN(parsed)) {
        deadlineDate = new Date(parsed);
        deadlineDate.setHours(0, 0, 0, 0);
      }
    }

    // Eisenhower Matrix quadrants
    if (importance === "high") {
      if (deadlineDate && (deadlineDate.getTime() - today.getTime()) <= 3 * 24 * 60 * 60 * 1000) {
        criticalIds.push(taskId);
      } else {
        importantIds.push(taskId);
      }
    } else if (importance === "medium") {
      if (deadlineDate && (deadlineDate.getTime() - today.getTime()) <= 2 * 24 * 60 * 60 * 1000) {
        criticalIds.push(taskId);
      } else if (deadlineDate && (deadlineDate.getTime() - today.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
        importantIds.push(taskId);
      } else {
        lowPriorityIds.push(taskId);
      }
    } else {
      if (deadlineDate && (deadlineDate.getTime() - today.getTime()) <= 1 * 24 * 60 * 60 * 1000) {
        criticalIds.push(taskId);
      } else {
        lowPriorityIds.push(taskId);
      }
    }

    if (status !== "completed") {
      pendingTasks.push({
        id: taskId,
        title,
        deadlineDate,
        duration,
        importance
      });
    }
  }

  // Sort pending tasks by urgency
  pendingTasks.sort((a, b) => {
    if (!a.deadlineDate) return 1;
    if (!b.deadlineDate) return -1;
    return a.deadlineDate.getTime() - b.deadlineDate.getTime();
  });

  const scheduleDays: {
    dateStr: string;
    dateObj: Date;
    tasks: HeuristicTaskAllocation[];
    allocatedHours: number;
  }[] = [];

  for (let i = 0; i < 10; i++) {
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + i);
    const yyyy = nextDay.getFullYear();
    const mm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDay.getDate()).padStart(2, '0');
    scheduleDays.push({
      dateStr: `${yyyy}-${mm}-${dd}`,
      dateObj: nextDay,
      tasks: [],
      allocatedHours: 0
    });
  }

  for (const pt of pendingTasks) {
    const taskId = pt.id;
    const title = pt.title;
    const deadlineDate = pt.deadlineDate;
    const duration = pt.duration;

    let targetDays: typeof scheduleDays = [];
    if (!deadlineDate) {
      targetDays = [scheduleDays[0]];
    } else {
      targetDays = scheduleDays.filter(d => d.dateObj.getTime() <= deadlineDate.getTime());
      if (targetDays.length === 0) {
        const yyyy = deadlineDate.getFullYear();
        const mm = String(deadlineDate.getMonth() + 1).padStart(2, '0');
        const dd = String(deadlineDate.getDate()).padStart(2, '0');
        warnings.push({
          taskId,
          taskTitle: title,
          message: `Overdue! Deadline was on ${yyyy}-${mm}-${dd}, but the task remains pending.`,
          severity: "danger"
        });
        targetDays = [scheduleDays[0]];
      }
    }

    let hoursToAllocate = duration;
    for (const day of targetDays) {
      if (hoursToAllocate <= 0) break;
      const daySpace = Math.max(0, 6.0 - day.allocatedHours);
      if (daySpace > 0) {
        const alloc = Math.min(hoursToAllocate, daySpace, 4.0);
        if (alloc > 0) {
          day.tasks.push({
            taskId,
            taskTitle: title,
            allocatedHours: Math.round(alloc * 10) / 10,
            notes: `Allocate ${Math.round(alloc * 10) / 10}h block to lock down key deliverables.`
          });
          day.allocatedHours += alloc;
          hoursToAllocate -= alloc;
        }
      }
    }

    if (hoursToAllocate > 0) {
      for (const day of targetDays) {
        if (hoursToAllocate <= 0) break;
        const alloc = hoursToAllocate;
        day.tasks.push({
          taskId,
          taskTitle: title,
          allocatedHours: Math.round(alloc * 10) / 10,
          notes: `Intense focus required! Dedicated push to clear this work segment.`
        });
        day.allocatedHours += alloc;
        hoursToAllocate = 0;
      }
    }
  }

  const finalSchedule: HeuristicDailySchedule[] = scheduleDays
    .filter(d => d.tasks.length > 0)
    .map(d => ({
      date: d.dateStr,
      tasks: d.tasks
    }));

  for (const pt of pendingTasks) {
    if (pt.deadlineDate) {
      const diffDays = Math.ceil((pt.deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays < 0) {
        continue;
      } else if (diffDays === 0) {
        warnings.push({
          taskId: pt.id,
          taskTitle: pt.title,
          message: "Due today! Pause secondary activities and finish this task immediately.",
          severity: "danger"
        });
      } else if (diffDays > 0 && pt.duration > (diffDays * 8)) {
        warnings.push({
          taskId: pt.id,
          taskTitle: pt.title,
          message: `Requires ${pt.duration} hours but only ${diffDays} days left. Extremely tight timeline!`,
          severity: "danger"
        });
      } else if (diffDays <= 2) {
        warnings.push({
          taskId: pt.id,
          taskTitle: pt.title,
          message: `Deadline approaching quickly in ${diffDays} days.`,
          severity: "warning"
        });
      }
    }
  }

  for (const day of scheduleDays) {
    if (day.allocatedHours > 6.0) {
      warnings.push({
        taskId: "schedule_overload",
        taskTitle: `Planned Day: ${day.dateStr}`,
        message: `Total workload planned for ${day.dateStr} is ${Math.round(day.allocatedHours * 10) / 10} hours. This is heavily congested!`,
        severity: "warning"
      });
    }
  }

  const tips = [
    "Prune your low-priority tasks: If it's in the Low Priority quadrant, delay or delete it to regain focus.",
    "Eat the frog: Work on your Critical tasks first thing in the morning when your energy levels are highest.",
    "The 25-minute block: Use a Pomodoro timer (25 mins work, 5 mins break) to maintain high mental stamina."
  ];

  let summary = "Hello! I am your companion DeadlineZero. ";
  if (tasks.length === 0) {
    summary += "Your workspace is currently clear. Add some tasks with deadlines to get started!";
  } else {
    const completedCount = tasks.filter(t => t.status === "completed").length;
    const pendingCount = tasks.length - completedCount;
    summary += `I have mapped out your ${tasks.length} tasks. You have achieved ${completedCount} completions and have ${pendingCount} pending items remaining. `;
    if (criticalIds.length > 0) {
      summary += `Focus closely on the ${criticalIds.length} items in your Critical quadrant to eliminate risks.`;
    } else {
      summary += `Your Critical quadrant is entirely clean! Great job staying ahead.`;
    }
  }

  return {
    criticalIds,
    importantIds,
    lowPriorityIds,
    schedule: finalSchedule,
    tips,
    warnings,
    summary
  };
}

interface HeuristicChatResponse {
  text: string;
  suggestedAdjustments?: {
    type: string;
    taskId?: string;
    taskData?: Partial<HeuristicTask>;
    reason?: string;
  }[];
}

function runLocalHeuristicChat(messages: { sender: string; text: string }[], tasks: HeuristicTask[]): HeuristicChatResponse {
  let userMsg = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === "user") {
      userMsg = (messages[i].text || "").toLowerCase();
      break;
    }
  }

  const suggestedAdjustments: HeuristicChatResponse["suggestedAdjustments"] = [];
  let textReply = "";

  if (userMsg.includes("add") || userMsg.includes("create") || userMsg.includes("new task")) {
    let title = "New Task";
    if (userMsg.includes("add task")) {
      const parts = userMsg.split("add task");
      if (parts[1] && parts[1].trim()) title = parts[1].trim();
    } else if (userMsg.includes("add")) {
      const parts = userMsg.split("add");
      if (parts[1] && parts[1].trim()) title = parts[1].trim();
    }

    title = title.replace(/\b(tomorrow|today)\b/g, "").trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);

    suggestedAdjustments.push({
      type: "create_task",
      taskData: {
        title,
        importance: "medium",
        duration: 2.0,
        status: "pending"
      },
      reason: `Created new task '${title}' based on your chat message.`
    });
    textReply = `I've set up a suggestion to create the task **"${title}"** with standard settings. You can review and confirm it in the main dashboard!`;

  } else if (userMsg.includes("complete") || userMsg.includes("done") || userMsg.includes("finish")) {
    let matchedTask: HeuristicTask | null = null;
    for (const t of tasks) {
      if (!t) continue;
      const tTitle = (t.title || "").toLowerCase();
      const tId = String(t.id).toLowerCase();
      if (userMsg.includes(tTitle) || userMsg.includes(tId)) {
        matchedTask = t;
        break;
      }
    }

    if (matchedTask) {
      suggestedAdjustments.push({
        type: "update_task",
        taskId: matchedTask.id,
        taskData: {
          status: "completed"
        },
        reason: `Marked task '${matchedTask.title}' as completed!`
      });
      textReply = `Excellent progress! I've marked your task **"${matchedTask.title}"** as completed. Keep up the high performance!`;
    } else {
      if (tasks.length > 0) {
        const firstPending = tasks.find(t => t.status !== "completed") || tasks[0];
        suggestedAdjustments.push({
          type: "update_task",
          taskId: firstPending.id,
          taskData: {
            status: "completed"
          },
          reason: `Marked active task '${firstPending.title}' as completed.`
        });
        textReply = `I assumed you meant your active task **"${firstPending.title}"**, so I've suggested marking it as completed. Great job!`;
      } else {
        textReply = "Which task would you like me to mark as done? I don't see any matching tasks in your current list!";
      }
    }

  } else if (userMsg.includes("delete") || userMsg.includes("remove")) {
    let matchedTask: HeuristicTask | null = null;
    for (const t of tasks) {
      if (!t) continue;
      const tTitle = (t.title || "").toLowerCase();
      const tId = String(t.id).toLowerCase();
      if (userMsg.includes(tTitle) || userMsg.includes(tId)) {
        matchedTask = t;
        break;
      }
    }

    if (matchedTask) {
      suggestedAdjustments.push({
        type: "delete_task",
        taskId: matchedTask.id,
        reason: `Removed the task '${matchedTask.title}'.`
      });
      textReply = `Understood. I've suggested removing the task **"${matchedTask.title}"** from your active workspace.`;
    } else {
      textReply = "Which task would you like me to delete? Please specify the name or ID from your task list.";
    }

  } else if (userMsg.includes("delay") || userMsg.includes("push") || userMsg.includes("postpone") || userMsg.includes("extend")) {
    let matchedTask: HeuristicTask | null = null;
    for (const t of tasks) {
      if (!t) continue;
      const tTitle = (t.title || "").toLowerCase();
      if (userMsg.includes(tTitle)) {
        matchedTask = t;
        break;
      }
    }

    if (matchedTask) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const yyyy = futureDate.getFullYear();
      const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
      const dd = String(futureDate.getDate()).padStart(2, '0');
      const newDeadline = `${yyyy}-${mm}-${dd}`;

      suggestedAdjustments.push({
        type: "update_task",
        taskId: matchedTask.id,
        taskData: {
          deadline: newDeadline
        },
        reason: "Postponed task deadline to relieve immediate pressure."
      });
      textReply = `No problem! I've suggested pushing the deadline for **"${matchedTask.title}"** back by 3 days (to ${newDeadline}) to give you some extra breathing room.`;
    } else {
      textReply = "Which task would you like to push back? Specify the task title so I can reschedule it.";
    }

  } else {
    textReply = `Hey! I'm **DeadlineZero**, your productivity assistant. 

I can help you prioritize your tasks, warn you about tight deadlines, and even automate your list adjustments. Try saying:
- *"Add task Design mockups"*
- *"Mark task Complete math homework"*
- *"Delete study session"*

Tell me what you're working on, and let's keep your workflow optimized!`;
  }

  return {
    text: textReply,
    suggestedAdjustments
  };
}

// 1. Analyze Task List Endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { tasks, currentTime } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Missing or invalid tasks array" });
    }

    // Checking API Key presence upfront for immediate fallback
    if (!process.env.GEMINI_API_KEY) {
      console.log("GEMINI_API_KEY is not defined. Using local smart heuristics.");
      const fallbackResult = runLocalHeuristicAnalysis(tasks, currentTime);
      return res.json(fallbackResult);
    }

    try {
      const ai = getGenAI();

      // Compile tasks representation
      const tasksString = tasks.map(t => (
        `- Task ID: ${t.id}
  Title: "${t.title}"
  Deadline: ${t.deadline}
  Estimated Duration: ${t.duration} hours
  Importance: ${t.importance}
  Consequence of failure: "${t.impact || 'None specified'}"
  Status: ${t.status}`
      )).join("\n\n");

      const systemInstruction = `You are "DeadlineZero", a high-performance, direct, motivating, and friendly productivity companion.
Your job is to analyze the user's workload, prioritize tasks using the Eisenhower Matrix, generate a realistic day-by-day plan, warn about tight windows, and provide tailored actionable tips.

Current Local Time: ${currentTime || new Date().toISOString()}

Follow these Eisenhower Matrix mapping rules:
- Critical (Do NOW) - Urgent + Important. High importance and close deadline.
- Important (Schedule it) - Important but not urgent. High or Medium importance with a further deadline.
- Low Priority (Do later) - Urgent but Less Important, or neither. Medium/Low importance, or easily deferrable.

You must schedule tasks day-by-day starting from the current date. Ensure that the total work duration per day is realistic (normally 1-6 hours, do not exceed 8 hours per day of task work). If multiple tasks are due very soon and total duration exceeds reasonable limits, schedule them aggressively, and trigger warnings.

Generate warnings for any tasks where:
- The deadline is in the past, or today, but the task is not completed.
- The estimated duration is longer than the time remaining until the deadline.
- The workload per day leading to the deadline is extremely congested.

Format your output EXACTLY as specified in the response schema.`;

      const prompt = `Here is my current list of tasks:

${tasksString || "No tasks available. Please ask clarifying questions or suggest creating a task."}

Please perform your comprehensive DeadlineZero analysis. Ensure you categorize every single task ID into either 'criticalIds', 'importantIds', or 'lowPriorityIds'. Map out a realistic daily schedule, flag at-risk tasks, and give me direct, high-value, motivating tips.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              criticalIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "IDs of tasks that belong to the 🔴 Critical (Do NOW) quadrant.",
              },
              importantIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "IDs of tasks that belong to the 🟡 Important (Schedule it) quadrant.",
              },
              lowPriorityIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "IDs of tasks that belong to the 🟢 Low Priority (Do later) quadrant.",
              },
              schedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: "YYYY-MM-DD" },
                    tasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          taskId: { type: Type.STRING, description: "The task ID" },
                          taskTitle: { type: Type.STRING, description: "Short title of the task" },
                          allocatedHours: { type: Type.NUMBER, description: "Hours to work on this task on this day" },
                          notes: { type: Type.STRING, description: "Motivational micro-tip or instruction for this day's work" }
                        },
                        required: ["taskId", "taskTitle", "allocatedHours", "notes"]
                      }
                    }
                  },
                  required: ["date", "tasks"]
                },
                description: "A chronological list of daily plans to complete all tasks before deadlines.",
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 to 3 tailored, direct, and encouraging productivity tips based on their specific workload.",
              },
              warnings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING, description: "At-risk task ID" },
                    taskTitle: { type: Type.STRING, description: "Task title" },
                    message: { type: Type.STRING, description: "Explanation of why this task is at risk" },
                    severity: { type: Type.STRING, description: "Either 'danger' or 'warning'" }
                  },
                  required: ["taskId", "taskTitle", "message", "severity"]
                },
                description: "Specific warnings for any task that has a high risk of being missed.",
              },
              summary: {
                type: Type.STRING,
                description: "A friendly, highly motivating overview from DeadlineZero addressing the user.",
              }
            },
            required: ["criticalIds", "importantIds", "lowPriorityIds", "schedule", "tips", "warnings", "summary"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (geminiErr: any) {
      console.warn("Gemini API call failed. Falling back to local smart heuristics.", geminiErr);
      const fallbackResult = runLocalHeuristicAnalysis(tasks, currentTime);
      res.json(fallbackResult);
    }
  } catch (error: any) {
    console.error("Analysis Error:", error);
    try {
      const fallbackResult = runLocalHeuristicAnalysis(req.body.tasks, req.body.currentTime);
      res.json(fallbackResult);
    } catch (fallbackErr: any) {
      console.error("Critical fallback error in analyze endpoint:", fallbackErr);
      res.status(500).json({ error: error.message || "Failed to analyze workload" });
    }
  }
});

// 2. Chat Endpoint (Interactive Workload Adjustment & Guidance)
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, tasks, currentTime } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid messages array" });
    }

    // Checking API Key presence upfront for immediate fallback
    if (!process.env.GEMINI_API_KEY) {
      console.log("GEMINI_API_KEY is not defined. Using local smart chat companion heuristics.");
      const fallbackResult = runLocalHeuristicChat(messages, tasks || []);
      return res.json(fallbackResult);
    }

    try {
      const ai = getGenAI();

      const tasksString = tasks && Array.isArray(tasks) ? tasks.map(t => (
        `- ID: ${t.id}, Title: "${t.title}", Deadline: ${t.deadline}, Estimated Duration: ${t.duration}h, Importance: ${t.importance}, Consequence: "${t.impact || 'None specified'}", Status: ${t.status}`
      )).join("\n") : "No tasks currently in list.";

      const systemInstruction = `You are "DeadlineZero", a friendly, direct, motivating AI companion. Your purpose is to keep the user from missing deadlines and keep their workspace stress-free.

Current Local Time: ${currentTime || new Date().toISOString()}

User's Task List:
{tasksString}

Guidance for responses:
1. Speak directly to the user as their personal companion. Be supportive, smart, and direct.
2. If the user wants to adjust, create, or delete tasks (e.g. "push my essay back to Sunday", "add a task for groceries tomorrow", "mark task 1 as done"), you should explain your thinking AND also return a structured adjustment in the 'suggestedAdjustments' field so the interface can execute it!
3. If they give vague tasks or unclear schedules, follow instructions: ask clarifying questions like "When is this due?", "How long will this take?", or "What happens if you miss this?".
4. Format your text response in clean Markdown. Avoid massive walls of text; use spacing and bullet points.

Adjustment types:
- 'update_task': update properties of an existing task (e.g. deadline, status, duration).
- 'create_task': create a brand new task.
- 'delete_task': delete a task.

Structure your response strictly to conform to the JSON schema below.`;

      const contents = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The Markdown-formatted message content responding to the user's chat input.",
              },
              suggestedAdjustments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Can be 'update_task', 'create_task', or 'delete_task'" },
                    taskId: { type: Type.STRING, description: "ID of the target task (if updating or deleting)" },
                    taskData: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        deadline: { type: Type.STRING, description: "YYYY-MM-DD" },
                        duration: { type: Type.NUMBER, description: "Duration in hours" },
                        importance: { type: Type.STRING, description: "'high', 'medium', or 'low'" },
                        impact: { type: Type.STRING },
                        status: { type: Type.STRING, description: "'pending' or 'completed'" }
                      }
                    },
                    reason: { type: Type.STRING, description: "A simple explanation of why this adjustment is suggested." }
                  },
                  required: ["type"]
                },
                description: "Optional task updates, creations, or deletions suggested during the chat conversation."
              }
            },
            required: ["text"]
          }
        }
      });

      const resultText = response.text || "{}";
      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (geminiErr: any) {
      console.warn("Gemini chat API call failed. Falling back to local smart heuristics.", geminiErr);
      const fallbackResult = runLocalHeuristicChat(messages, tasks || []);
      res.json(fallbackResult);
    }
  } catch (error: any) {
    console.error("Chat Error:", error);
    try {
      const fallbackResult = runLocalHeuristicChat(req.body.messages, req.body.tasks || []);
      res.json(fallbackResult);
    } catch (fallbackErr: any) {
      console.error("Critical fallback error in chat endpoint:", fallbackErr);
      res.status(500).json({ error: error.message || "Failed to process chat" });
    }
  }
});

// Vite Dev vs Prod setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DeadlineZero companion server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
