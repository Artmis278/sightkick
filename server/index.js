import express from 'express'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Resolve from this file so the root .env loads regardless of the working directory.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

export function createApp({ client } = {}) {
  const openai = client ?? (process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 0 })
    : null)
  const app = express()
  app.use(express.json({ limit: '15mb' }))

  app.post('/api/ask', async (req, res) => {
    const { question, screenshot } = req.body ?? {}
    if (typeof question !== 'string' || !question.trim() || question.trim().length > 10_000) {
      return res.status(400).json({ error: 'Question must be a non-empty string of at most 10,000 characters.' })
    }

    // Canvas screenshots should be sent as PNG, JPEG, or WebP base64 data URLs.
    const imageData = typeof screenshot === 'string' ? screenshot.split(',') : []
    if (imageData.length !== 2 ||
        !/^data:image\/(png|jpeg|webp);base64$/.test(imageData[0]) ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData[1]) ||
        Buffer.from(imageData[1], 'base64').toString('base64') !== imageData[1]) {
      return res.status(400).json({ error: 'Screenshot must be a PNG, JPEG, or WebP base64 image data URL.' })
    }
    if (!openai) {
      return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' })
    }

    try {
      const response = await openai.responses.create({
        model: 'gpt-5.4-mini',
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: question.trim() },
            { type: 'input_image', image_url: screenshot, detail: 'auto' },
          ],
        }],
      })
      if (!response.output_text?.trim()) {
        return res.status(502).json({ error: 'The model returned no text response. Please try again.' })
      }
      return res.json({ answer: response.output_text })
    } catch (error) {
      // Do not expose upstream errors, which may contain request data or credentials.
      if (error.status === 429) {
        return res.status(429).json({ error: 'OpenAI request limit reached. Please try again later.' })
      }
      return res.status(502).json({ error: 'Unable to get an AI response. Please try again.' })
    }
  })

  // Express requires all four arguments for error-handling middleware.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request is too large. Use a smaller screenshot (JSON limit: 15 MB).' })
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON.' })
    }
    return res.status(500).json({ error: 'An unexpected server error occurred.' })
  })
  return app
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = 3001
  createApp().listen(port, '127.0.0.1', () => {
    console.log(`Sightkick API listening at http://127.0.0.1:${port}`)
  })
}
