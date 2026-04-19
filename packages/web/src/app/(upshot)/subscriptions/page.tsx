"use client";

import { useState, useRef, useEffect } from "react";
import {
  useSubscriptions,
  useCreateSubscription,
  useUpdateSubscription,
  useDeleteSubscription,
} from "@/hooks/use-subscriptions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Subscription } from "@todo/db";
import type { BillingPeriod } from "@todo/shared";

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = ["streaming", "software", "storage", "gaming", "news", "health", "finance", "utilities", "other"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  streaming:  { label: "Streaming",  color: "#6366f1" },
  software:   { label: "Software",   color: "#0ea5e9" },
  storage:    { label: "Storage",    color: "#8b5cf6" },
  gaming:     { label: "Gaming",     color: "#f59e0b" },
  news:       { label: "News",       color: "#10b981" },
  health:     { label: "Health",     color: "#ef4444" },
  finance:    { label: "Finance",    color: "#06b6d4" },
  utilities:  { label: "Utilities",  color: "#84cc16" },
  other:      { label: "Other",      color: "#6b7280" },
};

const BILLING_PERIODS = ["weekly", "monthly", "annual"] as const;

function categoryColor(cat: string | null): string {
  return CATEGORY_META[cat as Category]?.color ?? "#6b7280";
}

function categoryLabel(cat: string | null): string {
  return CATEGORY_META[cat as Category]?.label ?? (cat ?? "Other");
}

// ── Amount helpers ────────────────────────────────────────────────────────────

function effectiveAmount(sub: Subscription): number {
  return sub.isSplit ? sub.amount / 2 : sub.amount;
}

function monthlyEquivalent(sub: Subscription): number {
  const amt = effectiveAmount(sub);
  if (sub.billingPeriod === "annual") return amt / 12;
  if (sub.billingPeriod === "weekly") return amt * 4.33;
  return amt;
}

function amountLabel(sub: Subscription): string {
  const amt = effectiveAmount(sub);
  const suffix = sub.billingPeriod === "annual" ? "/yr" : sub.billingPeriod === "weekly" ? "/wk" : "/mo";
  return `$${amt.toFixed(2)}${suffix}`;
}

function moLabel(sub: Subscription): string | null {
  if (sub.billingPeriod === "monthly") return null;
  return `$${monthlyEquivalent(sub).toFixed(2)}/mo`;
}

// ── Countdown helpers ─────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function countdownLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

function countdownColor(days: number): string {
  if (days <= 0) return "#ef4444";
  if (days <= 7) return "#f59e0b";
  return "var(--ink-4)";
}

function advanceDueDate(dateStr: string, period: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === "weekly") d.setDate(d.getDate() + 7);
  else if (period === "monthly") d.setMonth(d.getMonth() + 1);
  else if (period === "annual") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Form dialog ───────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  amount: string;
  billingPeriod: BillingPeriod;
  nextDueDate: string;
  category: string;
  autoRenew: boolean;
  isSplit: boolean;
  url: string;
  notes: string;
  isActive: boolean;
}

const BLANK: FormState = {
  name: "", amount: "", billingPeriod: "monthly", nextDueDate: "",
  category: "", autoRenew: true, isSplit: false, url: "", notes: "", isActive: true,
};

function toFormState(s: Subscription): FormState {
  return {
    name: s.name,
    amount: String(s.amount),
    billingPeriod: s.billingPeriod as BillingPeriod,
    nextDueDate: s.nextDueDate ?? "",
    category: s.category ?? "",
    autoRenew: s.autoRenew,
    isSplit: s.isSplit,
    url: s.url ?? "",
    notes: s.notes ?? "",
    isActive: s.isActive,
  };
}

function SubscriptionDialog({
  open,
  onClose,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  subscription: Subscription | null;
}) {
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();
  const submittedRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);

  useEffect(() => {
    setForm(subscription ? toFormState(subscription) : BLANK);
    setDeleting(false);
  }, [subscription?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (submittedRef.current || !form.name.trim() || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    submittedRef.current = true;
    try {
      const payload = {
        name: form.name.trim(),
        amount,
        billingPeriod: form.billingPeriod,
        nextDueDate: form.nextDueDate || undefined,
        category: form.category || undefined,
        autoRenew: form.autoRenew,
        isSplit: form.isSplit,
        url: form.url.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      };
      if (subscription) {
        await updateSub.mutateAsync({ id: subscription.id, ...payload });
      } else {
        await createSub.mutateAsync(payload);
      }
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  async function handleDelete() {
    if (!subscription || submittedRef.current) return;
    submittedRef.current = true;
    try {
      await deleteSub.mutateAsync(subscription.id);
      onClose();
    } finally {
      submittedRef.current = false;
    }
  }

  const busy = createSub.isPending || updateSub.isPending || deleteSub.isPending;
  const canSubmit = !!form.name.trim() && !!form.amount && parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{subscription ? "Edit Subscription" : "New Subscription"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Netflix"
              autoFocus
            />
          </div>

          {/* Amount + billing period */}
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="9.99"
                  type="number"
                  min={0}
                  step={0.01}
                  className="pl-6"
                />
              </div>
              <div className="flex rounded-md border border-border overflow-hidden">
                {BILLING_PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("billingPeriod", p)}
                    className={`px-3 text-xs font-medium transition-colors ${
                      form.billingPeriod === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "weekly" ? "Wkly" : p === "monthly" ? "Mo" : "Yr"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Next due date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="due">Next due date</Label>
            <Input
              id="due"
              type="date"
              value={form.nextDueDate}
              onChange={(e) => set("nextDueDate", e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("category", form.category === c ? "" : c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">URL (optional)</Label>
            <Input
              id="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://netflix.com"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <Toggle
              label="Split with Katie (÷2)"
              checked={form.isSplit}
              onChange={(v) => set("isSplit", v)}
            />
            <Toggle
              label="Auto-renews"
              checked={form.autoRenew}
              onChange={(v) => set("autoRenew", v)}
            />
            {subscription && (
              <Toggle
                label="Active (uncheck to pause)"
                checked={form.isActive}
                onChange={(v) => set("isActive", v)}
              />
            )}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          {subscription && !deleting && (
            <Button variant="destructive" onClick={() => setDeleting(true)} disabled={busy} className="mr-auto">
              Delete
            </Button>
          )}
          {deleting && (
            <Button variant="destructive" onClick={handleDelete} disabled={busy} className="mr-auto">
              Confirm delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !canSubmit}>
            {subscription ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-primary" : "bg-input"}`}
      >
        <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      <Label className="cursor-pointer" onClick={() => onChange(!checked)}>{label}</Label>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { data: allSubs = [], isLoading } = useSubscriptions(false);
  const updateSub = useUpdateSubscription();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  function handleRenew(sub: Subscription) {
    if (!sub.nextDueDate) return;
    updateSub.mutate({ id: sub.id, nextDueDate: advanceDueDate(sub.nextDueDate, sub.billingPeriod) });
  }

  function openAdd() { setEditing(null); setDialogOpen(true); }
  function openEdit(s: Subscription) { setEditing(s); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  const activeSubs = allSubs.filter((s) => s.isActive);
  const inactiveSubs = allSubs.filter((s) => !s.isActive);

  // Monthly totals for active only
  const monthlyTotal = activeSubs.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const annualTotal = monthlyTotal * 12;

  // Categories that have active subs (for filter pills)
  const activeCats = [...new Set(activeSubs.map((s) => s.category ?? "other"))].filter(Boolean);

  const filteredSubs = (catFilter === "all" ? activeSubs : activeSubs.filter((s) => (s.category ?? "other") === catFilter))
    .sort((a, b) => {
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return a.nextDueDate.localeCompare(b.nextDueDate);
    });

  const filteredInactive = (catFilter === "all" ? inactiveSubs : inactiveSubs.filter((s) => (s.category ?? "other") === catFilter))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 16px 20px 16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--ink)", margin: "0 0 4px 0" }}>
            Subscriptions
          </h1>
          {activeSubs.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>
              ${monthlyTotal.toFixed(2)}/mo · ${annualTotal.toFixed(0)}/yr
            </p>
          )}
        </div>
        <Button onClick={openAdd} size="sm" style={{ marginTop: 6 }}>+ Add</Button>
      </div>

      {/* Summary cards */}
      {activeSubs.length > 0 && (
        <div style={{ padding: "0 16px 20px 16px", display: "flex", gap: 10 }}>
          <SummaryCard label="Monthly" value={`$${monthlyTotal.toFixed(2)}`} />
          <SummaryCard label="Annual" value={`$${annualTotal.toFixed(0)}`} />
          <SummaryCard label="Active" value={String(activeSubs.length)} />
        </div>
      )}

      {/* Category filter pills */}
      {activeCats.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: "0 16px 16px 16px", flexWrap: "wrap" }}>
          {(["all", ...activeCats] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{
                padding: "4px 12px",
                borderRadius: 100,
                border: `1px solid ${catFilter === c ? (c === "all" ? "var(--primary)" : categoryColor(c)) : "var(--hairline)"}`,
                background: catFilter === c ? (c === "all" ? "var(--primary)" : `${categoryColor(c)}18`) : "transparent",
                color: catFilter === c ? (c === "all" ? "var(--primary-foreground)" : categoryColor(c)) : "var(--ink-3)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {c === "all" ? "All" : categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 64, background: "var(--surface)", borderRadius: 12, opacity: 0.5 }} />
          ))}
        </div>
      ) : allSubs.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: "0 0 16px 0" }}>No subscriptions tracked yet.</p>
          <Button onClick={openAdd} variant="outline" size="sm">Add one</Button>
        </div>
      ) : filteredSubs.length === 0 && filteredInactive.length === 0 ? (
        <div style={{ padding: "48px 16px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>No {catFilter} subscriptions.</p>
        </div>
      ) : (
        <>
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredSubs.map((sub) => (
              <SubscriptionRow key={sub.id} sub={sub} onClick={() => openEdit(sub)} onRenew={() => handleRenew(sub)} />
            ))}
          </div>

          {/* Inactive subscriptions */}
          {filteredInactive.length > 0 && (
            <div style={{ padding: "16px 16px 0 16px" }}>
              {showInactive ? (
                <>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-4)", fontWeight: 600, marginBottom: 10 }}>
                    Inactive
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.55 }}>
                    {filteredInactive.map((sub) => (
                      <SubscriptionRow key={sub.id} sub={sub} onClick={() => openEdit(sub)} onRenew={() => handleRenew(sub)} />
                    ))}
                  </div>
                  <button
                    onClick={() => setShowInactive(false)}
                    style={{ fontSize: 12, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: "12px 0 0 0" }}
                  >
                    Hide inactive
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowInactive(true)}
                  style={{ fontSize: 12, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Show {filteredInactive.length} inactive {filteredInactive.length === 1 ? "subscription" : "subscriptions"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <SubscriptionDialog open={dialogOpen} onClose={closeDialog} subscription={editing} />
    </div>
  );
}

function SubscriptionRow({ sub, onClick, onRenew }: { sub: Subscription; onClick: () => void; onRenew: () => void }) {
  const days = sub.nextDueDate ? daysUntil(sub.nextDueDate) : null;
  const urgent = days != null && days <= 0;
  const soon = days != null && days > 0 && days <= 7;
  const showRenew = days != null && days <= 7;
  const color = categoryColor(sub.category);
  const mo = moLabel(sub);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: urgent ? "color-mix(in srgb, #ef4444 6%, var(--surface))" : "var(--surface)",
        border: `1px solid ${urgent ? "color-mix(in srgb, #ef4444 20%, transparent)" : soon ? "#f59e0b44" : "var(--hairline)"}`,
        borderRadius: 12,
      }}
    >
      {/* Letter avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color, flexShrink: 0,
      }}>
        {sub.name[0]?.toUpperCase()}
      </div>

      {/* Name + meta — clickable area */}
      <button onClick={onClick} style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub.name}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 6 }}>
          {sub.category && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 100, fontSize: 10, fontWeight: 600, background: `${color}18`, color }}>
              {categoryLabel(sub.category)}
            </span>
          )}
          <span>{sub.billingPeriod}</span>
          {sub.isSplit && <span style={{ color: "#06b6d4", fontSize: 10, fontWeight: 600 }}>÷2</span>}
          {!sub.autoRenew && <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 600 }}>manual</span>}
        </div>
      </button>

      {/* Amount + countdown + renew */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
          {amountLabel(sub)}
        </div>
        {mo && <div style={{ fontSize: 11, color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>{mo}</div>}
        {days != null && (
          <div style={{ fontSize: 11, color: countdownColor(days), fontWeight: days <= 7 ? 600 : 400 }}>
            {countdownLabel(days)}
          </div>
        )}
        {showRenew && (
          <button
            onClick={(e) => { e.stopPropagation(); onRenew(); }}
            style={{
              marginTop: 4,
              fontSize: 10, fontWeight: 600,
              color: "var(--primary)",
              background: "none", border: "none",
              cursor: "pointer", padding: 0,
              textDecoration: "underline",
            }}
          >
            Renew
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
