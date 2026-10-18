import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from './index.js'

const screenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

async function withServer(client, run) {
  const server = createApp({ client }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/ask`
  try {
    await run((body) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('sends the question and screenshot to the requested model and returns text', async () => {
  let request
  const client = { responses: { create: async (input) => {
    request = input
    return { output_text: 'A window is visible.' }
  } } }
  await withServer(client, async (post) => {
    const response = await post({ question: ' What is shown? ', screenshot })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { answer: 'A window is visible.' })
    assert.equal(request.model, 'gpt-5.4-mini')
    assert.equal(request.input[0].content[0].text, 'What is shown?')
    assert.equal(request.input[0].content[1].image_url, screenshot)
  })
})

test('rejects invalid questions, screenshots, and JSON before calling OpenAI', async () => {
  await withServer({ responses: { create: () => assert.fail('Unexpected API call') } }, async (post) => {
    for (const body of [null, {}, { question: ' ', screenshot }, { question: 'x'.repeat(10_001), screenshot },
      { question: 'Hello', screenshot: 'invalid' }, { question: 'Hello', screenshot: 'data:image/png;base64,!!!!' }, '{']) {
      assert.equal((await post(body)).status, 400)
    }
  })
})

test('returns safe errors for upstream failures and empty responses', async () => {
  for (const [result, status] of [
    [() => { throw Object.assign(new Error('private upstream details'), { status: 429 }) }, 429],
    [() => { throw new Error('private upstream details') }, 502],
    [() => ({ output_text: '' }), 502],
  ]) {
    await withServer({ responses: { create: result } }, async (post) => {
      const response = await post({ question: 'Hello', screenshot })
      assert.equal(response.status, status)
      assert.ok(!(await response.json()).error.includes('private upstream details'))
    })
  }
})
