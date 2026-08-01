import { describe, expect, it } from 'vitest'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { pathContainsPointsNode } from './pointsFlow'

const message = (id: string): GameFlowNode => ({
  id,
  type: 'message',
  position: { x: 0, y: 0 },
  data: { nodeType: 'message', messageType: 'text', content: '', buttonLabel: '', buttonLinkType: 'edge', buttonUrl: '', locationX: 0, locationY: 0 },
})
const points = (id: string): GameFlowNode => ({
  id,
  type: 'points',
  position: { x: 0, y: 0 },
  data: { nodeType: 'points', amount: -200 },
})
const edge = (source: string, target: string): GameFlowEdge => ({ id: `${source}-${target}`, source, target })

describe('pathContainsPointsNode', () => {
  it('finds a Points node after one or more messages', () => {
    expect(pathContainsPointsNode('message-1', [message('message-1'), message('message-2'), points('points-1')], [edge('message-1', 'message-2'), edge('message-2', 'points-1')])).toBe(true)
  })

  it('stops at a gameplay boundary instead of claiming a later score node', () => {
    const caseNode: GameFlowNode = { id: 'case-2', type: 'case', position: { x: 0, y: 0 }, data: { nodeType: 'case', caseId: '2', title: 'Case 2', order: 2, hasOperation: false } }
    expect(pathContainsPointsNode('message-1', [message('message-1'), caseNode, points('points-1')], [edge('message-1', 'case-2'), edge('case-2', 'points-1')])).toBe(false)
  })

  it('terminates safely when a message chain loops', () => {
    expect(pathContainsPointsNode('message-1', [message('message-1'), message('message-2')], [edge('message-1', 'message-2'), edge('message-2', 'message-1')])).toBe(false)
  })
})
