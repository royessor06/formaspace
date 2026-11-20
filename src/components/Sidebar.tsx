import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Building2,
  Check,
  ChevronDown,
  FolderKanban,
  Layers,
  LogOut,
  Mail,
  Plus,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { getInitials, getRoleLabel } from '../lib/formatters';
import type {
  ActiveSection,
  ActiveWorkspace,
  MembershipDoc,
  OrganizationDoc,
} from '../types/models';

interface SidebarProps {
  user: User;
  activeWorkspace: ActiveWorkspace;
  activeSection: ActiveSection;
  organizations: OrganizationDoc[];
  memberships: MembershipDoc[];
  projectCount: number;
  orgMemberCount: number;
  pendingInvitationCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelectWorkspace: (ws: ActiveWorkspace) => void;
  onSelectSection: (section: ActiveSection) => void;
  onOpenCreateOrg: () => void;
  onSignOut: () => void;
}

export function Sidebar({
  user,
  activeWorkspace,
  activeSection,
  organizations,
  memberships,
  projectCount,
  orgMemberCount,
  pendingInvitationCount,
  mobileOpen,
  onCloseMobile,
  onSelectWorkspace,
  onSelectSection,
  onOpenCreateOrg,
  onSignOut,
}: SidebarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeOrg =
    activeWorkspace.type === 'org'
      ? organizations.find((o) => o.orgId === activeWorkspace.orgId) ?? null
      : null;

  const activeMembership =
    activeWorkspace.type === 'org'
      ? memberships.find((m) => m.orgId === activeWorkspace.orgId) ?? null
      : null;

  const currentWorkspaceLabel =
    activeWorkspace.type === 'personal'
      ? 'Personal workspace'
      : activeOrg?.name || 'Organization';

  const currentWorkspaceMeta =
    activeWorkspace.type === 'personal'
      ? 'Private projects'
      : activeMembership
      ? `${getRoleLabel(activeMembership.role)} role`
      : 'Shared workspace';

  const content = (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 w-[268px]">
      {/* Brand header */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="font-display text-base font-semibold tracking-tight text-slate-900">
            FormaSpace
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Switcher */}
      <div className="p-4 border-b border-slate-100" ref={switcherRef}>
        <p className="text-xs font-medium text-slate-500 mb-2">Workspace</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSwitcherOpen((prev) => !prev)}
            aria-expanded={switcherOpen}
            className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-colors text-left focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                {activeWorkspace.type === 'personal' ? (
                  <UserIcon className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {currentWorkspaceLabel}
                </p>
                <p className="text-xs text-slate-500 truncate">{currentWorkspaceMeta}</p>
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                switcherOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {switcherOpen && (
            <div className="absolute left-0 right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-md py-1.5 max-h-80 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onSelectWorkspace({ type: 'personal' });
                  setSwitcherOpen(false);
                  onCloseMobile();
                }}
                className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-sm transition-colors ${
                  activeWorkspace.type === 'personal'
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserIcon className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="truncate">Personal workspace</span>
                </div>
                {activeWorkspace.type === 'personal' && (
                  <Check className="w-4 h-4 text-slate-900 shrink-0" aria-hidden="true" />
                )}
              </button>

              {memberships.length > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-100">
                  <p className="px-3 py-1 text-xs font-medium text-slate-400">
                    Organizations
                  </p>
                  {memberships.map((membership) => {
                    const org = organizations.find((o) => o.orgId === membership.orgId);
                    const isSelected =
                      activeWorkspace.type === 'org' &&
                      activeWorkspace.orgId === membership.orgId;
                    return (
                      <button
                        key={membership.membershipId}
                        type="button"
                        onClick={() => {
                          onSelectWorkspace({ type: 'org', orgId: membership.orgId });
                          setSwitcherOpen(false);
                          onCloseMobile();
                        }}
                        className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Building2
                            className="w-4 h-4 text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate">{org?.name || membership.orgId}</p>
                            <p className="text-xs text-slate-500">
                              {getRoleLabel(membership.role)}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-slate-900 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-1 pt-1 border-t border-slate-100 px-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSwitcherOpen(false);
                    onOpenCreateOrg();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Create organization</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Workspace navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            onSelectSection('projects');
            onCloseMobile();
          }}
          className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 text-sm transition-colors whitespace-nowrap ${
            activeSection === 'projects'
              ? 'bg-slate-900 text-white font-medium'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <FolderKanban className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Projects</span>
          </span>
          <span
            className={`font-mono text-xs tabular-nums ${
              activeSection === 'projects' ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {projectCount}
          </span>
        </button>

        {activeWorkspace.type === 'org' && (
          <button
            type="button"
            onClick={() => {
              onSelectSection('members');
              onCloseMobile();
            }}
            className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 text-sm transition-colors whitespace-nowrap ${
              activeSection === 'members'
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Members &amp; Invites</span>
            </span>
            <span
              className={`font-mono text-xs tabular-nums ${
                activeSection === 'members' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {orgMemberCount}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onSelectSection('invitations');
            onCloseMobile();
          }}
          className={`w-full px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 text-sm transition-colors whitespace-nowrap ${
            activeSection === 'invitations'
              ? 'bg-slate-900 text-white font-medium'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>My Invitations</span>
          </span>
          {pendingInvitationCount > 0 && (
            <span
              className={`font-mono text-xs tabular-nums ${
                activeSection === 'invitations' ? 'text-blue-200' : 'text-blue-600 font-medium'
              }`}
            >
              {pendingInvitationCount}
            </span>
          )}
        </button>
      </nav>

      {/* Current User Profile */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3 min-w-0">
          {user.photoURL && !avatarFailed ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User avatar'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">
              {getInitials(user.displayName, user.email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user.displayName || 'Workspace User'}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
