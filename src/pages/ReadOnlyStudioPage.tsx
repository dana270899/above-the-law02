import { useState } from 'react'
import { RuleList } from '@/components/RuleList/RuleList'
import { ComponentsTab } from '@/components/editor/ComponentsTab/ComponentsTab'
import { ReadOnlyEditorCanvas } from '@/components/showcase/ReadOnlyEditorCanvas/ReadOnlyEditorCanvas'
import editorStyles from './EditorPage.module.css'
import styles from './ReadOnlyStudioPage.module.css'

type Tab = 'nodes' | 'components'

/**
 * Public mirror of the real project editor.
 *
 * It deliberately reuses the same Rule List, node renderers, graph positions,
 * connections, and Components catalog as the authoring page. The graph comes
 * from the immutable game-content artifact and every authoring surface is
 * inert, so this route cannot modify or save project data.
 */
export function ReadOnlyStudioPage() {
  const [tab, setTab] = useState<Tab>('nodes')

  return (
    <div className={editorStyles.layout}>
      <RuleList />
      <div className={editorStyles.main}>
        <div className={editorStyles.tabs}>
          <button
            type="button"
            className={`${editorStyles.tab} ${tab === 'nodes' ? editorStyles.tabActive : ''}`}
            onClick={() => setTab('nodes')}
          >
            Nodes
          </button>
          <button
            type="button"
            className={`${editorStyles.tab} ${tab === 'components' ? editorStyles.tabActive : ''}`}
            onClick={() => setTab('components')}
          >
            Components
          </button>
          <span className={styles.readOnly}>Read only</span>
        </div>
        <div className={editorStyles.panel}>
          {tab === 'nodes' ? (
            <ReadOnlyEditorCanvas />
          ) : (
            <div
              className={styles.inertComponents}
              {...({ inert: '' } as Record<string, string>)}
            >
              <ComponentsTab />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
