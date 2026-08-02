import { describe, expect, it } from 'vitest'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import {
  caseNumberForOrder,
  findOwningCaseNode,
  moveCaseToOrder,
  normalizeCaseOrder,
} from './caseOrder'
import { isCaseUnlocked } from './caseProgression'

function caseNode(
  id: string,
  order: number,
  caseId: string,
  title = `Old ${id}`,
): GameFlowNode {
  return {
    id,
    type: 'case',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'case',
      caseId,
      title,
      order,
      hasOperation: false,
      window: {
        caseId,
        createdAt: '',
        statusLabel: 'Open',
        statusColor: 'green',
        photoUrl: '',
        fullName: '',
        idNo: '',
        dob: '',
        sex: '',
        nationality: '',
        religion: '',
        religionColor: 'black',
        address: '',
        criminalRecord: [],
        suspicions: [],
        arrestLabel: 'Arrest',
        releaseLabel: 'Release',
      },
    },
  }
}

function messageNode(id: string, targetCaseId?: string): GameFlowNode {
  return {
    id,
    type: 'message',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'message',
      messageType: 'text',
      content: '',
      buttonLabel: 'Next',
      buttonLinkType: targetCaseId ? 'newCase' : 'edge',
      buttonUrl: '',
      targetCaseId,
      locationX: 50,
      locationY: 50,
    },
  }
}

function resultNode(id: string, caseId: string): GameFlowNode {
  return {
    id,
    type: 'result',
    position: { x: 0, y: 0 },
    data: { nodeType: 'result', resultType: 'win', caseId, label: 'Win' },
  }
}

describe('case order identity', () => {
  it('derives the public number from the order', () => {
    expect([1, 2, 6, 10].map(caseNumberForOrder))
      .toEqual(['861', '862', '866', '8610'])
  })

  it('normalizes order, number, title, window, references, and result ownership', () => {
    const nodes: GameFlowNode[] = [
      caseNode('case-a', 2, 'old-a'),
      caseNode('case-b', 1, 'old-b'),
      messageNode('message', 'old-a'),
      // Deliberately claims old-a even though it belongs to case-b.
      resultNode('result', 'old-a'),
    ]
    const edges: GameFlowEdge[] = [
      { id: 'e1', source: 'case-b', target: 'message' },
      { id: 'e2', source: 'message', target: 'result' },
    ]

    const normalized = normalizeCaseOrder(nodes, edges)
    const cases = normalized.filter((node) => node.type === 'case')
    expect(cases.map((node) => [node.id, node.data.order, node.data.caseId, node.data.title]))
      .toEqual([
        ['case-a', 2, '862', 'Case 2'],
        ['case-b', 1, '861', 'Case 1'],
      ])
    expect(cases.map((node) => node.data.window?.caseId)).toEqual(['862', '861'])
    expect(normalized.find((node) => node.id === 'message')?.data.targetCaseId)
      .toBe('862')
    expect(normalized.find((node) => node.id === 'result')?.data.caseId)
      .toBe('861')
  })

  it('moves a case and shifts the others without duplicate orders', () => {
    const nodes = [
      caseNode('case-a', 1, '861'),
      caseNode('case-b', 2, '862'),
      caseNode('case-c', 3, '863'),
      messageNode('announcement', '863'),
    ]

    const moved = moveCaseToOrder(nodes, [], 'case-c', 1)
    const cases = moved
      .filter((node) => node.type === 'case')
      .sort((a, b) => a.data.order - b.data.order)
    expect(cases.map((node) => [node.id, node.data.order, node.data.caseId]))
      .toEqual([
        ['case-c', 1, '861'],
        ['case-a', 2, '862'],
        ['case-b', 3, '863'],
      ])
    expect(moved.find((node) => node.id === 'announcement')?.data.targetCaseId)
      .toBe('861')
  })

  it('repairs duplicate legacy orders deterministically and is idempotent', () => {
    const nodes = [
      caseNode('first-in-graph', 4, 'old-a'),
      caseNode('second-in-graph', 4, 'old-b'),
      caseNode('invalid-order', 0, 'old-c'),
    ]

    const once = normalizeCaseOrder(nodes, [])
    const twice = normalizeCaseOrder(once, [])
    const summary = twice
      .filter((node) => node.type === 'case')
      .map((node) => [node.id, node.data.order, node.data.caseId])
    expect(summary).toEqual([
      ['first-in-graph', 1, '861'],
      ['second-in-graph', 2, '862'],
      ['invalid-order', 3, '863'],
    ])
    expect(twice).toEqual(once)
  })
})

describe('result ownership', () => {
  it('uses the nearest playable upstream case and ignores trigger side branches', () => {
    const nodes = [
      caseNode('played-case', 6, '866'),
      caseNode('future-case', 7, '867'),
      messageNode('middle'),
      messageNode('trigger-message'),
      resultNode('result', '867'),
    ]
    const edges: GameFlowEdge[] = [
      { id: 'walker-1', source: 'played-case', target: 'middle', sourceHandle: 'release' },
      { id: 'walker-2', source: 'middle', target: 'result' },
      { id: 'trigger-1', source: 'future-case', target: 'trigger-message', sourceHandle: 'trigger' },
      { id: 'trigger-2', source: 'trigger-message', target: 'result' },
    ]

    expect(findOwningCaseNode('result', nodes, edges)?.id).toBe('played-case')
  })

  it('does not guess when different case branches merge at a result', () => {
    const nodes = [
      caseNode('case-a', 1, '861'),
      caseNode('case-b', 2, '862'),
      messageNode('longer-branch'),
      resultNode('shared-result', ''),
    ]
    const edges: GameFlowEdge[] = [
      { id: 'short', source: 'case-a', target: 'shared-result' },
      { id: 'long-1', source: 'case-b', target: 'longer-branch' },
      { id: 'long-2', source: 'longer-branch', target: 'shared-result' },
    ]

    expect(findOwningCaseNode('shared-result', nodes, edges)).toBeNull()
  })

  it('keeps the same owner through consecutive result screens', () => {
    const nodes = [
      caseNode('case', 3, '863'),
      resultNode('first-result', '863'),
      messageNode('between-results'),
      resultNode('second-result', ''),
    ]
    const edges: GameFlowEdge[] = [
      { id: 'e1', source: 'case', target: 'first-result' },
      { id: 'e2', source: 'first-result', target: 'between-results' },
      { id: 'e3', source: 'between-results', target: 'second-result' },
    ]

    expect(findOwningCaseNode('second-result', nodes, edges)?.id).toBe('case')
  })

  it('does not unlock the final tab from a stale future result id', () => {
    const nodes = [
      caseNode('played-case', 4, '864'),
      messageNode('middle'),
      // This was the canonical bug: order 4 reached a result labeled 866.
      resultNode('stale-result', '866'),
    ]
    const edges: GameFlowEdge[] = [
      { id: 'e1', source: 'played-case', target: 'middle' },
      { id: 'e2', source: 'middle', target: 'stale-result' },
    ]
    const completedCaseId = findOwningCaseNode('stale-result', nodes, edges)?.data.caseId
    const cases = Array.from({ length: 7 }, (_, index) => ({
      caseId: caseNumberForOrder(index + 1),
    }))

    expect(completedCaseId).toBe('864')
    expect(isCaseUnlocked(
      cases,
      6,
      new Set(completedCaseId ? [completedCaseId] : []),
      new Set(),
    )).toBe(false)
  })
})
