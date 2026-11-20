import { useState, type FormEvent } from 'react';
import {
  Check,
  Mail,
  Pencil,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { formatTimestamp, getRoleLabel } from '../lib/formatters';
import {
  BLUEPRINT_CONSTRAINTS,
  type InvitationDoc,
  type InvitationRole,
  type MembershipDoc,
  type MembershipRole,
  type OrganizationDoc,
} from '../types/models';

interface MembersViewProps {
  organization: OrganizationDoc;
  currentUserId: string;
  currentUserRole: MembershipRole;
  members: MembershipDoc[];
  invitations: InvitationDoc[];
  loadingMembers: boolean;
  onRenameOrg: (orgId: string, name: string) => Promise<void>;
  onInviteMember: (email: string, role: InvitationRole) => Promise<void>;
  onRevokeInvitation: (invitationId: string) => Promise<void>;
  onReopenInvitation: (email: string, role: InvitationRole) => Promise<void>;
  onUpdateMemberRole: (membershipId: string, role: InvitationRole) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
}

const INVITABLE_ROLES: InvitationRole[] = ['collaborator', 'manager', 'admin'];

export function MembersView({
  organization,
  currentUserId,
  currentUserRole,
  members,
  invitations,
  loadingMembers,
  onRenameOrg,
  onInviteMember,
  onRevokeInvitation,
  onReopenInvitation,
  onUpdateMemberRole,
  onRemoveMember,
}: MembersViewProps) {
  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin';

  const [editingOrgName, setEditingOrgName] = useState(false);
  const [draftOrgName, setDraftOrgName] = useState(organization.name);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('collaborator');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleSaveOrgName = async () => {
    const trimmed = draftOrgName.trim();
    if (!trimmed || trimmed === organization.name) {
      setDraftOrgName(organization.name);
      setEditingOrgName(false);
      return;
    }
    setBusyId('rename-org');
    try {
      await onRenameOrg(organization.orgId, trimmed);
      setEditingOrgName(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await onInviteMember(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('collaborator');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (membershipId: string, nextRole: InvitationRole) => {
    setBusyId(membershipId);
    try {
      await onUpdateMemberRole(membershipId, nextRole);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (membershipId: string) => {
    setBusyId(membershipId);
    try {
      await onRemoveMember(membershipId);
      setConfirmRemoveId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Organization header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Organization Workspace</p>
          {editingOrgName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveOrgName();
              }}
              className="mt-1 flex items-center gap-2"
            >
              <input
                type="text"
                value={draftOrgName}
                onChange={(e) => setDraftOrgName(e.target.value)}
                maxLength={BLUEPRINT_CONSTRAINTS.organization.nameMax}
                autoFocus
                disabled={busyId === 'rename-org'}
                className="px-3 py-1.5 text-base font-semibold text-slate-900 bg-slate-50 border border-blue-500 rounded-lg focus:outline-none"
              />
              <button
                type="submit"
                disabled={busyId === 'rename-org' || !draftOrgName.trim()}
                aria-label="Save organization name"
                className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftOrgName(organization.name);
                  setEditingOrgName(false);
                }}
                aria-label="Cancel rename"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-2.5">
              <h2 className="font-display text-xl font-semibold text-slate-900 truncate">
                {organization.name}
              </h2>
              {canManageTeam && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftOrgName(organization.name);
                    setEditingOrgName(true);
                  }}
                  aria-label="Rename organization"
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Your role: <span className="font-medium text-slate-800">{getRoleLabel(currentUserRole)}</span> ·{' '}
            <span className="font-mono tabular-nums">{members.length}</span>{' '}
            {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <div className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
          Org ID: {organization.orgId}
        </div>
      </section>

      {/* Invite by email */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Invite a member by email
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Creates a pending invitation record in Firestore for the invited email address (no email is sent).
            </p>
          </div>
        </div>

        {canManageTeam ? (
          <form
            onSubmit={(e) => void handleInviteSubmit(e)}
            className="mt-4 flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              maxLength={BLUEPRINT_CONSTRAINTS.invitation.emailMax}
              disabled={inviting}
              aria-label="Invitee email address"
              className="flex-1 min-w-0 px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InvitationRole)}
              disabled={inviting}
              aria-label="Member role"
              className="px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {getRoleLabel(r)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>{inviting ? 'Saving...' : 'Create invitation'}</span>
            </button>
          </form>
        ) : (
          <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
            <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span>
              Only organization owners and admins can invite or remove members.
            </span>
          </div>
        )}
      </section>

      {/* Members list */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Members
          </h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {members.length} total
          </span>
        </div>

        {loadingMembers ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-10 bg-slate-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No members found in this organization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-6">Member</th>
                  <th className="py-2.5 px-4">User ID</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {members.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  const isOwner = member.role === 'owner';
                  const canEditMember = canManageTeam && !isOwner;
                  const canRemoveMember = (canManageTeam && !isOwner) || (isSelf && !isOwner);
                  const isConfirming = confirmRemoveId === member.membershipId;

                  return (
                    <tr
                      key={member.membershipId}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-6">
                        <p className="font-medium text-slate-900">
                          {member.displayName || 'Organization Member'}
                          {isSelf && (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              (You)
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {member.userId.slice(0, 12)}...
                      </td>
                      <td className="py-3 px-4">
                        {canEditMember ? (
                          <select
                            value={member.role}
                            disabled={busyId === member.membershipId}
                            onChange={(e) =>
                              void handleRoleChange(
                                member.membershipId,
                                e.target.value as InvitationRole
                              )
                            }
                            aria-label={`Role for ${member.displayName || member.userId}`}
                            className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                          >
                            {INVITABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {getRoleLabel(r)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-medium text-slate-700">
                            {getRoleLabel(member.role)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right">
                        {canRemoveMember ? (
                          isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === member.membershipId}
                                onClick={() => setConfirmRemoveId(null)}
                                className="px-2.5 py-1 text-xs text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={busyId === member.membershipId}
                                onClick={() => void handleRemove(member.membershipId)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 whitespace-nowrap"
                              >
                                {isSelf ? 'Leave' : 'Remove'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === member.membershipId}
                              onClick={() => setConfirmRemoveId(member.membershipId)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{isSelf ? 'Leave' : 'Remove'}</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Invitations table (visible only to owner/admin) */}
      {canManageTeam && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Stored invitations
            </h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {invitations.length} total
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-6 h-6 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                No invitations yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Invite a teammate by email above to store an invitation document.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-6">Email</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Created</th>
                    <th className="py-2.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {invitations.map((inv) => (
                    <tr key={inv.invitationId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-6 font-medium text-slate-900">
                        {inv.email}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {getRoleLabel(inv.role)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-medium ${
                            inv.status === 'pending'
                              ? 'text-amber-700'
                              : inv.status === 'accepted'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {inv.status === 'pending'
                            ? 'Pending'
                            : inv.status === 'accepted'
                            ? 'Accepted'
                            : 'Revoked'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        {formatTimestamp(inv.createdAt)}
                      </td>
                      <td className="py-3 px-6 text-right">
                        {inv.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === inv.invitationId}
                            onClick={async () => {
                              setBusyId(inv.invitationId);
                              try {
                                await onRevokeInvitation(inv.invitationId);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 px-2.5 py-1 rounded-md hover:bg-red-50 whitespace-nowrap"
                          >
                            Revoke
                          </button>
                        )}
                        {inv.status === 'revoked' && (
                          <button
                            type="button"
                            disabled={busyId === inv.invitationId}
                            onClick={async () => {
                              setBusyId(inv.invitationId);
                              try {
                                await onReopenInvitation(inv.email, inv.role);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded-md hover:bg-slate-100 whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3" aria-hidden="true" />
                            <span>Re-open</span>
                          </button>
                        )}
                        {inv.status === 'accepted' && (
                          <span className="text-xs text-slate-400">Joined</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
