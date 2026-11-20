import { useState } from 'react';
import { Building2, Check, Mail } from 'lucide-react';
import { formatTimestamp, getRoleLabel } from '../lib/formatters';
import type { InvitationDoc } from '../types/models';

interface MyInvitationsViewProps {
  userEmail: string;
  invitations: InvitationDoc[];
  onAcceptInvitation: (invitation: InvitationDoc) => Promise<void>;
}

export function MyInvitationsView({
  userEmail,
  invitations,
  onAcceptInvitation,
}: MyInvitationsViewProps) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Pending invitations
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Organization invitations addressed to{' '}
          <span className="font-medium text-slate-800">{userEmail}</span>.
        </p>

        {invitations.length === 0 ? (
          <div className="mt-6 py-10 border-t border-slate-100 text-center">
            <Mail className="w-7 h-7 text-slate-300 mx-auto" aria-hidden="true" />
            <p className="mt-2.5 text-sm font-medium text-slate-800">
              No pending invitations
            </p>
            <p className="mt-1 text-xs text-slate-500">
              When an organization owner or admin invites your email, it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            {invitations.map((inv) => (
              <div
                key={inv.invitationId}
                className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {inv.orgName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Role: <span className="font-medium text-slate-700">{getRoleLabel(inv.role)}</span> ·{' '}
                      <span className="font-mono tabular-nums">
                        Invited {formatTimestamp(inv.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={acceptingId === inv.invitationId}
                  onClick={async () => {
                    setAcceptingId(inv.invitationId);
                    try {
                      await onAcceptInvitation(inv);
                    } finally {
                      setAcceptingId(null);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {acceptingId === inv.invitationId ? 'Joining...' : 'Accept & join'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
