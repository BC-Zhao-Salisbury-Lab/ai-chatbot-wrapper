# AI Travel Chatbot - Research Tool

**Live Application Link:** https://ai-chatbot-wrapper.vercel.app/assistant or https://ai-chatbot-wrapper.vercel.app/advisor

This repository contains the architecture for the Assistant vs. Advisor Travel Study. The application is hosted on Vercel and connected to a secure Supabase database for behavioral tracking.

---

## 📝 Researcher Guide: How to Change the AI's Prompt

You do not need to download any code or install any software to change the AI's instructions. Because the site is linked to the cloud, you can edit the prompt directly here on GitHub, and the live website will automatically update within 60 seconds.

### Step-by-Step Instructions:

1. **Navigate to the core file:** Look at the folder list above and click through this exact path: `src` ➔ `app` ➔ `api` ➔ `chat` ➔ `route.js`
2. **Open the Editor:** Once you are looking at the code for `route.js`, look towards the top right corner of the code box. Click the Pencil Icon (✏️) to edit the file.
3. **Locate the Prompts:** Scroll down to the `// AI Prompts` section. You will see two paragraphs of plain English text wrapped in quotation marks (`\``).
   * One is the instruction for the **advisor** condition.
   * One is the instruction for the **assistant** condition.
4. **Make Your Changes:** Simply delete the old text and type your new instructions inside the quotes. *(Warning: Do not delete the quotation marks or the commas at the end of the line!)*
5. **Save and Deploy:** Once you are happy with the new instructions, click the green **"Commit changes..."** button at the top right of the screen. Add a short description (like "Updated Advisor prompt") and click the green confirm button.

You are done! Vercel will automatically detect that you saved a new change, and the live website will update with the new AI personality in about 1 minute.

---

## 🏗️ System Architecture & Telemetry

This tool is a full-stack application designed specifically to maintain experimental control and securely log behavioral data. 

### The Tech Stack
* **Frontend & Hosting (Next.js & Vercel):** Manages the isolated `/assistant` and `/advisor` routing to ensure participants are locked into their assigned condition.
* **LLM Engine (Anthropic):** Powered by the Claude Haiku model for fast, cost-effective generation based on strict persona rubrics.
* **Database (Supabase / PostgreSQL):** Handles real-time telemetry and data logging.
* **Rate Limiting (Upstash Redis):** A sliding window rate limiter that restricts the number of messages a participant can send to prevent API abuse.

### The Qualtrics Integration Pipeline
Participants are handed off from Qualtrics to the web application via URL parameters. 
* Links in the Qualtrics survey are formatted as: `...vercel.app/assistant?cc_sessionId=${e://Field/ResponseID}`
* Qualtrics dynamically replaces the end of the URL with the participant's unique `ResponseID`. 
* The Next.js application captures this ID and uses it as the primary key for the Upstash rate limiter and the Supabase data logs.

### Database Schema (`study_logs` table)
All interactions are logged in Supabase. The table contains the following structure:
* `qualtrics_response_id`: The unique user ID piped in from the survey.
* `condition`: Hardcoded as either `assistant` or `advisor` based on the URL path.
* `user_message`: The text inputted by the participant.
* `ai_response`: The generated output from Claude.
* `tab_out_count`: A JavaScript event listener that tracks how many times `document.hidden` triggers, measuring participant distraction.
* `interaction_count`: The chronological order of messages per user.
* `total_time_seconds`: Time elapsed from page load to message execution.

*(Note: To reset the database for a new study wave, run `TRUNCATE TABLE study_logs;` in the Supabase SQL editor).*

---

## 💻 Developer Guide: Local Setup Instructions

*(Note: Researchers do not need to read this section. This is only for developers pulling the code to a local machine).*

### Step 1: Install Node.js
1. Go to https://nodejs.org/.
2. Download and install the LTS version for your operating system.
3. Follow the standard installation prompts (all default settings).

### Step 2: Clone Repository
Open your terminal and run:
```bash
git clone [https://github.com/BC-Zhao-Salisbury-Lab/ai-chatbot-wrapper.git](https://github.com/BC-Zhao-Salisbury-Lab/ai-chatbot-wrapper.git) 
cd ai-chatbot-wrapper