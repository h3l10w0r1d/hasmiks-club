import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import 'react-day-picker/style.css'

// value / onChange use a "YYYY-MM-DDTHH:mm" string — same shape the old
// datetime-local input produced, so it's a drop-in replacement.
function parse(value) {
  if (!value) return { date: undefined, time: '' }
  const [d, t] = value.split('T')
  const [y, m, day] = d.split('-').map(Number)
  return { date: new Date(y, m - 1, day), time: t ? t.slice(0, 5) : '' }
}

function combine(date, time) {
  if (!date) return ''
  const d = format(date, 'yyyy-MM-dd')
  return `${d}T${time || '00:00'}`
}

export function DateTimePicker({ value, onChange, className }) {
  const [open, setOpen] = React.useState(false)
  const { date, time } = parse(value)

  const label = date
    ? `${format(date, 'd MMM yyyy')}${time ? ` · ${time}` : ''}`
    : 'Pick a date & time'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring',
            className
          )}
        >
          <span className={cn('truncate', !date && 'text-muted-foreground')}>{label}</span>
          <CalendarDays className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="rdp-warm p-3">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => onChange(combine(d, time))}
            weekStartsOn={1}
          />
          <div className="flex items-center gap-2 border-t border-border pt-3 mt-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => onChange(combine(date || new Date(), e.target.value))}
              className="flex-1 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
