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

// 1. Analyze Task List Endpoint
app.post("/api/analyze", async (req, res) => {
  try {
    const { tasks, currentTime } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Missing or invalid tasks array" });
    }

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
  } catch (error: any) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze workload" });
  }
});

// 2. Chat Endpoint (Interactive Workload Adjustment & Guidance)
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, tasks, currentTime } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid messages array" });
    }

    const ai = getGenAI();

    const tasksString = tasks && Array.isArray(tasks) ? tasks.map(t => (
      `- ID: ${t.id}, Title: "${t.title}", Deadline: ${t.deadline}, Estimated Duration: ${t.duration}h, Importance: ${t.importance}, Consequence: "${t.impact || 'None specified'}", Status: ${t.status}`
    )).join("\n") : "No tasks currently in list.";

    const systemInstruction = `You are "DeadlineZero", a friendly, direct, motivating AI companion. Your purpose is to keep the user from missing deadlines and keep their workspace stress-free.

Current Local Time: ${currentTime || new Date().toISOString()}

User's Task List:
${tasksString}

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
  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat" });
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
