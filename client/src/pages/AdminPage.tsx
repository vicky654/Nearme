import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminStats, getAdminUsers, updateAdminUserStatus, deleteAdminUserAccount, getAdminReports } from '../api/adminApi';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../store/toastStore';
import { getUserId } from '../types/user';

type Tab = 'overview' | 'users' | 'reports';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: getAdminStats });
  const usersQuery = useQuery({
    queryKey: ['admin-users', search, statusFilter],
    queryFn: () => getAdminUsers({ q: search, status: statusFilter }),
  });
  const reportsQuery = useQuery({ queryKey: ['admin-reports'], queryFn: getAdminReports });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status, role }: { userId: string; status?: any; role?: any }) =>
      updateAdminUserStatus(userId, { status, role }),
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteAdminUserAccount(userId),
    onSuccess: () => {
      toast.success('User account deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Control Center</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            System metrics, user management, and platform moderation
          </p>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          🛡️ Admin Privileges Active
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          📊 Overview Stats
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          👥 User Management ({statsQuery.data?.stats.totalUsers ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          🚩 Reports ({statsQuery.data?.stats.totalReports ?? 0})
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statsQuery.isPending ? (
            [1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">👥</span>
                <p className="mt-2 text-xs text-gray-500">Total Registered Users</p>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {statsQuery.data?.stats.totalUsers}
                </h3>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">⚡</span>
                <p className="mt-2 text-xs text-gray-500">Active User Accounts</p>
                <h3 className="text-3xl font-bold text-green-600">
                  {statsQuery.data?.stats.activeUsers}
                </h3>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">🚫</span>
                <p className="mt-2 text-xs text-gray-500">Suspended / Banned</p>
                <h3 className="text-3xl font-bold text-red-600">
                  {statsQuery.data?.stats.suspendedUsers}
                </h3>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">🤝</span>
                <p className="mt-2 text-xs text-gray-500">Established Friendships</p>
                <h3 className="text-3xl font-bold text-indigo-600">
                  {statsQuery.data?.stats.totalFriendships}
                </h3>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">💬</span>
                <p className="mt-2 text-xs text-gray-500">Total Messages Delivered</p>
                <h3 className="text-3xl font-bold text-indigo-600">
                  {statsQuery.data?.stats.totalMessages}
                </h3>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <span className="text-2xl">🚩</span>
                <p className="mt-2 text-xs text-gray-500">Pending Safety Reports</p>
                <h3 className="text-3xl font-bold text-amber-600">
                  {statsQuery.data?.stats.totalReports}
                </h3>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              label="Search Users"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Status filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-gray-300 p-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {usersQuery.data?.users.map((user) => {
                  const uid = getUserId(user);
                  return (
                    <tr key={uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-bold text-gray-900 dark:text-gray-100">
                              {user.displayName}
                            </p>
                            <p className="text-[10px] text-gray-500">@{user.username} • {user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'active' ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => statusMutation.mutate({ userId: uid, status: 'suspended' })}
                            >
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => statusMutation.mutate({ userId: uid, status: 'active' })}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-800"
                            onClick={() => {
                              if (confirm(`Delete account ${user.displayName}?`)) {
                                deleteMutation.mutate(uid);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Reports */}
      {activeTab === 'reports' && (
        <div className="flex flex-col gap-3">
          {reportsQuery.data?.reports.length === 0 ? (
            <p className="text-xs text-gray-500">No safety reports pending.</p>
          ) : (
            reportsQuery.data?.reports.map((r) => (
              <div
                key={r._id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-red-600">Report Reason: {r.reason}</span>
                  <span className="text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs text-gray-600 dark:text-gray-300">
                  <div>
                    <span>Reporter: <strong>{r.reporterId?.displayName}</strong> (@{r.reporterId?.username})</span>
                  </div>
                  <div>
                    <span>Reported User: <strong>{r.targetUserId?.displayName}</strong> (@{r.targetUserId?.username})</span>
                  </div>
                </div>
                {r.details && (
                  <p className="rounded-xl bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    "{r.details}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
