# Sightkick API

Set `OPENAI_API_KEY` in the project root `.env` file. This file is ignored by Git and is loaded only by the backend. No key is needed to build the frontend.

Run `npm run server` and `npm run dev` in separate terminals. The backend listens on `127.0.0.1:3001`; Vite proxies `/api` requests to it.

`POST /api/ask` accepts JSON:

```json
{
  "question": "What is shown in this window?",
  "screenshot": "data:image/png;base64,..."
}
```

Use a PNG, JPEG, or WebP base64 data URL (for example, from `canvas.toDataURL()`). Questions are limited to 10,000 characters and the full JSON body to 15 MB.

Success returns `{ "answer": "model text" }`. Errors return `{ "error": "message" }` with an appropriate HTTP status. Requests use `gpt-5.4-mini` through the OpenAI Responses API.

The frontend captures one JPEG frame from the shared screen when a question is submitted and calls this endpoint. Sharing stays active between questions; no frames are sent in the background.
