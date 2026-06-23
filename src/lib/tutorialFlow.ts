import type { GameFlowNode, GameFlowEdge } from '@/types/editor'
import { DEFAULT_CASE_DATA } from '@/components/CaseWindow'
import { assetUrl } from './paths'

/**
 * TUTORIAL FLOW PRESET
 *
 * A self-contained chain of nodes + edges that the editor injects on
 * demand. Every id is prefixed `tut-` so the injector can detect a
 * prior run and refuse to duplicate. The chain starts at
 * `tut-msg-welcome` — to make it live the user wires their existing
 * `login` node's outgoing edge to that node.
 *
 * Sequence:
 *   welcome → learn → rewards (opens Achievements) → job →
 *   start (opens case 891) → details → check (advance edge) →
 *   case-891 (paused here; player interacts)
 *     ⚡ expandRow s1   → "Don't forget to check the attachment"
 *     ⚡ attachmentRow s1 → "And now you decide if to arrest or release"
 *     ⚡ arrest (retry)  → voice "I give you another chance" (subtitle)
 *     release handle     → "good job" → result-win → newCase msg → case-892
 */

export const TUTORIAL_NODE_PREFIX = 'tut-'

/** A column-based layout — all ids fixed so re-injection is idempotent. */
export function buildTutorialNodes(): GameFlowNode[] {
  const x = 1200 // off to the right of the existing default layout
  const dy = 220 // vertical spacing
  let row = 0
  const next = () => ({ x, y: 40 + row++ * dy })

  return [
    {
      id: 'tut-msg-welcome',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Welcome to your new role as Police Chief!',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-msg-learn',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'I’m sure you’ll quickly learn how things work around here.',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-msg-rewards',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Make the right calls, and you’ll earn rewards!',
        buttonLabel: 'Next',
        buttonLinkType: 'achievements',
        buttonUrl: '',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-msg-job',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Your job is to review cases and decide whether to arrest or release. Easy peasy!',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-msg-start',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Let’s start with a simple case.',
        buttonLabel: 'Open case',
        buttonLinkType: 'newCase',
        buttonUrl: '',
        targetCaseId: '891',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-msg-details',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'First you read the details, but quickly, we work fast here!',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 70, locationY: 75,
      },
    },
    {
      id: 'tut-msg-check',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Check the suspicion and if there is past criminal record',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 70, locationY: 75,
      },
    },
    {
      id: 'tut-case-891',
      type: 'case',
      position: next(),
      data: {
        nodeType: 'case',
        caseId: '891',
        title: 'Case 891 — Tutorial',
        order: 1,
        hasOperation: false,
        window: {
          ...DEFAULT_CASE_DATA,
          caseId: '891',
          suspicions: [
            {
              id: 's1',
              subject: 'Palestinian flag graffiti',
              status: 'Urgent',
              statusColor: 'red',
              date: '08/02/2026',
              fileUrl: '',
              fileFootageVariant: 'graffiti',
              details:
                'Subject suspected in a large-scale security incident involving Palestinian flag graffiti on a municipal building wall.',
            },
          ],
        },
      },
    },
    {
      id: 'tut-trig-expand',
      type: 'trigger',
      position: { x: x + 380, y: 40 + (row - 1) * dy + 60 },
      data: {
        nodeType: 'trigger',
        triggerType: 'expandRow',
        targetRowId: 's1',
      },
    },
    {
      id: 'tut-msg-attachment',
      type: 'message',
      position: { x: x + 380, y: 40 + (row - 1) * dy + 260 },
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'Don’t forget to check the attachment',
        buttonLabel: 'Got it',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 70, locationY: 30,
      },
    },
    {
      id: 'tut-trig-attach',
      type: 'trigger',
      position: { x: x + 720, y: 40 + (row - 1) * dy + 60 },
      data: {
        nodeType: 'trigger',
        triggerType: 'attachmentRow',
        targetRowId: 's1',
      },
    },
    {
      id: 'tut-msg-decide',
      type: 'message',
      position: { x: x + 720, y: 40 + (row - 1) * dy + 260 },
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'And now you decide if to arrest or release',
        buttonLabel: 'Got it',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 70, locationY: 30,
      },
    },
    {
      id: 'tut-trig-arrest-retry',
      type: 'trigger',
      position: { x: x - 360, y: 40 + (row - 1) * dy + 60 },
      data: {
        nodeType: 'trigger',
        triggerType: 'arrest',
        retry: true,
      },
    },
    {
      id: 'tut-msg-anotherchance',
      type: 'message',
      position: { x: x - 360, y: 40 + (row - 1) * dy + 260 },
      data: {
        nodeType: 'message',
        messageType: 'voice',
        content: assetUrl('/sounds/notification.mp3'),
        subtitle: 'I give you another chance',
        buttonLabel: '',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 70, locationY: 40,
      },
    },
    {
      id: 'tut-msg-goodjob',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'good job',
        buttonLabel: 'Next',
        buttonLinkType: 'edge',
        buttonUrl: '',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-result-891-win',
      type: 'result',
      position: next(),
      data: {
        nodeType: 'result',
        resultType: 'win',
        caseId: '891',
        label: 'Case 891 — Released (correct)',
      },
    },
    {
      id: 'tut-msg-newcase',
      type: 'message',
      position: next(),
      data: {
        nodeType: 'message',
        messageType: 'link',
        content: 'got you a new case my friend',
        buttonLabel: 'Open case',
        buttonLinkType: 'newCase',
        buttonUrl: '',
        targetCaseId: '892',
        locationX: 50, locationY: 50,
      },
    },
    {
      id: 'tut-case-892',
      type: 'case',
      position: next(),
      data: {
        nodeType: 'case',
        caseId: '892',
        title: 'Case 892',
        order: 2,
        hasOperation: false,
      },
    },
  ]
}

export function buildTutorialEdges(): GameFlowEdge[] {
  return [
    // Linear walker chain
    { id: 'tut-e-welcome-learn',     source: 'tut-msg-welcome',       target: 'tut-msg-learn' },
    { id: 'tut-e-learn-rewards',     source: 'tut-msg-learn',         target: 'tut-msg-rewards' },
    { id: 'tut-e-rewards-job',       source: 'tut-msg-rewards',       target: 'tut-msg-job' },
    { id: 'tut-e-job-start',         source: 'tut-msg-job',           target: 'tut-msg-start' },
    { id: 'tut-e-start-details',     source: 'tut-msg-start',         target: 'tut-msg-details' },
    { id: 'tut-e-details-check',     source: 'tut-msg-details',       target: 'tut-msg-check' },
    { id: 'tut-e-check-case',        source: 'tut-msg-check',         target: 'tut-case-891' },

    // Case 891 triggers (side graph — sourceHandle 'trigger')
    { id: 'tut-e-case-trig-expand',  source: 'tut-case-891', sourceHandle: 'trigger', target: 'tut-trig-expand' },
    { id: 'tut-e-trig-expand-msg',   source: 'tut-trig-expand',       target: 'tut-msg-attachment' },
    { id: 'tut-e-case-trig-attach',  source: 'tut-case-891', sourceHandle: 'trigger', target: 'tut-trig-attach' },
    { id: 'tut-e-trig-attach-msg',   source: 'tut-trig-attach',       target: 'tut-msg-decide' },
    { id: 'tut-e-case-trig-arrest',  source: 'tut-case-891', sourceHandle: 'trigger', target: 'tut-trig-arrest-retry' },
    { id: 'tut-e-trig-arrest-msg',   source: 'tut-trig-arrest-retry', target: 'tut-msg-anotherchance' },

    // Release walker path
    { id: 'tut-e-case-release',      source: 'tut-case-891', sourceHandle: 'release', target: 'tut-msg-goodjob' },
    { id: 'tut-e-goodjob-result',    source: 'tut-msg-goodjob',       target: 'tut-result-891-win' },
    { id: 'tut-e-result-newcase',    source: 'tut-result-891-win',    target: 'tut-msg-newcase' },
    { id: 'tut-e-newcase-case892',   source: 'tut-msg-newcase',       target: 'tut-case-892' },
  ]
}
