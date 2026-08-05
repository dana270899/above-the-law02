import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameFlowEdge, GameFlowNode } from '@/types/editor'
import { useSharedGameContent } from '@/components/game/GameContentProvider'
import { CaseWindowV2 as CaseWindow, DEFAULT_CASE_DATA } from '@/components/CaseWindow'
import {
  FootageWindow,
  DEFAULT_FOOTAGE_DATA,
  DEFAULT_INDECENT_EXPOSURE_DATA,
} from '@/components/FootageWindow'
import {
  OperationWindowV2,
  DEFAULT_OPERATION_V2_DATA,
} from '@/components/OperationWindowV2'
import { AchievementsWindow } from '@/components/AchievementsWindow'
import { BossMessage } from '@/components/game/BossMessage/BossMessage'
import { WinScreenComponent } from '@/components/game/WinScreen'
import type { WinVariant } from '@/lib/winScreenImage'
import styles from './ReadOnlyStudioPage.module.css'

type StudioTab = 'nodes' | 'components'

const NODE_WIDTH = 230
const NODE_HEIGHT = 116
const WORLD_PADDING = 180

const NODE_APPEARANCE: Record<string, { icon: string; label: string; color: string }> = {
  login: { icon: '🔑', label: 'Login', color: '#c8a800' },
  intro: { icon: '▶', label: 'Intro', color: '#8365b6' },
  case: { icon: '📁', label: 'Case', color: '#185fa5' },
  operation: { icon: '⚙', label: 'Operation', color: '#915d00' },
  result: { icon: '★', label: 'Result', color: '#008955' },
  prize: { icon: '🎁', label: 'Prize', color: '#a33b84' },
  message: { icon: '💬', label: 'Message', color: '#7258a4' },
  miniGame: { icon: '🎮', label: 'Mini Game', color: '#c84b31' },
  trigger: { icon: '⚡', label: 'Trigger', color: '#c48400' },
  secondArrest: { icon: '↪', label: 'Second Arrest', color: '#aa4433' },
  bgMusic: { icon: '♫', label: 'Background Music', color: '#774a9b' },
  ranking: { icon: '🏆', label: 'Ranking', color: '#287a52' },
  scoring: { icon: '+', label: 'Global Points', color: '#287a52' },
  points: { icon: '±', label: 'Points', color: '#287a52' },
}

const WIN_VARIANTS: Array<{ id: WinVariant; label: string }> = [
  { id: 'graffiti', label: 'Graffiti' },
  { id: 'punching-dummy', label: 'Punching Dummy' },
  { id: 'kippah-cutting', label: 'Kippah Cutting' },
  { id: 'bdsm-party', label: 'BDSM Party' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'picnic', label: 'Picnic' },
  { id: 'eilat', label: 'Eilat' },
]

export function ReadOnlyStudioPage() {
  const [tab, setTab] = useState<StudioTab>('nodes')

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Above the Law</p>
          <h1 className={styles.title}>Project showcase</h1>
        </div>
        <span className={styles.readOnlyBadge}>Read only</span>
      </header>

      <nav className={styles.tabs} aria-label="Showcase views">
        <button
          type="button"
          className={`${styles.tab} ${tab === 'nodes' ? styles.tabActive : ''}`}
          aria-current={tab === 'nodes' ? 'page' : undefined}
          onClick={() => setTab('nodes')}
        >
          Nodes
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'components' ? styles.tabActive : ''}`}
          aria-current={tab === 'components' ? 'page' : undefined}
          onClick={() => setTab('components')}
        >
          Components
        </button>
      </nav>

      <section className={styles.panel}>
        {tab === 'nodes' ? <ReadOnlyFlow /> : <ReadOnlyComponents />}
      </section>
    </main>
  )
}

function ReadOnlyFlow() {
  const sharedContent = useSharedGameContent()
  const nodes = sharedContent?.graph.nodes ?? []
  const edges = sharedContent?.graph.edges ?? []
  const loading = sharedContent?.isLoading ?? true
  const [zoom, setZoom] = useState(0.4)
  const viewportRef = useRef<HTMLDivElement>(null)

  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, width: 1200, height: 700 }
    }
    const minX = Math.min(...nodes.map((node) => node.position.x))
    const minY = Math.min(...nodes.map((node) => node.position.y))
    const maxX = Math.max(...nodes.map((node) => node.position.x + NODE_WIDTH))
    const maxY = Math.max(...nodes.map((node) => node.position.y + NODE_HEIGHT))
    return {
      minX,
      minY,
      width: maxX - minX + WORLD_PADDING * 2,
      height: maxY - minY + WORLD_PADDING * 2,
    }
  }, [nodes])

  const positions = useMemo(() => new Map(nodes.map((node) => [
    node.id,
    {
      x: node.position.x - bounds.minX + WORLD_PADDING,
      y: node.position.y - bounds.minY + WORLD_PADDING,
    },
  ])), [bounds.minX, bounds.minY, nodes])

  const fitGraph = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const next = Math.min(
      (viewport.clientWidth - 40) / bounds.width,
      (viewport.clientHeight - 40) / bounds.height,
      1,
    )
    setZoom(Math.max(0.08, next))
    viewport.scrollTo({ left: 0, top: 0 })
  }, [bounds.height, bounds.width])

  useEffect(() => {
    if (nodes.length === 0) return
    const frame = window.requestAnimationFrame(fitGraph)
    return () => window.cancelAnimationFrame(frame)
  }, [fitGraph, nodes.length])

  if (loading) return <div className={styles.loading}>Loading published graph…</div>
  if (nodes.length === 0) return <div className={styles.loading}>No published nodes found.</div>

  return (
    <div className={styles.flowWrap}>
      <div className={styles.flowToolbar}>
        <div>
          <strong>{nodes.length} nodes</strong>
          <span>{edges.length} connections</span>
        </div>
        <div className={styles.zoomControls} aria-label="Graph zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.08, value - 0.1))} aria-label="Zoom out">−</button>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))} aria-label="Zoom in">+</button>
          <button type="button" className={styles.fitButton} onClick={fitGraph}>Fit</button>
        </div>
      </div>

      <div ref={viewportRef} className={styles.flowViewport}>
        <div
          className={styles.scaledWorld}
          style={{ width: bounds.width * zoom, height: bounds.height * zoom }}
        >
          <div
            className={styles.flowWorld}
            style={{
              width: bounds.width,
              height: bounds.height,
              transform: `scale(${zoom})`,
            }}
          >
            <svg className={styles.edges} width={bounds.width} height={bounds.height} aria-hidden="true">
              {edges.map((edge) => (
                <ReadOnlyEdge key={edge.id} edge={edge} positions={positions} />
              ))}
            </svg>
            {nodes.map((node) => {
              const position = positions.get(node.id)
              if (!position) return null
              return <ReadOnlyNode key={node.id} node={node} x={position.x} y={position.y} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyEdge({
  edge,
  positions,
}: {
  edge: GameFlowEdge
  positions: Map<string, { x: number; y: number }>
}) {
  const source = positions.get(edge.source)
  const target = positions.get(edge.target)
  if (!source || !target) return null
  const x1 = source.x + NODE_WIDTH / 2
  const y1 = source.y + NODE_HEIGHT
  const x2 = target.x + NODE_WIDTH / 2
  const y2 = target.y
  const bend = Math.max(50, Math.abs(y2 - y1) * 0.45)
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`}
      className={styles.edge}
    />
  )
}

function ReadOnlyNode({ node, x, y }: { node: GameFlowNode; x: number; y: number }) {
  const appearance = NODE_APPEARANCE[node.type ?? ''] ?? {
    icon: '◆',
    label: node.type ?? 'Node',
    color: '#666',
  }
  const details = describeNode(node)

  return (
    <article
      className={styles.node}
      style={{ left: x, top: y, borderColor: appearance.color }}
      aria-label={`${appearance.label} node`}
    >
      <span className={styles.nodePortTop} style={{ borderColor: appearance.color }} />
      <header className={styles.nodeHeader} style={{ color: appearance.color }}>
        <span>{appearance.icon}</span>
        <strong>{appearance.label}</strong>
      </header>
      <h2 className={styles.nodeTitle}>{details.title}</h2>
      <p className={styles.nodeMeta}>{details.meta}</p>
      <span className={styles.nodePortBottom} style={{ borderColor: appearance.color }} />
    </article>
  )
}

function describeNode(node: GameFlowNode): { title: string; meta: string } {
  const data = node.data as Record<string, unknown>
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback

  switch (node.type) {
    case 'login':
      return { title: text(data.label, 'Login Screen'), meta: 'Entry point' }
    case 'case':
      return {
        title: `Case #${text(data.caseId, String(data.order ?? ''))}`,
        meta: text(data.title, `Case ${String(data.order ?? '')}`),
      }
    case 'operation':
      return { title: text(data.title, 'Operation'), meta: text(data.operationId, 'Operation step') }
    case 'result':
      return { title: text(data.label, 'Result'), meta: `${text(data.resultType, 'result')} · ${text(data.winImage, 'default screen')}` }
    case 'message':
      return { title: text(data.content, 'Message').slice(0, 48), meta: `${text(data.messageType, 'text')} message` }
    case 'miniGame':
      return { title: text(data.label, 'Mini Game'), meta: 'Interactive game step' }
    case 'trigger':
      return { title: text(data.triggerType, 'Trigger'), meta: data.targetRowId ? `Row ${String(data.targetRowId)}` : 'Event trigger' }
    case 'points':
      return { title: `${Number(data.amount ?? 0) >= 0 ? '+' : ''}${String(data.amount ?? 0)} points`, meta: 'Score adjustment' }
    case 'bgMusic':
      return { title: text(data.src, 'Background Music'), meta: `${Math.round(Number(data.volume ?? 0) * 100)}% volume` }
    case 'ranking':
    case 'scoring':
      return { title: text(data.title, 'Scoring'), meta: data.winningTarget ? `${String(data.winningTarget)} point target` : 'Final score' }
    case 'secondArrest':
      return { title: 'Second arrest', meta: 'Decision gate' }
    default:
      return { title: text(data.title ?? data.label, node.id), meta: node.id }
  }
}

function ReadOnlyComponents() {
  return (
    <div className={styles.componentPage}>
      <nav className={styles.anchorNav} aria-label="Components on this page">
        {[
          ['case-window', 'Case Window'],
          ['footage-window', 'Footage Window'],
          ['operation-window', 'Operation Window'],
          ['achievements-window', 'Achievements'],
          ['boss-message', 'Boss Message'],
          ['win-screens', 'Win Screens'],
        ].map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <ShowcaseSection id="case-window" title="Case Window" source="src/components/CaseWindow">
        <PreviewStage wide><CaseWindow data={DEFAULT_CASE_DATA} /></PreviewStage>
      </ShowcaseSection>

      <ShowcaseSection id="footage-window" title="Footage Window" source="src/components/FootageWindow">
        <div className={styles.previewList}>
          <PreviewCard label="Graffiti"><FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="graffiti" /></PreviewCard>
          <PreviewCard label="Graffiti video"><FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="graffiti-video" /></PreviewCard>
          <PreviewCard label="Jewish violence"><FootageWindow data={DEFAULT_FOOTAGE_DATA} variant="jewish-violence" /></PreviewCard>
          <PreviewCard label="Indecent exposure"><FootageWindow data={DEFAULT_INDECENT_EXPOSURE_DATA} variant="indecent-exposure" /></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="operation-window" title="Operation Window" source="src/components/OperationWindowV2">
        <PreviewStage wide><OperationWindowV2 data={DEFAULT_OPERATION_V2_DATA} /></PreviewStage>
      </ShowcaseSection>

      <ShowcaseSection id="achievements-window" title="Achievements" source="src/components/AchievementsWindow">
        <div className={styles.previewList}>
          <PreviewCard label="In progress"><AchievementsWindow results={['win', 'win', 'lose', null, null, null]} total={420} /></PreviewCard>
          <PreviewCard label="Complete"><AchievementsWindow results={['win', 'win', 'win', 'win', 'win', 'win']} total={1000} /></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="boss-message" title="Boss Message" source="src/components/game/BossMessage">
        <div className={styles.previewList}>
          <PreviewCard label="Text"><BossMessage type="text" text="Get to the office. We have a new case." /></PreviewCard>
          <PreviewCard label="Link"><BossMessage type="link" text="Open the case file to review the evidence." buttonLabel="Open" /></PreviewCard>
        </div>
      </ShowcaseSection>

      <ShowcaseSection id="win-screens" title="Win Screens" source="src/components/game/WinScreen">
        <div className={styles.winGrid}>
          {WIN_VARIANTS.map((variant) => (
            <PreviewCard key={variant.id} label={variant.label}>
              <div className={styles.winPreview}>
                <WinScreenComponent variant={variant.id} muteAudio />
              </div>
            </PreviewCard>
          ))}
        </div>
      </ShowcaseSection>
    </div>
  )
}

function ShowcaseSection({
  id,
  title,
  source,
  children,
}: {
  id: string
  title: string
  source: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={styles.componentSection}>
      <header className={styles.sectionHeader}>
        <h2>{title}</h2>
        <span>{source}</span>
      </header>
      {children}
    </section>
  )
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <article className={styles.previewCard}>
      <h3>{label}</h3>
      <PreviewStage>{children}</PreviewStage>
    </article>
  )
}

function PreviewStage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`${styles.previewStage} ${wide ? styles.previewStageWide : ''}`}>
      <div
        className={styles.previewInteractionGuard}
        aria-hidden="true"
        {...({ inert: '' } as Record<string, string>)}
      >
        {children}
      </div>
    </div>
  )
}
