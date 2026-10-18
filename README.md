# Sightkick

Sightkick is an on-demand screen assistant. Share a browser tab, window, or desktop, then ask questions about what you see and receive AI-generated explanations.

## Main features

- Browser screen sharing with a live local preview and a Stop Sharing control.
- Questions about your screen, with answers displayed in a chat interface.
- One screenshot per submitted question, with loading and error feedback.
- Server-side OpenAI integration that keeps the API key out of browser code.

## Technology stack

- **React** for the user interface.
- **Vite** for frontend development and production builds.
- **Node.js** and **Express** for the local API server.
- **OpenAI API** for screenshot analysis through the Responses API (`gpt-5.4-mini`).

## Architecture

```text
Browser (React + screen-sharing preview)
  -> question + one JPEG screenshot
  -> /api/ask (proxied by Vite during development)
  -> Node.js / Express backend
  -> OpenAI Responses API
  -> answer returned to the browser chat
```

The frontend lives in `src/`; the backend is `server/index.js`. The backend loads the root `.env` file and listens at `http://127.0.0.1:3001`. See [server/README.md](server/README.md) for the API request format and limits.

**Screen sharing stays active while AI analysis runs and between questions.** Analysis occurs only when you submit a question: the browser captures a single frame and sends it with that question to the backend and OpenAI. No frames are sent in the background, and the app does not record video. Stop sharing using the app or browser controls.

## Local setup

Use Node.js 22.12+ (or Node.js 20.19+) with npm, and a desktop browser that supports screen sharing. Screen sharing requires localhost or HTTPS. AI answers require an OpenAI API key with access to the configured model and available API usage quota.

1. Clone this repository from GitHub and open a terminal in its root directory.
2. Install dependencies:

   ```sh
   npm ci
   ```

3. Copy `.env.example` to `.env` in the project root:

   ```sh
   cp .env.example .env
   ```

   In Windows PowerShell, use `Copy-Item .env.example .env` instead.

4. Edit `.env` and replace the placeholder with your own API key:

   ```dotenv
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   `.env.example` contains no credentials. `.env` is excluded by `.gitignore`; keep real keys there and never commit them. The backend reads `OPENAI_API_KEY`; do not give it a `VITE_` prefix or put it in frontend source.

5. Start the backend:

   ```sh
   npm run server
   ```

6. In a second terminal in the same directory, start the frontend:

   ```sh
   npm run dev
   ```

7. Open the local URL printed by Vite (normally `http://localhost:5173`). Click **Share Screen**, choose what to share, then submit a question.

## Build and checks

```sh
npm run build
npm run lint
node --test server/index.test.js
```

The build writes frontend assets to `dist/` and does not require an API key. `npm run preview` previews the frontend build; it does not start the backend or provide the development API proxy. A production deployment must run the backend separately and route `/api` requests to it.
