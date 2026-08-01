import { describe, expect, it } from 'vitest'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { planFlowPreloadNodes } from './flowPreload'

function flowNode(
  id: string,
  type: GameFlowNode['type'],
  data: Record<string, unknown> = {},
): GameFlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { nodeType: type, ...data },
  } as GameFlowNode
}

function edge(
  source: string,
  target: string,
  sourceHandle?: string,
): GameFlowEdge {
  return {
    id: `${source}-${sourceHandle ?? 'default'}-${target}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
  }
}

function distances(plan: ReturnType<typeof planFlowPreloadNodes>) {
  return Object.fromEntries(plan.map((item) => [item.nodeId, item.distance]))
}

describe('planFlowPreloadNodes', () => {
  it('follows graph connections rather than node order or case order', () => {
    const start = flowNode('start-any-id', 'message', {
      messageType: 'text',
      buttonLinkType: 'edge',
    })
    const transparent = flowNode('transparent-any-id', 'points', { amount: 1 })
    const connected = flowNode('connected-any-id', 'case', {
      caseId: '900',
      order: 99,
    })
    const unconnected = flowNode('unconnected-any-id', 'case', {
      caseId: '100',
      order: 1,
    })

    const result = planFlowPreloadNodes({
      // Deliberately reverse the visually/logically expected order.
      nodes: [unconnected, connected, transparent, start],
      edges: [
        edge('start-any-id', 'transparent-any-id'),
        edge('transparent-any-id', 'connected-any-id'),
      ],
      currentNodeId: 'start-any-id',
    })

    expect(distances(result)).toEqual({
      'start-any-id': 0,
      'transparent-any-id': 0,
      'connected-any-id': 1,
    })
  })

  it('plans every case decision branch and valid trigger side branch', () => {
    const nodes = [
      flowNode('case', 'case', { caseId: '1', order: 1 }),
      flowNode('arrest-message', 'message', { messageType: 'voice', buttonLinkType: 'edge' }),
      flowNode('release-message', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('trigger', 'trigger', { triggerType: 'arrest' }),
      flowNode('trigger-message', 'message', { messageType: 'voice', buttonLinkType: 'edge' }),
      flowNode('direct-trigger-message', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
    ]
    const edges = [
      edge('case', 'arrest-message', 'arrest'),
      edge('case', 'release-message', 'release'),
      edge('case', 'trigger', 'trigger'),
      edge('trigger', 'trigger-message'),
      // Runtime ignores a trigger handle wired directly to a Message.
      edge('case', 'direct-trigger-message', 'trigger'),
    ]

    expect(distances(planFlowPreloadNodes({ nodes, edges, currentNodeId: 'case' })))
      .toEqual({
        case: 0,
        trigger: 0,
        'arrest-message': 1,
        'release-message': 1,
        'trigger-message': 1,
      })
  })

  it('follows all Second Arrest choices without charging a visible stop', () => {
    const nodes = [
      flowNode('gate', 'secondArrest'),
      flowNode('arrest-result', 'result', { resultType: 'win', caseId: '1' }),
      flowNode('release-points', 'points', { amount: -10 }),
      flowNode('release-message', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
    ]
    const edges = [
      edge('gate', 'arrest-result', 'arrest'),
      edge('gate', 'release-points', 'release'),
      edge('release-points', 'release-message'),
    ]

    expect(distances(planFlowPreloadNodes({ nodes, edges, currentNodeId: 'gate' })))
      .toEqual({
        gate: 0,
        'release-points': 0,
        'arrest-result': 1,
        'release-message': 1,
      })
  })

  it('uses only the first non-trigger edge for ordinary main-flow nodes', () => {
    const nodes = [
      flowNode('start', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('first', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('second', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
    ]
    const edges = [edge('start', 'first'), edge('start', 'second')]

    expect(distances(planFlowPreloadNodes({ nodes, edges, currentNodeId: 'start' })))
      .toEqual({ start: 0, first: 1 })
  })

  it('stops at URL messages even when they have an outgoing edge', () => {
    const nodes = [
      flowNode('external', 'message', { messageType: 'link', buttonLinkType: 'url' }),
      flowNode('must-not-load', 'case', { caseId: '2', order: 2 }),
    ]

    expect(planFlowPreloadNodes({
      nodes,
      edges: [edge('external', 'must-not-load')],
      currentNodeId: 'external',
    })).toEqual([{ nodeId: 'external', distance: 0 }])
  })

  it('includes a newCase target immediately even before the walker reaches it', () => {
    const nodes = [
      flowNode('announcement', 'message', {
        messageType: 'link',
        buttonLinkType: 'newCase',
        targetCaseId: '891',
      }),
      flowNode('tutorial-one', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('tutorial-two', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('target-case', 'case', { caseId: '891', order: 1 }),
    ]
    const edges = [
      edge('announcement', 'tutorial-one'),
      edge('tutorial-one', 'tutorial-two'),
      edge('tutorial-two', 'target-case'),
    ]

    const result = distances(planFlowPreloadNodes({
      nodes: [flowNode('unrelated', 'case', { caseId: '999', order: 0 }), ...nodes.reverse()],
      edges,
      currentNodeId: 'announcement',
      lookaheadStops: 1,
    }))

    expect(result).toEqual({
      announcement: 0,
      'target-case': 1,
      'tutorial-one': 1,
    })
  })

  it('keeps trigger queues separate from the main walker', () => {
    const nodes = [
      flowNode('case', 'case', { caseId: '1', order: 1 }),
      flowNode('trigger', 'trigger', { triggerType: 'release' }),
      flowNode('side-points', 'points', { amount: -20 }),
      flowNode('side-message', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('main-only-case', 'case', { caseId: '2', order: 2 }),
    ]
    const edges = [
      edge('case', 'trigger', 'trigger'),
      edge('trigger', 'side-points'),
      edge('side-points', 'side-message'),
      // A trigger queue drains here; it does not move the main walker.
      edge('side-message', 'main-only-case'),
    ]

    expect(distances(planFlowPreloadNodes({ nodes, edges, currentNodeId: 'case' })))
      .toEqual({
        case: 0,
        trigger: 0,
        'side-points': 0,
        'side-message': 1,
      })
  })

  it('terminates cycles and keeps the shortest distance from every root', () => {
    const nodes = [
      flowNode('current', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('gate', 'secondArrest'),
      flowNode('loop-message', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('extra-root', 'points', { amount: 5 }),
    ]
    const edges = [
      edge('current', 'gate'),
      edge('gate', 'loop-message', 'release'),
      edge('loop-message', 'gate'),
      edge('extra-root', 'loop-message'),
    ]

    expect(distances(planFlowPreloadNodes({
      nodes,
      edges,
      currentNodeId: 'current',
      additionalRootIds: ['extra-root', 'missing-root'],
    }))).toEqual({
      current: 0,
      gate: 0,
      'extra-root': 0,
      'loop-message': 1,
    })
  })

  it('honors lookahead and max-node safety limits', () => {
    const nodes = [
      flowNode('one', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('two', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
      flowNode('three', 'message', { messageType: 'text', buttonLinkType: 'edge' }),
    ]
    const edges = [edge('one', 'two'), edge('two', 'three')]

    expect(planFlowPreloadNodes({
      nodes,
      edges,
      currentNodeId: 'one',
      lookaheadStops: 1,
    }).map((item) => item.nodeId)).toEqual(['one', 'two'])

    expect(planFlowPreloadNodes({
      nodes,
      edges,
      currentNodeId: 'one',
      maxNodes: 1,
    })).toEqual([{ nodeId: 'one', distance: 0 }])
  })
})
