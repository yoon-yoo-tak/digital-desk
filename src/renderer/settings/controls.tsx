// Form controls shared by Settings and Onboarding (Settings.dc.html).

import styles from './Settings.module.css'

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={checked ? styles.switchOn : styles.switchOff}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}

export function Segmented<T extends string | number | null>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? styles.segmentOn : styles.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Group({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className={styles.groupWrap}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <div className={styles.group}>{children}</div>
    </section>
  )
}

export function Row({
  title,
  sub,
  mono = false,
  children
}: {
  title?: React.ReactNode
  sub?: React.ReactNode
  mono?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        {title && <div>{title}</div>}
        {sub && <div className={mono ? `${styles.sub} mono` : styles.sub}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export function SmallButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  return <button {...props} className={styles.smallButton} />
}
