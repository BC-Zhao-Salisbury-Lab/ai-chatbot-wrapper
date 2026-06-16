This repository has Node.js architecture for the Assistant vs. Advisor Study.

---

## Complete Local Setup Instructions

### Step 1: Install Node.js (requires Node.js to run the local server)
1. Go to https://nodejs.org/.
2. Download and install the LTS version for your operating system.
3. Follow the standard installation prompts (all default settings).

### Step 2: Clone Repository
Open terminal and run:

git clone https://github.com/nathanjlim/ai-chatbot-wrapper.git

cd ai-chatbot-wrapper

### Step 3: Install Dependencies
Because the core engine files (`node_modules`) are too heavy to store on GitHub, they need to be built locally. 

In terminal:

npm install

### Step 4: Configure API Key.
Before running the application, provide the secure Anthropic (?) API key.
1. Create a new file in the root folder named exactly `.env.local`
2. Open the file and add Anthropic API key like this:

   ANTHROPIC_API_KEY=[enter key here]...

*(`.env.local` won't be uploaded to the internet automatically for safety).*
