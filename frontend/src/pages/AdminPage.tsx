import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { useSettingsStore } from "../store/settingsStore";
import { adminDeleteUser, adminListUsers, adminUpsertUser, type AdminUserGrant, ChatApiError } from "../lib/api";
import { PLAN_DEFINITIONS, PLAN_ORDER, type PlanId } from "../types/plans";
import styles from "./AdminPage.module.css";

export function AdminPage() {
  const adminKey = useSettingsStore((s) => s.adminKey);
  const setAdminKey = useSettingsStore((s) => s.setAdminKey);
  const [keyDraft, setKeyDraft] = useState(adminKey);
  const [users, setUsers] = useState<AdminUserGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newPlan, setNewPlan] = useState<PlanId>("hobby");

  const requestIdRef = useRef(0);

  const loadUsers = async (key: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await adminListUsers(key);
      if (requestId === requestIdRef.current) setUsers(data);
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setUsers(null);
        setError(err instanceof ChatApiError ? err.message : "Failed to load users.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) void loadUsers(adminKey);
  }, [adminKey]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminKey(keyDraft.trim());
  };

  const handleAddGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      await adminUpsertUser(adminKey, { email: newEmail.trim(), plan: newPlan, note: newNote.trim() });
      setNewEmail("");
      setNewNote("");
      await loadUsers(adminKey);
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Failed to save grant.");
    }
  };

  const handleRemove = async (email: string) => {
    try {
      await adminDeleteUser(adminKey, email);
      await loadUsers(adminKey);
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Failed to remove grant.");
    }
  };

  const handlePlanChange = async (email: string, plan: PlanId, note: string) => {
    try {
      await adminUpsertUser(adminKey, { email, plan, note });
      await loadUsers(adminKey);
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : "Failed to update plan.");
    }
  };

  return (
    <div className={styles.page}>
      <TopBar title="Admin" />
      <div className={styles.content}>
        <div className={styles.inner}>
          <div className={styles.warning}>
            <ShieldAlert size={15} />
            This is a lightweight local gate, not real authentication. Anyone with the admin key can grant plans.
            Keep the key private and only use this on a trusted machine.
          </div>

          {!users && (
            <form className={styles.unlockForm} onSubmit={handleUnlock}>
              <label htmlFor="admin-key">Admin key</label>
              <input
                id="admin-key"
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste the ADMIN_KEY printed by the backend on startup"
              />
              <button type="submit">Unlock</button>
            </form>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {loading && <p className={styles.hint}>Loading...</p>}

          {users && (
            <>
              <h2 className={styles.sectionTitle}>Grant a plan for free</h2>
              <form className={styles.addForm} onSubmit={handleAddGrant}>
                <input
                  type="email"
                  placeholder="family.member@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
                <select value={newPlan} onChange={(e) => setNewPlan(e.target.value as PlanId)}>
                  {PLAN_ORDER.filter((p) => p !== "free").map((p) => (
                    <option key={p} value={p}>
                      {PLAN_DEFINITIONS[p].name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Note (e.g. family)"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button type="submit">Grant plan</button>
              </form>

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Note</th>
                    <th>Granted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.empty}>
                        No grants yet.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.email}>
                      <td>{u.email}</td>
                      <td>
                        <select
                          value={u.plan}
                          onChange={(e) => handlePlanChange(u.email, e.target.value as PlanId, u.note)}
                        >
                          {PLAN_ORDER.map((p) => (
                            <option key={p} value={p}>
                              {PLAN_DEFINITIONS[p].name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{u.note || "—"}</td>
                      <td>{new Date(u.addedAt).toLocaleDateString()}</td>
                      <td>
                        <button className={styles.removeButton} onClick={() => handleRemove(u.email)} aria-label={`Remove ${u.email}`}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
