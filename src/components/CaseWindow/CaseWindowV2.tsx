import type { ComponentProps } from 'react'
import { CaseWindow } from './CaseWindow'
import styles from './CaseWindow.module.css'

export type CaseWindowV2Props = ComponentProps<typeof CaseWindow>

/**
 * New case-window design. The original CaseWindow remains available and
 * unchanged while design iterations are isolated behind this component.
 */
export function CaseWindowV2({ className, ...props }: CaseWindowV2Props) {
  return (
    <CaseWindow
      {...props}
      className={[styles.caseWindowV2, className].filter(Boolean).join(' ')}
    />
  )
}
