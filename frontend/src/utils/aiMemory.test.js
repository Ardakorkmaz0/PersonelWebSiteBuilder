// The assistant's memory of its own work.
//
// The chat used to hand the model text turns only: every tool call it made was
// dropped before the next message, so its entire record of the last turn was
// whatever sentence it happened to end on — usually "Done." That is why "now
// make it bigger" landed on the wrong component, why it redid work it had
// already done, and why a rejected preview could be treated as applied.
//
// historyToTurns is what carries that record. These tests pin the shape the
// providers receive, the budget that keeps it affordable, and the one fact the
// user never says out loud: "I rejected that".
import { describe, expect, it } from 'vitest'
import { historyToTurns } from './aiAssistant.js'

const call = (name, args = {}, result = { ok: true }) => ({ name, args, result })

describe('historyToTurns', () => {
  it('replays past tool calls as a real model turn plus its results', () => {
    const turns = historyToTurns([
      { role: 'user', text: 'add a hero' },
      { role: 'tools', calls: [call('addSection', { background: '#000' }, { ok: true, id: 'region_1' })] },
      { role: 'model', text: 'Added a hero band.' },
    ])

    expect(turns).toHaveLength(4)
    expect(turns[0]).toEqual({ role: 'user', text: 'add a hero' })
    expect(turns[1]).toEqual({
      role: 'model',
      functionCalls: [{ name: 'addSection', args: { background: '#000' } }],
    })
    expect(turns[2]).toEqual({
      role: 'tool',
      toolResults: [{ name: 'addSection', response: { ok: true, id: 'region_1' } }],
    })
    expect(turns[3]).toEqual({ role: 'model', text: 'Added a hero band.' })
  })

  it('carries the id of what it created, so "it" has something to point at', () => {
    const turns = historyToTurns([
      { role: 'tools', calls: [call('addComponent', { type: 'button' }, { ok: true, id: 'button_7' })] },
    ])
    expect(JSON.stringify(turns)).toContain('button_7')
  })

  it('keeps failures honest instead of replaying them as successes', () => {
    const turns = historyToTurns([
      { role: 'tools', calls: [call('updateProps', { id: 'ghost' }, { ok: false, error: 'Component not found: ghost' })] },
    ])
    expect(turns[1].toolResults[0].response.ok).toBe(false)
    expect(turns[1].toolResults[0].response.error).toContain('not found')
  })

  it('trims a long error rather than shipping a wall of text every turn', () => {
    const turns = historyToTurns([
      { role: 'tools', calls: [call('updateProps', {}, { ok: false, error: 'x'.repeat(500) })] },
    ])
    expect(turns[1].toolResults[0].response.error.length).toBe(140)
  })

  it('records a rejected change as a fact the model must not build on', () => {
    const turns = historyToTurns([
      { role: 'tools', calls: [call('updateTheme', { primaryColor: '#f00' })] },
      { role: 'model', text: 'Change rejected — your site was left untouched.', note: 'The user REJECTED the change you proposed. NOTHING was applied.' },
    ])
    const note = turns.at(-1)
    expect(note.role).toBe('user')
    expect(note.text).toMatch(/^\[system note\]/)
    expect(note.text).toContain('REJECTED')
  })

  it('keeps the RECENT calls when the budget runs out, not the oldest ones', () => {
    const many = Array.from({ length: 10 }, (_, i) => call(`tool_${i}`))
    const turns = historyToTurns([
      { role: 'tools', calls: many.slice(0, 5) },
      { role: 'tools', calls: many.slice(5) },
    ], 6)

    const names = turns
      .filter((turn) => turn.functionCalls)
      .flatMap((turn) => turn.functionCalls.map((c) => c.name))
    expect(names).toHaveLength(6)
    // The last five plus one from the batch before them.
    expect(names).toContain('tool_9')
    expect(names).toContain('tool_4')
    expect(names).not.toContain('tool_0')
  })

  it('drops an empty tools message rather than emitting a hollow turn', () => {
    expect(historyToTurns([{ role: 'tools', calls: [] }])).toEqual([])
    expect(historyToTurns([{ role: 'user', text: '' }])).toEqual([])
    expect(historyToTurns(null)).toEqual([])
  })

  it('leaves plain conversation exactly as it was', () => {
    expect(historyToTurns([
      { role: 'user', text: 'hi' },
      { role: 'assistant', text: 'hello' },
      { role: 'model', text: 'hello again' },
    ])).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'user', text: 'hello' },
      { role: 'model', text: 'hello again' },
    ])
  })
})
