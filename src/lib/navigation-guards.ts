// The registry stores admission flags only. No field values or credentials.
export type NavigationGuard = { dirty: boolean; saving: boolean; warning: string };
export class NavigationGuards {
  private readonly guards = new Map<symbol, NavigationGuard>();
  set(id: symbol, guard: NavigationGuard) { this.guards.set(id, guard); }
  delete(id: symbol) { this.guards.delete(id); }
  get active() { return [...this.guards.values()].some(guard => guard.dirty || guard.saving); }
  admit(confirm: (warning: string) => boolean) {
    // One unfinished request blocks leaving even if another editor is clean.
    if ([...this.guards.values()].some(guard => guard.saving)) return false;
    const dirty = [...this.guards.values()].filter(guard => guard.dirty);
    if (!dirty.length) return true;
    const warnings = [...new Set(dirty.map(guard => guard.warning))];
    // Multiple forms produce one decision; a user never has to confirm each row.
    return confirm(warnings.join('\n'));
  }
}
