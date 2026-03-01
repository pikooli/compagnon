# Compagnon

**Voice-first executive assistant** — [Click here to see our Presentation](https://compagnon-ai-assistant.lovable.app/)

Field sales professionals deal with constant interruptions — last-minute meeting requests, calendar changes, and follow-ups — often while moving between client visits. Managing those changes manually creates friction, increases cognitive load, and makes it harder to protect priorities and personal time.

Compagnon turns voice into structured execution.

Users can choose between a female or male voice based on their preference, making the interaction feel more natural and personal. Through voice, they can create, edit, or delete meetings directly in Google Calendar, draft and send emails, and handle follow-ups instantly — without navigating multiple tools.

Under the hood, Speechmatics powers accurate, low-latency voice input. OpenAI models running on Cerebras infrastructure handle fast reasoning to interpret intent and evaluate constraints. Backboard manages both short-term and long-term memory, storing persistent rules like "family time after 6 PM" or preferred scheduling windows and applying them automatically to future actions. We prototyped the interface using Lovable to design a clean, responsive UI that visually confirms every change in real time.

The result is a voice-first assistant that doesn't just suggest times — it understands intent, learns user boundaries, and executes scheduling workflows intelligently and autonomously.

---

## How to get started

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd compagnon
   pnpm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your API keys and config (see the file for required variables).

3. **Run locally**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Get more informations**

   On this explaination slide : [https://compagnon-ai-assistant.lovable.app/](https://compagnon-ai-assistant.lovable.app/)
