import { useState } from 'react'
import { EditorCanvas } from '@/components/editor/EditorCanvas/EditorCanvas'
import { ComponentsTab } from '@/components/editor/ComponentsTab/ComponentsTab'
import { RuleList } from '@/components/RuleList/RuleList'
import styles from './EditorPage.module.css'

type Tab = 'nodes' | 'components'

export function EditorPage() {
  const [tab, setTab] = useState<Tab>('nodes')

  return (
    <div className={styles.layout}>
      <RuleList />
      <div className={styles.main}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'nodes' ? styles.tabActive : ''}`}
            onClick={() => setTab('nodes')}
          >
            Nodes
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'components' ? styles.tabActive : ''}`}
            onClick={() => setTab('components')}
          >
            Components
          </button>
        </div>
        <div className={styles.panel}>
          {tab === 'nodes' ? <EditorCanvas /> : <ComponentsTab />}
        </div>
      </div>
    </div>
  )
}
