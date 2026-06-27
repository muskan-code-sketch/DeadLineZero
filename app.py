#!/usr/bin/env python3
import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from pydantic import BaseModel, Field
from typing import List, Optional

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for all routes to allow seamless communication with the React frontend
CORS(app)

# Attempt to import google-genai
try:
    from google import genai
    from google.genai import types
except ImportError:
    logger.error("The 'google-genai' package is not installed. Please run: pip install google-genai flask flask-cors pydantic")
    sys.exit(1)

# Lazy client initialization helper
_ai_client = None

def get_genai_client() -> genai.Client:
    """
    Initializes and returns the Google GenAI client.
    Ensures the GEMINI_API_KEY environment variable is defined.
    """
    global _ai_client
    if _ai_client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY environment variable is not defined.")
            raise ValueError("GEMINI_API_KEY environment variable is not defined. Please set it in your environment variables.")
        
        # Initialize Google GenAI client
        # In the modern SDK, client configuration automatically attaches standard headers
        _ai_client = genai.Client(
            api_key=api_key,
            http_options={'headers': {'User-Agent': 'aistudio-build'}}
        )
    return _ai_client


# =====================================================================
# Pydantic Schemas for Structured Output Validation & Documentation
# =====================================================================

class TaskAllocation(BaseModel):
    taskId: str = Field(description="The task ID")
    taskTitle: str = Field(description="Short title of the task")
    allocatedHours: float = Field(description="Hours to work on this task on this day")
    notes: str = Field(description="Motivational micro-tip or instruction for this day's work")

class DailySchedule(BaseModel):
    date: str = Field(description="YYYY-MM-DD")
    tasks: List[TaskAllocation]

class WarningMessage(BaseModel):
    taskId: str = Field(description="At-risk task ID")
    taskTitle: str = Field(description="Task title")
    message: str = Field(description="Explanation of why this task is at risk")
    severity: str = Field(description="Either 'danger' or 'warning'")

class AnalysisResponse(BaseModel):
    criticalIds: List[str] = Field(description="IDs of tasks that belong to the 🔴 Critical (Do NOW) quadrant.")
    importantIds: List[str] = Field(description="IDs of tasks that belong to the 🟡 Important (Schedule it) quadrant.")
    lowPriorityIds: List[str] = Field(description="IDs of tasks that belong to the 🟢 Low Priority (Do later) quadrant.")
    schedule: List[DailySchedule] = Field(description="A chronological list of daily plans to complete all tasks before deadlines.")
    tips: List[str] = Field(description="2 to 3 tailored, direct, and encouraging productivity tips.")
    warnings: List[WarningMessage] = Field(description="Specific warnings for any task that has a high risk of being missed.")
    summary: str = Field(description="A friendly, highly motivating overview from DeadlineZero addressing the user.")


class TaskData(BaseModel):
    title: Optional[str] = None
    deadline: Optional[str] = Field(None, description="YYYY-MM-DD")
    duration: Optional[float] = Field(None, description="Duration in hours")
    importance: Optional[str] = Field(None, description="'high', 'medium', or 'low'")
    impact: Optional[str] = None
    status: Optional[str] = Field(None, description="'pending' or 'completed'")

class SuggestedAdjustment(BaseModel):
    type: str = Field(description="Can be 'update_task', 'create_task', or 'delete_task'")
    taskId: Optional[str] = Field(None, description="ID of the target task (if updating or deleting)")
    taskData: Optional[TaskData] = None
    reason: Optional[str] = Field(None, description="A simple explanation of why this adjustment is suggested.")

class ChatResponse(BaseModel):
    text: str = Field(description="The Markdown-formatted message content responding to the user's chat input.")
    suggestedAdjustments: Optional[List[SuggestedAdjustment]] = None


# =====================================================================
# API Endpoints
# =====================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple API health check endpoint."""
    return jsonify({"status": "ok", "service": "DeadlineZero Flask Companion Server"})


@app.route('/api/analyze', methods=['POST'])
def analyze_workload():
    """
    POST /api/analyze
    Analyzes user tasks, maps them to Eisenhower Matrix quadrants, 
    generates schedules, warnings, tips, and a personalized summary.
    """
    try:
        # Validate JSON payload structure
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON request body"}), 400
        
        tasks = data.get("tasks")
        if tasks is None or not isinstance(tasks, list):
            return jsonify({"error": "Missing or invalid tasks array"}), 400
        
        current_time = data.get("currentTime", "")
        
        # Set up Gemini AI Client
        ai_client = get_genai_client()
        
        # Compile task representation for LLM ingestion
        tasks_representation = []
        for t in tasks:
            if not isinstance(t, dict) or "id" not in t or "title" not in t:
                continue
            tasks_representation.append(
                f"- Task ID: {t.get('id')}\n"
                f"  Title: \"{t.get('title')}\"\n"
                f"  Deadline: {t.get('deadline', 'N/A')}\n"
                f"  Estimated Duration: {t.get('duration', 0)} hours\n"
                f"  Importance: {t.get('importance', 'medium')}\n"
                f"  Consequence of failure: \"{t.get('impact', 'None specified')}\"\n"
                f"  Status: {t.get('status', 'pending')}"
            )
        tasks_string = "\n\n".join(tasks_representation)

        # Build prompt & system instruction
        system_instruction = f"""You are "DeadlineZero", a high-performance, direct, motivating, and friendly productivity companion.
Your job is to analyze the user's workload, prioritize tasks using the Eisenhower Matrix, generate a realistic day-by-day plan, warn about tight windows, and provide tailored actionable tips.

Current Local Time: {current_time or "not specified"}

Follow these Eisenhower Matrix mapping rules:
- Critical (Do NOW) - Urgent + Important. High importance and close deadline.
- Important (Schedule it) - Important but not urgent. High or Medium importance with a further deadline.
- Low Priority (Do later) - Urgent but Less Important, or neither. Medium/Low importance, or easily deferrable.

You must schedule tasks day-by-day starting from the current date. Ensure that the total work duration per day is realistic (normally 1-6 hours, do not exceed 8 hours per day of task work). If multiple tasks are due very soon and total duration exceeds reasonable limits, schedule them aggressively, and trigger warnings.

Generate warnings for any tasks where:
- The deadline is in the past, or today, but the task is not completed.
- The estimated duration is longer than the time remaining until the deadline.
- The workload per day leading to the deadline is extremely congested.

Format your output EXACTLY as specified in the response schema."""

        prompt = f"""Here is my current list of tasks:

{tasks_string or "No tasks available. Please ask clarifying questions or suggest creating a task."}

Please perform your comprehensive DeadlineZero analysis. Ensure you categorize every single task ID into either 'criticalIds', 'importantIds', or 'lowPriorityIds'. Map out a realistic daily schedule, flag at-risk tasks, and give me direct, high-value, motivating tips."""

        # Query Gemini API with Pydantic structured output
        logger.info("Calling Gemini API model for /api/analyze...")
        response = ai_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=AnalysisResponse,
            )
        )
        
        # Return parsed JSON structure
        return response.text, 200, {'Content-Type': 'application/json'}

    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 500
    except Exception as e:
        logger.exception("Error in /api/analyze endpoint:")
        return jsonify({"error": f"Failed to analyze workload: {str(e)}"}), 500


@app.route('/api/chat', methods=['POST'])
def chat_companion():
    """
    POST /api/chat
    Interactively chatting with DeadlineZero, supporting natural language 
    modifications to task list items.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON request body"}), 400
        
        messages = data.get("messages")
        if messages is None or not isinstance(messages, list):
            return jsonify({"error": "Missing or invalid messages array"}), 400
        
        tasks = data.get("tasks", [])
        current_time = data.get("currentTime", "")
        
        # Set up Gemini AI Client
        ai_client = get_genai_client()
        
        # Compile user tasks representation
        tasks_representation = []
        if isinstance(tasks, list):
            for t in tasks:
                if not isinstance(t, dict):
                    continue
                tasks_representation.append(
                    f"- ID: {t.get('id')}, Title: \"{t.get('title')}\", "
                    f"Deadline: {t.get('deadline')}, Estimated Duration: {t.get('duration')}h, "
                    f"Importance: {t.get('importance')}, Consequence: \"{t.get('impact', 'None specified')}\", "
                    f"Status: {t.get('status')}"
                )
        tasks_string = "\n".join(tasks_representation) if tasks_representation else "No tasks currently in list."

        system_instruction = f"""You are "DeadlineZero", a friendly, direct, motivating AI companion. Your purpose is to keep the user from missing deadlines and keep their workspace stress-free.

Current Local Time: {current_time or "not specified"}

User's Task List:
{tasks_string}

Guidance for responses:
1. Speak directly to the user as their personal companion. Be supportive, smart, and direct.
2. If the user wants to adjust, create, or delete tasks (e.g. "push my essay back to Sunday", "add a task for groceries tomorrow", "mark task 1 as done"), you should explain your thinking AND also return a structured adjustment in the 'suggestedAdjustments' field so the interface can execute it!
3. If they give vague tasks or unclear schedules, follow instructions: ask clarifying questions like "When is this due?", "How long will this take?", or "What happens if you miss this?".
4. Format your text response in clean Markdown. Avoid massive walls of text; use spacing and bullet points.

Adjustment types:
- 'update_task': update properties of an existing task (e.g. deadline, status, duration).
- 'create_task': create a brand new task.
- 'delete_task': delete a task.

Structure your response strictly to conform to the JSON schema below."""

        # Reconstruct chat contents for conversational continuity
        contents = []
        for msg in messages:
            if not isinstance(msg, dict):
                continue
            role = "user" if msg.get("sender") == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.get("text", ""))]
                )
            )

        # Query Gemini API with Pydantic structured output
        logger.info("Calling Gemini API model for /api/chat...")
        response = ai_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=ChatResponse,
            )
        )
        
        return response.text, 200, {'Content-Type': 'application/json'}

    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 500
    except Exception as e:
        logger.exception("Error in /api/chat endpoint:")
        return jsonify({"error": f"Failed to process chat session: {str(e)}"}), 500


# Run Flask development server
if __name__ == '__main__':
    # Determine port: 3000 is default for container environments
    port = int(os.environ.get("PORT", 3000))
    logger.info(f"Starting DeadlineZero Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
