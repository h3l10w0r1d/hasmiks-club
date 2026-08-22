import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Field, fmtDateTime } from '../ui/AdminShared'
import {
  adminListPromoCodes, adminGeneratePromoCode, adminCreatePromoCode,
  adminUpdatePromoCode, adminDeletePromoCode, adminPromoRedemptions,
} from '../../api/admin'

const EMPTY = {
  code: '', description: '',
  percent_off: '', amount_off: '', bonus_credits: '',
  starts_at: '', expires_at: '',
  max_uses: '', max_uses_per_user: '1',
  package_keys: [], active: true,
}

// '' -> null so a blank field means "no limit" rather than 0.
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
// <input type="datetime-local"> carries no timezone; send an ISO instant.
const toIso = (v) => (v ? new Date(v).toISOString() : null)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Admin CRUD for promo codes. Lives in the Settings tab beside Packages,
 * since a promo code is a pricing lever on those same packages. */
export default function PromoCodesCard({ packages = [], flash }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [redemptions, setRedemptions] = useState(null)

  // Manual refresh after a save/delete.
  const load = async () => {
    try { setRows(await adminListPromoCodes()) } catch { setRows([]) }
  }

  useEffect(() => {
    let alive = true
    adminListPromoCodes()
      .then((r) => { if (alive) setRows(r) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const startCreate = () => { setForm(EMPTY); setEditingId(null); setError(''); setOpen(true) }
  const startEdit = (p) => {
    setForm({
      code: p.code, description: p.description || '',
      percent_off: p.percent_off ?? '', amount_off: p.amount_off ?? '',
      bonus_credits: p.bonus_credits || '',
      starts_at: toLocalInput(p.starts_at), expires_at: toLocalInput(p.expires_at),
      max_uses: p.max_uses ?? '', max_uses_per_user: p.max_uses_per_user ?? '',
      package_keys: p.package_keys || [], active: p.active,
    })
    setEditingId(p.id); setError(''); setOpen(true)
  }

  const generate = async () => {
    try {
      const { code } = await adminGeneratePromoCode()
      setForm((f) => ({ ...f, code }))
    } catch { /* leave whatever's typed */ }
  }

  const togglePackage = (id) => setForm((f) => ({
    ...f,
    package_keys: f.package_keys.includes(id)
      ? f.package_keys.filter((k) => k !== id)
      : [...f.package_keys, id],
  }))

  const save = async () => {
    setBusy(true); setError('')
    const payload = {
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      percent_off: num(form.percent_off),
      amount_off: num(form.amount_off),
      bonus_credits: num(form.bonus_credits) || 0,
      starts_at: toIso(form.starts_at),
      expires_at: toIso(form.expires_at),
      max_uses: num(form.max_uses),
      max_uses_per_user: num(form.max_uses_per_user),
      package_keys: form.package_keys,
      active: form.active,
    }
    try {
      if (editingId) await adminUpdatePromoCode(editingId, payload)
      else await adminCreatePromoCode(payload)
      setOpen(false); setForm(EMPTY); setEditingId(null)
      await load()
      flash?.(editingId ? 'Promo code updated' : 'Promo code created')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not save this code')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.code}? Past purchases keep their record, but the code stops working.`)) return
    try { await adminDeletePromoCode(p.id); await load(); flash?.('Promo code deleted') } catch { /* ignore */ }
  }

  const showRedemptions = async (p) => {
    setRedemptions({ code: p.code, rows: null })
    try { setRedemptions({ code: p.code, rows: await adminPromoRedemptions(p.id) }) }
    catch { setRedemptions({ code: p.code, rows: [] }) }
  }

  const benefit = (p) => [
    p.percent_off ? `${p.percent_off}% off` : null,
    p.amount_off ? `֏${Number(p.amount_off).toLocaleString()} off` : null,
    p.bonus_credits ? `+${p.bonus_credits} visit${p.bonus_credits === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Promo Codes</CardTitle>
        <CardDescription>
          Discount codes members can enter when buying a package. A code can take a percentage or a fixed amount off,
          grant extra visits, or both — 100% off makes the package free. Every limit is optional; leave a field blank for no limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows?.length === 0 && !open && <p className="text-sm text-muted-foreground">No promo codes yet.</p>}

        {rows?.length > 0 && (
          <div className="space-y-2">
            {rows.map((p) => {
              const usedUp = p.max_uses != null && p.times_used >= p.max_uses
              const expired = p.expires_at && new Date(p.expires_at) < new Date()
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <code className="rounded bg-muted px-2 py-1 text-sm font-semibold tracking-wider">{p.code}</code>
                  <span className="text-sm">{benefit(p)}</span>
                  {!p.active && <Badge variant="secondary">Off</Badge>}
                  {expired && <Badge variant="secondary">Expired</Badge>}
                  {usedUp && <Badge variant="secondary">Used up</Badge>}
                  {p.package_keys.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      only {p.package_keys.map((k) => packages.find((x) => x.id === k)?.nameEn || k).join(', ')}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    used {p.times_used}{p.max_uses != null ? `/${p.max_uses}` : ''}
                    {p.expires_at ? ` · until ${fmtDateTime(p.expires_at)}` : ''}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => showRedemptions(p)} title="Who used it">
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(p)}>Edit</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {redemptions && (
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Redemptions — {redemptions.code}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRedemptions(null)}>Close</Button>
            </div>
            {redemptions.rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
            {redemptions.rows?.length === 0 && <p className="text-sm text-muted-foreground">Nobody has used this code yet.</p>}
            {redemptions.rows?.map((r) => (
              <div key={r.id} className="flex justify-between border-t py-1.5 text-sm">
                <span>{r.user_name}{r.user_email ? ` · ${r.user_email}` : ''}</span>
                <span className="text-muted-foreground">
                  {r.discount_amount > 0 ? `−֏${Number(r.discount_amount).toLocaleString()}` : ''}
                  {r.bonus_credits > 0 ? ` +${r.bonus_credits}` : ''} · {fmtDateTime(r.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!open && (
          <Button type="button" variant="outline" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" /> New promo code
          </Button>
        )}

        {open && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code (blank = generate one)">
                <div className="flex gap-2">
                  <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" />
                  <Button type="button" variant="outline" size="sm" onClick={generate} title="Generate a code">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Field>
              <Field label="Internal note (never shown to members)">
                <Textarea rows={1} value={form.description} onChange={set('description')} placeholder="Instagram launch campaign" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Percent off (1–100)">
                <Input type="number" min="1" max="100" value={form.percent_off}
                  onChange={(e) => setForm((f) => ({ ...f, percent_off: e.target.value, amount_off: '' }))} placeholder="20" />
              </Field>
              <Field label="Or fixed amount off (֏)">
                <Input type="number" min="1" value={form.amount_off}
                  onChange={(e) => setForm((f) => ({ ...f, amount_off: e.target.value, percent_off: '' }))} placeholder="5000" />
              </Field>
              <Field label="Bonus free visits">
                <Input type="number" min="0" value={form.bonus_credits} onChange={set('bonus_credits')} placeholder="2" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts (blank = immediately)">
                <Input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} />
              </Field>
              <Field label="Expires (blank = never)">
                <Input type="datetime-local" value={form.expires_at} onChange={set('expires_at')} />
              </Field>
              <Field label="Total uses (blank = unlimited)">
                <Input type="number" min="1" value={form.max_uses} onChange={set('max_uses')} placeholder="50" />
              </Field>
              <Field label="Uses per member (blank = unlimited)">
                <Input type="number" min="1" value={form.max_uses_per_user} onChange={set('max_uses_per_user')} placeholder="1" />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Applies to (none selected = every package)</span>
              <div className="flex flex-wrap gap-2">
                {packages.map((p) => (
                  <button key={p.id} type="button" onClick={() => togglePackage(p.id)}
                    className={`rounded-full border px-3 py-1 text-xs ${form.package_keys.includes(p.id) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    {p.nameEn || p.id}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary cursor-pointer"
                checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create code'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
