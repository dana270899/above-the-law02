import { describe, expect, it } from 'vitest'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { pathReachesRankingWithoutResult } from './terminalCaseFlow'

const node = (id: string, type: GameFlowNode['type']): GameFlowNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: type === 'ranking'
    ? { nodeType: 'ranking', title: 'Ranking' }
    : type === 'result'
      ? { nodeType: 'result', resultType: 'win', caseId: '7', label: 'Win' }
      : type === 'case'
        ? { nodeType: 'case', caseId: '8', title: 'Next case', order: 8, hasOperation: false }
        : { nodeType: 'message', messageType: 'text', content: '', buttonLabel: '', buttonLinkType: 'edge', buttonUrl: '', locationX: 0, locationY: 0 },
} as GameFlowNode)

const edge = (source: string, target: string, sourceHandle?: string): GameFlowEdge => ({
  id: `${source}-${sourceHandle ?? 'default'}-${target}`,
  source,
  target,
  sourceHandle,
})

describe('pathReachesRankingWithoutResult', () => {
  it('recognizes a final case decision connected directly to Ranking', () => {
    expect(pathReachesRankingWithoutResult(
      'ranking',
      [node('ranking', 'ranking')],
      [],
    )).toBe(true)
  })

  it('continues through inserted messages before Ranking', () => {
    expect(pathReachesRankingWithoutResult(
      'message-1',
      [node('message-1', 'message'), node('message-2', 'message'), node('ranking', 'ranking')],
      [edge('message-1', 'message-2'), edge('message-2', 'ranking')],
    )).toBe(true)
  })

  it.each(['result', 'case'] as const)('stops at a %s boundary', (type) => {
    expect(pathReachesRankingWithoutResult(
      'boundary',
      [node('boundary', type), node('ranking', 'ranking')],
      [edge('boundary', 'ranking')],
    )).toBe(false)
  })

  it('ignores trigger side branches and terminates safely on loops', () => {
    expect(pathReachesRankingWithoutResult(
      'message-1',
      [node('message-1', 'message'), node('message-2', 'message'), node('ranking', 'ranking')],
      [
        edge('message-1', 'ranking', 'trigger'),
        edge('message-1', 'message-2'),
        edge('message-2', 'message-1'),
      ],
    )).toBe(false)
  })
})
