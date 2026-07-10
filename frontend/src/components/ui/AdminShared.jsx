import { Card, CardContent } from './card'
import { Skeleton } from './skeleton'
import { Label } from './label'
import { TableRow, TableCell } from './table'

export function initials(name = '') {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function KpiCard({ icon: Icon, label, value, valueClass = '', loading }) {
  if (loading) return <Card><CardContent className="p-5"><Skeleton className="h-4 w-20 mb-3" /><Skeleton className="h-9 w-12" /></CardContent></Card>
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/50" />}
        </div>
        <div className={`font-serif text-4xl font-semibold leading-none ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

export function SectionHeader({ title, sub, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground leading-tight">{title}</h1>
        {sub && <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{sub}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

export function Field({ label, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function TableSkeleton({ cols, rows = 5 }) {
  return (
    <>{Array.from({ length: rows }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
        ))}
      </TableRow>
    ))}</>
  )
}

export function MemberAvatar({ name, size = 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold flex-shrink-0 ${sz}`}>
      {initials(name)}
    </span>
  )
}
