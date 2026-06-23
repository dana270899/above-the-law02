import raw from '@/data/rule-list.md?raw'
import styles from './RuleList.module.css'

function stripBold(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
}

export function RuleList() {
  const lines = raw.split('\n')

  return (
    <aside className={styles.panel}>
      <div className={styles.content}>
        {lines.map((line, i) => {
          if (line.startsWith('# '))  return <h1 key={i}>{line.slice(2)}</h1>
          if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>
          if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>
          if (line.startsWith('- [ ] ')) return <li key={i} className={styles.todo}>☐ {stripBold(line.slice(6))}</li>
          if (line.startsWith('- [x] ')) return <li key={i} className={styles.done}>☑ {stripBold(line.slice(6))}</li>
          if (line.startsWith('- '))   return <li key={i}>{stripBold(line.slice(2))}</li>
          if (line.startsWith('| '))   return null
          if (line.startsWith('---'))  return <hr key={i} />
          if (line.trim() === '')      return <br key={i} />
          if (line.startsWith('```'))  return null
          return <p key={i}>{stripBold(line)}</p>
        })}
      </div>
    </aside>
  )
}
