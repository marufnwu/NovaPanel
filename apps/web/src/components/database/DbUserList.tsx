import { KeyRound, ShieldOff, Trash2 } from 'lucide-react';

interface DbUser {
  id: string;
  username: string;
  host: string;
}

interface DbUserListProps {
  databaseId: string;
  users: DbUser[];
  onChangePassword: (user: DbUser) => void;
  onRevokeUser: (user: DbUser) => void;
  onDeleteUser: (user: DbUser) => void;
}

export function DbUserList({ users, onChangePassword, onRevokeUser, onDeleteUser }: DbUserListProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Database Users</h3>
      </div>
      {users.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Host</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono">{u.username}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.host}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onChangePassword(u)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Change password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onRevokeUser(u)}
                        className="rounded p-1 text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500"
                        title="Revoke access from this database"
                      >
                        <ShieldOff className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteUser(u)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">No users yet</div>
      )}
    </div>
  );
}