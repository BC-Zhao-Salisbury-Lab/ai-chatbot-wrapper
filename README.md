# AI Travel Chatbot - Research Tool

**Live Application Link:** [https://ai-chatbot-wrapper.vercel.app](https://ai-chatbot-wrapper.vercel.app)

This repository contains the architecture for the Assistant vs. Advisor Travel Study. The application is hosted on Vercel and connected to a secure Supabase database for behavioral tracking.

---

## 📝 Researcher Guide: How to Change the AI's Prompt
You do not need to download any code or install any software to change the AI's instructions. Because the site is linked to the cloud, you can edit the prompt directly here on GitHub, and the live website will automatically update within 60 seconds.

### Step-by-Step Instructions:
1. **Navigate to the core file:** Look at the folder list above and click through this exact path:
   `src` ➔ `app` ➔ `api` ➔ `chat` ➔ `route.js`
2. **Open the Editor:** Once you are looking at the code for `route.js`, look towards the top right corner of the code box. Click the **Pencil Icon** (✏️) to edit the file.
3. **Locate the Prompts:** Scroll down to **Lines 47 and 48**. You will see two paragraphs of plain English text wrapped in quotation marks. 
   * One is the instruction for the `assistant` condition.
   * One is the instruction for the `advisor` condition.
4. **Make Your Changes:** Simply delete the old text and type your new instructions inside the quotes. *(Warning: Do not delete the quotation marks or the commas at the end of the line!)*
5. **Save and Deploy:** Once you are happy with the new instructions, click the green **"Commit changes..."** button at the top right of the screen. Add a short description (like "Updated Advisor prompt") and click the green confirm button.

**You are done!** Vercel will automatically detect that you saved a new change, and the live website will update with the new AI personality in about 1 minute.

---

## 💻 Developer Guide: Local Setup Instructions
*(Note: Researchers do not need to read this section. This is only for developers pulling the code to a local machine).*

**Step 1: Install Node.js**
* Go to https://nodejs.org/.
* Download and install the LTS version for your operating system.
* Follow the standard installation prompts (all default settings).

**Step 2: Clone Repository**
* Open your terminal and run:
  `git clone https://github.com/nathanjlim/ai-chatbot-wrapper.git`
  `cd ai-chatbot-wrapper`

**Step 3: Install Dependencies**
* Because the core engine files (`node_modules`) are too heavy to store on GitHub, they need to be built locally.
* In the terminal, run: `npm install`

**Step 4: Configure API Key**
* Before running the application locally, you must provide the secure Anthropic API key.
* Create a new file in the root folder named exactly `.env.local`
* Open the file and add the API key like this: `ANTHROPIC_API_KEY=[enter key here]`
* *(Note: `.env.local` is included in the `.gitignore` and won't be uploaded to the internet automatically for safety).*