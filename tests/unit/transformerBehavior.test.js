// @vitest-environment node
import Konva from 'konva'
import { describe, expect, it } from 'vitest'

// Real-Konva behavior checks (no mocks, no canvas needed — node
// introspection only). Encodes the two root causes of the
// Transformer-vs-Stage-pan conflict:
//
// 1. listening=false on an ancestor makes the whole subtree event-dead
//    (anchors never receive pointer events, gestures fall to the Stage).
// 2. Transformer anchors are draggable shapes, so inside a listening layer
//    a handle mousedown drags the anchor itself — Konva never bubbles the
//    drag to the draggable Stage, i.e. no pan hijack.
describe('Transformer event mechanics (real Konva)', () => {
  it('kills events for the whole subtree when an ancestor is non-listening', () => {
    const group = new Konva.Group({ listening: false })
    const rect = new Konva.Rect({ x: 0, y: 0, width: 10, height: 10 })
    group.add(rect)
    expect(rect.isListening()).toBe(false)

    const transformer = new Konva.Transformer()
    group.add(transformer)
    expect(transformer.isListening()).toBe(false)
  })

  it('keeps anchors draggable inside a listening layer', () => {
    const rect = new Konva.Rect({ x: 0, y: 0, width: 100, height: 60 })
    const transformer = new Konva.Transformer()
    transformer.nodes([rect])
    const anchors = transformer.find('Rect')
    // 8 resize corners + 1 rotate handle.
    expect(anchors.length).toBe(9)
    for (const anchor of anchors) {
      expect(anchor.draggable()).toBe(true)
    }
    expect(transformer.isListening()).toBe(true)
  })
})
