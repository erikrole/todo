# Todo v1.2 — "Reliable Daily Driver"

> **STATUS: WAITING FOR CONFIRMATION** — see confirmation questions at the bottom.

## Theme

Three things block using this app from a phone every day: no feedback on mutations, no undo, no deployment. v1.2 ships exactly those — toast notifications, undo-on-complete/delete/move, and Vercel + Turso production deployment — plus dead code cleanup.

---

## What's already built (orientation findings)

Far more than the original PLAN.md suggested:

- **Command palette** — built (`components/command-palette.tsx`). Navigation-only, no create actions.
- **Task detail / notes / deadline / recurrence / subtasks** — built as inline `ExpandedPanel` inside `task-item.tsx`. The `Sheet`-based `task-detail.tsx` is dead code (unreferenced, superseded).
- **Completion animations** — built. Framer Motion in `task-item.tsx`, 320ms delay, `AnimatePresence` layout.
- **LogbookPage** — built. Groups by `completedAt` date, newest first.
- **Dark mode toggle** — built. `next-themes` + `components/theme-toggle.tsx`.
- **Today time-of-day sections** — built. Morning / Day / Night / Anytime drop zones with progress bar.
- **PWA manifest** — half-built. `public/manifest.json` + layout link exist, but no service worker.
- **Extras beyond plan**: Someday view, Trash view (soft-delete + restore + permanent delete), sub-projects, scheduled-time on tasks.

## What is genuinely missing

1. **No toast feedback on any mutation** — `sonner` not installed, no `<Toaster>`. Silent success and silent errors.
2. **No undo** — complete/delete/move fire immediately with no reversal. `useRestoreTask` exists (used by Trash) but isn't wired to any undo flow.
3. **No deployment** — no Vercel link, no Turso production DB, not reachable from a phone.
4. **Dead code** — `task-detail.tsx` (262 lines, zero external imports; confirmed by grep).

---

## Requirements

- Every mutation shows a success or error toast.
- Completing a task shows a toast with "Undo" that reverses the completion (and removes the spawned recurrence child if any).
- Deleting a task shows a toast with "Undo" that restores it.
- Context-menu "Move to ___" shows a toast with "Undo" that reverts location.
- App is deployed to Vercel, reachable from a phone, writing to Turso, authed with `NEXT_PUBLIC_AUTH_TOKEN`.
- `task-detail.tsx` is deleted; build and E2E still pass.

## Architecture Changes

| Component | Change |
|-----------|--------|
| `packages/web/package.json` | add `sonner` |
| `packages/web/src/app/providers.tsx` | mount `<Toaster theme="system" richColors position="bottom-right" duration={5000}/>` |
| `packages/web/src/lib/toast.ts` | **new** — `notify.success`, `notify.error`, `notify.undoable` wrappers |
| `packages/web/src/app/api/tasks/[id]/uncomplete/route.ts` | **new** — mirrors `complete/` but reverses; cleans up recurrence child heuristically |
| `packages/web/src/hooks/use-tasks.ts` | add `useUncompleteTask`; wire toasts into all existing mutation hooks |
| `packages/web/src/hooks/use-projects.ts` | wire toasts |
| `packages/web/src/hooks/use-areas.ts` | wire toasts |
| `packages/web/src/hooks/use-sections.ts` | wire toasts |
| `packages/web/src/components/tasks/task-item.tsx` | wire undoable toasts to complete, delete, move |
| `packages/web/src/components/tasks/task-detail.tsx` | **delete** (dead code) |
| `CLAUDE.md` | append Deployment section |

No DB migrations required.

---

## Implementation Steps

### Phase 1: Toast foundation

1. **Install sonner** — `pnpm --filter @todo/web add sonner`

2. **Mount `<Toaster>` in `providers.tsx`** — inside `<TooltipProvider>`, alongside `<CommandPalette />`. Props: `theme="system"`, `richColors`, `position="bottom-right"`, `duration={5000}`.

3. **Create `packages/web/src/lib/toast.ts`** — exports `notify.success(msg)`, `notify.error(msg, err?)`, `notify.undoable(msg, onUndo)`. Small surface so call sites read cleanly.

### Phase 2: Wire toasts into mutations

4. **Task mutation hooks** — `onSuccess`/`onError` in `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useCompleteTask`, `useRestoreTask`, `useDeleteTaskPermanent`. Short copy: "Task created", "Task updated", "Moved to trash", "Task restored", "Deleted forever". Errors surface the API message.

5. **Project / area / section hooks** — same pattern. "Project created", "Project completed", "Section renamed", "Section deleted", etc.

### Phase 3: Undo

6. **`POST /api/tasks/[id]/uncomplete`** — flip `isCompleted = false`, `completedAt = null`. Edge case: if the task was recurring, find and delete the child created at completion time (match by: same projectId/recurrenceType, `createdAt` within 2s of `original.completedAt`, not the original id). Skip cleanup if multiple candidates match (log warning). Wrap in db transaction if available.

7. **`useUncompleteTask` hook** — `useMutation` → `POST /api/tasks/[id]/uncomplete`, invalidate `["tasks"]`. No success toast (called from within undo — double-toast is noisy).

8. **Make complete undoable in `task-item.tsx`** — after `completeTask.mutate()` resolves, call `notify.undoable("Task completed", () => uncompleteTask.mutate(id))`. Replace the Phase 2 complete toast with this.

9. **Make delete undoable** — after `deleteTask.mutate()` resolves, call `notify.undoable("Task deleted", () => restoreTask.mutate(id))`. Replace Phase 2 delete toast.

10. **Make "Move to ___" undoable** — capture `{ whenDate, timeOfDay, isSomeday, projectId, areaId, sectionId }` snapshot before mutating. After mutate: `notify.undoable("Moved to Today", () => updateTask.mutate({ id, ...snapshot }))`.

### Phase 4: Dead code cleanup

11. **Delete `task-detail.tsx`** — verify zero imports with grep, then delete. Run `pnpm build` and `pnpm e2e` to confirm clean.

### Phase 5: Deploy to Vercel

12. **Link repo to Vercel project** — `vercel link --repo` from repo root. Set **Root Directory** to `packages/web` in Vercel dashboard.

13. **Provision Turso production DB** — `turso db create todo-prod`, grab URL + token, run `pnpm db:migrate` against it.

14. **Push env vars** — `vercel env add` for `TURSO_URL`, `TURSO_AUTH_TOKEN`, `AUTH_TOKEN`, `NEXT_PUBLIC_AUTH_TOKEN` (all production). Generate fresh token via `openssl rand -hex 32`.

    > **Pre-deploy check**: Grep `next.config.ts` for `transpilePackages` — must include `@todo/shared` and `@todo/db` for monorepo builds on Vercel. Add if missing.

    > **Middleware check**: Confirm `packages/web/src/middleware.ts` matcher excludes `/_next/*` and static assets before deploy.

15. **First deploy** — `vercel --prod` from repo root. Test from phone. Verify Turso write via `turso db shell`.

16. **Update `CLAUDE.md`** — append Deployment section with project name, `vercel --prod`, `vercel env pull` commands.

---

## Testing Strategy

- **Phase 1**: Load app, no visual regression, Toaster renders.
- **Phase 2**: Each mutation type triggers a toast. Error path: break API URL in devtools, confirm error toast.
- **Phase 3**: Complete a task → undo → task reappears, recurrence child gone. Delete → undo → restored. Move → undo → original location.
- **Phase 5**: Create task from phone, hard-refresh, persists.
- **E2E (Playwright)**: Add one test to `inbox.spec.ts`: "undo restores a completed task" — create task, complete it, click Undo in sonner toast (`[data-sonner-toast] button`), assert task visible. 

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Uncomplete heuristic deletes wrong child | Medium | Narrow match (same project/recurrenceType + created within 2s); skip and log if ambiguous |
| Sonner toast action click blurs expanded panel → triggers auto-save | Low | Desired behaviour; verify manually |
| Monorepo build on Vercel fails without `transpilePackages` | Medium | Check `next.config.ts` before deploying (step 14) |
| `AUTH_TOKEN` middleware blocks Vercel health checks | Medium | Verify matcher excludes `/_next/*` and static assets |
| Phase 5 rabbit-holes and burns the session | High | Phases 1-4 are self-contained and shippable without Phase 5 |

---

## Success Criteria

- [ ] Every task / project / section / area mutation shows a toast
- [ ] Complete task → "Undo" reverses it and removes recurrence child
- [ ] Delete task → "Undo" restores it
- [ ] "Move to ___" → "Undo" reverts location
- [ ] `task-detail.tsx` deleted; `pnpm build` + `pnpm e2e` pass
- [ ] App reachable at `*.vercel.app`, writing to Turso, authed
- [ ] Creating a task from phone persists after hard-refresh
- [ ] New Playwright test "undo restores a completed task" passes
- [ ] `CLAUDE.md` has Deployment section

---

## Out of scope for v1.2

- Bulk select / multi-select
- j/k keyboard nav
- Full-text search in command palette
- Command palette create-action items
- Service worker / true offline PWA
- Areas CRUD UI

---

## WAITING FOR CONFIRMATION

Five questions before proceeding:

1. **Theme correct?** Toast + undo + deploy — not a scattered list of smaller improvements.
2. **New Turso DB for production?** (Not a copy of `local.db`)
3. **Include Phase 5 (deploy) in this session?** If not, v1.2 = Phases 1-4 only; deploy becomes v1.3.
4. **OK to delete `task-detail.tsx`?** Confirmed dead code (zero external imports) but it's 262 lines.
5. **Undo-recurrence heuristic acceptable?** Small risk of leaving a stale child vs. building a formal undo-log table.
