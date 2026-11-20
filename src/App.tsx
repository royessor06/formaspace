import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  FolderKanban,
  Menu,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { auth, db } from './firebase';
import { handleFirestoreError, getFriendlyErrorMessage, OperationType } from './lib/firestoreErrors';
import {
  acceptInvitation,
  createOrganization,
  createProject,
  deleteProject,
  inviteMemberByEmail,
  removeMember,
  renameOrganization,
  renameProject,
  revokeInvitation,
  setProjectStatus,
  signOutUser,
  syncUserProfile,
  updateMemberRole,
} from './services/workspaceService';
import type { SportPresetId } from './lib/sports/types';
import type {
  ActiveSection,
  ActiveWorkspace,
  InvitationDoc,
  InvitationRole,
  MembershipDoc,
  OrganizationDoc,
  ProjectDoc,
  ProjectModule,
  ProjectStatus,
} from './types/models';
import { AuthScreen } from './components/AuthScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MembersView } from './components/MembersView';
import { MyInvitationsView } from './components/MyInvitationsView';
import { OrganizationModal } from './components/OrganizationModal';
import { ProjectCard } from './components/ProjectCard';
import { CreateProjectModal, ProjectDetailModal } from './components/ProjectModal';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/ToastProvider';
import { SportsEditor } from './features/sports/SportsEditor';

type ModuleFilter = 'all' | ProjectModule;
type StatusFilter = 'all' | ProjectStatus;

function WorkspaceApp() {
  const { showToast } = useToast();

  // Auth state
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Workspace state
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace>({ type: 'personal' });
  const [activeSection, setActiveSection] = useState<ActiveSection>('projects');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore synced collections
  const [myMemberships, setMyMemberships] = useState<MembershipDoc[]>([]);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, OrganizationDoc>>({});
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [orgMembers, setOrgMembers] = useState<MembershipDoc[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [orgInvitations, setOrgInvitations] = useState<InvitationDoc[]>([]);
  const [myInvitations, setMyInvitations] = useState<InvitationDoc[]>([]);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modals & Editor
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectDoc | null>(null);
  const [editingSportsProjectId, setEditingSportsProjectId] = useState<string | null>(null);
  const [editingFallbackProject, setEditingFallbackProject] = useState<ProjectDoc | null>(null);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  const unsavedEditorRef = useRef<{
    hasUnsavedChanges: boolean;
    flushSave: () => Promise<void>;
  }>({
    hasUnsavedChanges: false,
    flushSave: async () => {},
  });

  const handleEditorUnsavedChange = useCallback(
    (state: { hasUnsavedChanges: boolean; flushSave: () => Promise<void> }) => {
      unsavedEditorRef.current = state;
    },
    []
  );

  // 1. Auth listener + profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        void syncUserProfile(firebaseUser).catch((error) => {
          showToast({
            variant: 'error',
            title: 'Profile sync failed',
            message: getFriendlyErrorMessage(error),
          });
        });
      } else {
        setMyMemberships([]);
        setOrganizationsMap({});
        setProjects([]);
        setOrgMembers([]);
        setOrgInvitations([]);
        setMyInvitations([]);
        setActiveWorkspace({ type: 'personal' });
        setActiveSection('projects');
        setEditingSportsProjectId(null);
        setEditingFallbackProject(null);
      }
    });
    return () => unsubscribe();
  }, [showToast]);

  // 2. Listen to current user's memberships
  useEffect(() => {
    if (!authReady || !user) return;
    const q = query(collection(db, 'memberships'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as MembershipDoc);
        setMyMemberships(docs);
      },
      (error) => {
        showToast({
          variant: 'error',
          title: 'Failed to load organizations',
          message: getFriendlyErrorMessage(error),
        });
        handleFirestoreError(error, OperationType.LIST, 'memberships');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, showToast]);

  // 3. Subscribe to organization documents for each membership
  useEffect(() => {
    if (!authReady || !user) return;
    const orgIds = Array.from(new Set(myMemberships.map((m) => m.orgId)));

    if (orgIds.length === 0) {
      setOrganizationsMap({});
      return;
    }

    const activeIdsSet = new Set(orgIds);
    setOrganizationsMap((prev) => {
      const next: Record<string, OrganizationDoc> = {};
      for (const id of Object.keys(prev)) {
        if (activeIdsSet.has(id)) {
          next[id] = prev[id];
        }
      }
      return next;
    });

    const unsubscribers = orgIds.map((orgId) =>
      onSnapshot(
        doc(db, 'organizations', orgId),
        (snap) => {
          if (snap.exists()) {
            const orgData = snap.data() as OrganizationDoc;
            setOrganizationsMap((prev) => ({ ...prev, [orgId]: orgData }));
          } else {
            setOrganizationsMap((prev) => {
              const copy = { ...prev };
              delete copy[orgId];
              return copy;
            });
          }
        },
        (error) => {
          showToast({
            variant: 'error',
            title: 'Failed to load organization details',
            message: getFriendlyErrorMessage(error),
          });
          handleFirestoreError(error, OperationType.GET, `organizations/${orgId}`);
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, user, myMemberships, showToast]);

  const latestMembershipsRef = useRef<MembershipDoc[]>([]);
  latestMembershipsRef.current = myMemberships;

  // Fallback to personal workspace if active org membership is removed
  useEffect(() => {
    if (activeWorkspace.type === 'org' && authReady && user) {
      const stillMember = myMemberships.some((m) => m.orgId === activeWorkspace.orgId);
      if (!stillMember) {
        const orgId = activeWorkspace.orgId;
        const timer = window.setTimeout(() => {
          const exists = latestMembershipsRef.current.some((m) => m.orgId === orgId);
          if (!exists) {
            setActiveWorkspace({ type: 'personal' });
            setActiveSection((sec) => (sec === 'members' ? 'projects' : sec));
          }
        }, 600);
        return () => window.clearTimeout(timer);
      }
    }
  }, [activeWorkspace, myMemberships, authReady, user]);

  // 4. Listen to pending email invitations for the signed-in user
  useEffect(() => {
    if (!authReady || !user?.email) return;
    const normalizedEmail = user.email.trim().toLowerCase();
    const q = query(
      collection(db, 'invitations'),
      where('email', '==', normalizedEmail)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const pending = snapshot.docs
          .map((d) => d.data() as InvitationDoc)
          .filter((inv) => inv.status === 'pending');
        setMyInvitations(pending);
      },
      (error) => {
        showToast({
          variant: 'error',
          title: 'Failed to load invitations',
          message: getFriendlyErrorMessage(error),
        });
        handleFirestoreError(error, OperationType.LIST, 'invitations');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, showToast]);

  // 5. Listen to projects scoped to the active workspace
  useEffect(() => {
    if (!authReady || !user) return;
    setLoadingProjects(true);

    const ownerType = activeWorkspace.type === 'personal' ? 'user' : 'org';
    const ownerId = activeWorkspace.type === 'personal' ? user.uid : activeWorkspace.orgId;

    const q = query(
      collection(db, 'projects'),
      where('ownerType', '==', ownerType),
      where('ownerId', '==', ownerId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as ProjectDoc);
        docs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setProjects(docs);
        setLoadingProjects(false);
      },
      (error) => {
        setLoadingProjects(false);
        showToast({
          variant: 'error',
          title: 'Failed to load projects',
          message: getFriendlyErrorMessage(error),
        });
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, activeWorkspace, showToast]);

  // Current org and role helpers
  const organizations = useMemo(() => {
    return Object.values(organizationsMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [organizationsMap]);

  const activeOrg =
    activeWorkspace.type === 'org'
      ? organizationsMap[activeWorkspace.orgId] ?? null
      : null;

  const activeMembership =
    activeWorkspace.type === 'org'
      ? myMemberships.find((m) => m.orgId === activeWorkspace.orgId) ?? null
      : null;

  // 6. Listen to active organization members
  useEffect(() => {
    if (!authReady || !user || activeWorkspace.type !== 'org') {
      setOrgMembers([]);
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    const q = query(
      collection(db, 'memberships'),
      where('orgId', '==', activeWorkspace.orgId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as MembershipDoc);
        const roleOrder: Record<string, number> = {
          owner: 0,
          admin: 1,
          manager: 2,
          collaborator: 3,
        };
        docs.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
        setOrgMembers(docs);
        setLoadingMembers(false);
      },
      (error) => {
        setLoadingMembers(false);
        showToast({
          variant: 'error',
          title: 'Failed to load organization members',
          message: getFriendlyErrorMessage(error),
        });
        handleFirestoreError(error, OperationType.LIST, 'memberships');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, activeWorkspace, showToast]);

  // 7. Listen to active organization invitations (ONLY for owner or admin)
  useEffect(() => {
    if (
      !authReady ||
      !user ||
      activeWorkspace.type !== 'org' ||
      !activeMembership ||
      (activeMembership.role !== 'owner' && activeMembership.role !== 'admin')
    ) {
      setOrgInvitations([]);
      return;
    }

    const q = query(
      collection(db, 'invitations'),
      where('orgId', '==', activeWorkspace.orgId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as InvitationDoc);
        docs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setOrgInvitations(docs);
      },
      (error) => {
        showToast({
          variant: 'error',
          title: 'Failed to load organization invitations',
          message: getFriendlyErrorMessage(error),
        });
        handleFirestoreError(error, OperationType.LIST, 'invitations');
      }
    );
    return () => unsubscribe();
  }, [authReady, user, activeWorkspace, activeMembership, showToast]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (moduleFilter !== 'all' && p.module !== moduleFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, searchQuery, moduleFilter, statusFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || moduleFilter !== 'all' || statusFilter !== 'all';

  const activeWorkspaceName =
    activeWorkspace.type === 'personal'
      ? 'Personal workspace'
      : activeOrg?.name || 'Organization';

  const canDeleteProject = (project: ProjectDoc): boolean => {
    if (!user) return false;
    if (project.ownerType === 'user') {
      return project.ownerId === user.uid;
    }
    if (!activeMembership) return false;
    return (
      activeMembership.role === 'owner' ||
      activeMembership.role === 'admin' ||
      activeMembership.role === 'manager' ||
      project.createdBy === user.uid
    );
  };

  const editingSportsProject = useMemo(() => {
    if (!editingSportsProjectId) return null;
    const live = projects.find(
      (p) => p.projectId === editingSportsProjectId && p.module === 'sports'
    );
    if (live) return live;
    if (editingFallbackProject?.projectId === editingSportsProjectId) {
      return editingFallbackProject;
    }
    return null;
  }, [editingSportsProjectId, projects, editingFallbackProject]);

  const guardNavigation = useCallback(
    (action: () => void) => {
      if (editingSportsProjectId && unsavedEditorRef.current.hasUnsavedChanges) {
        setPendingNavAction(() => action);
        return;
      }
      action();
    },
    [editingSportsProjectId]
  );

  // Action handlers
  const handleSelectWorkspace = (ws: ActiveWorkspace) => {
    guardNavigation(() => {
      setEditingSportsProjectId(null);
      setEditingFallbackProject(null);
      setActiveWorkspace(ws);
      if (ws.type === 'personal' && activeSection === 'members') {
        setActiveSection('projects');
      }
      setSearchQuery('');
      setModuleFilter('all');
      setStatusFilter('all');
    });
  };

  const handleSelectSection = (section: ActiveSection) => {
    guardNavigation(() => {
      if (section !== 'projects' || editingSportsProjectId) {
        setEditingSportsProjectId(null);
        setEditingFallbackProject(null);
      }
      setActiveSection(section);
    });
  };

  const handleSignOut = async () => {
    guardNavigation(() => {
      void (async () => {
        try {
          await signOutUser();
        } catch (error) {
          showToast({
            variant: 'error',
            title: 'Sign-out failed',
            message: getFriendlyErrorMessage(error),
          });
        }
      })();
    });
  };

  const handleCreateOrganization = async (name: string) => {
    if (!user) return;
    try {
      const orgId = await createOrganization(name, user);
      setActiveWorkspace({ type: 'org', orgId });
      setActiveSection('projects');
      showToast({
        variant: 'success',
        title: 'Organization created',
        message: `${name} is ready.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not create organization',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleRenameOrganization = async (orgId: string, name: string) => {
    try {
      await renameOrganization(orgId, name);
      showToast({
        variant: 'success',
        title: 'Organization renamed',
        message: `Updated to ${name}.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not rename organization',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleCreateProject = async (
    name: string,
    module: ProjectModule,
    sport?: SportPresetId
  ) => {
    if (!user) return;
    const ownerType = activeWorkspace.type === 'personal' ? 'user' : 'org';
    const ownerId =
      activeWorkspace.type === 'personal' ? user.uid : activeWorkspace.orgId;
    try {
      const projectId = await createProject({
        ownerType,
        ownerId,
        name,
        module,
        createdBy: user.uid,
        sport,
      });
      showToast({
        variant: 'success',
        title: 'Project created',
        message: `${name} added to ${activeWorkspaceName}.`,
      });
      if (module === 'sports') {
        setEditingFallbackProject({
          projectId,
          ownerType,
          ownerId,
          name,
          module: 'sports',
          status: 'active',
          createdBy: user.uid,
          createdAt: undefined as unknown as ProjectDoc['createdAt'],
          sport: sport ?? 'custom',
        });
        setEditingSportsProjectId(projectId);
        setActiveSection('projects');
      }
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not create project',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    try {
      await renameProject(projectId, newName);
      showToast({
        variant: 'success',
        title: 'Project renamed',
        message: `Renamed to ${newName}.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not rename project',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleToggleArchiveProject = async (project: ProjectDoc) => {
    const nextStatus: ProjectStatus =
      project.status === 'active' ? 'archived' : 'active';
    try {
      await setProjectStatus(project.projectId, nextStatus);
      showToast({
        variant: 'success',
        title: nextStatus === 'archived' ? 'Project archived' : 'Project restored',
        message: `${project.name} is now ${nextStatus}.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Status update failed',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      showToast({
        variant: 'success',
        title: 'Project deleted',
        message: 'The project container was permanently removed.',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not delete project',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleInviteMember = async (email: string, role: InvitationRole) => {
    if (!user || !activeOrg) return;
    try {
      await inviteMemberByEmail(activeOrg, email, role, user.uid);
      showToast({
        variant: 'success',
        title: 'Invitation stored',
        message: `Invitation created for ${email.trim().toLowerCase()}.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not create invitation',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeInvitation(invitationId);
      showToast({
        variant: 'info',
        title: 'Invitation revoked',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not revoke invitation',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleAcceptInvitation = async (invitation: InvitationDoc) => {
    if (!user) return;
    try {
      await acceptInvitation(invitation, user);
      setActiveWorkspace({ type: 'org', orgId: invitation.orgId });
      setActiveSection('projects');
      showToast({
        variant: 'success',
        title: 'Joined organization',
        message: `You are now a member of ${invitation.orgName}.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not accept invitation',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleUpdateMemberRole = async (
    membershipId: string,
    role: InvitationRole
  ) => {
    try {
      await updateMemberRole(membershipId, role);
      showToast({
        variant: 'success',
        title: 'Member role updated',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not update member role',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    try {
      await removeMember(membershipId);
      showToast({
        variant: 'info',
        title: 'Member removed',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Could not remove member',
        message: getFriendlyErrorMessage(error),
      });
      throw error;
    }
  };

  // Auth loading state
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
          <p className="text-sm text-slate-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated view
  if (!user) {
    return <AuthScreen />;
  }

  const sectionLabel =
    activeSection === 'projects'
      ? 'Projects'
      : activeSection === 'members'
      ? 'Members & Invites'
      : 'My Invitations';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        user={user}
        activeWorkspace={activeWorkspace}
        activeSection={activeSection}
        organizations={organizations}
        memberships={myMemberships}
        projectCount={projects.length}
        orgMemberCount={orgMembers.length}
        pendingInvitationCount={myInvitations.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSelectWorkspace={handleSelectWorkspace}
        onSelectSection={handleSelectSection}
        onOpenCreateOrg={() => setCreateOrgOpen(true)}
        onSignOut={() => void handleSignOut()}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 px-4 sm:px-8 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 truncate">
                {activeSection === 'invitations' ? 'Account' : activeWorkspaceName}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              {activeSection === 'projects' && editingSportsProject ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      guardNavigation(() => {
                        setEditingSportsProjectId(null);
                        setEditingFallbackProject(null);
                      })
                    }
                    className="text-slate-500 hover:text-slate-900 truncate"
                  >
                    Projects
                  </button>
                  <span aria-hidden="true" className="text-slate-300">
                    /
                  </span>
                  <h1 className="font-display font-semibold text-slate-900 truncate">
                    {editingSportsProject.name}
                  </h1>
                </>
              ) : (
                <h1 className="font-display font-semibold text-slate-900 truncate">
                  {sectionLabel}
                </h1>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeSection === 'projects' && !editingSportsProject && (
              <button
                type="button"
                onClick={() => setCreateProjectOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>New project</span>
              </button>
            )}
            {activeSection === 'members' &&
              activeWorkspace.type === 'org' &&
              (activeMembership?.role === 'owner' ||
                activeMembership?.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(
                      'input[aria-label="Invitee email address"]'
                    );
                    input?.focus();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Invite member</span>
                </button>
              )}
          </div>
        </header>

        {/* Main viewport */}
        <main
          className={
            activeSection === 'projects' && editingSportsProject
              ? 'flex-1 min-h-0 flex flex-col'
              : 'flex-1 p-4 sm:p-8'
          }
        >
          {activeSection === 'projects' && editingSportsProject ? (
            <SportsEditor
              project={editingSportsProject}
              onRenameProject={handleRenameProject}
              onRequestExit={() =>
                guardNavigation(() => {
                  setEditingSportsProjectId(null);
                  setEditingFallbackProject(null);
                })
              }
              onUnsavedStateChange={handleEditorUnsavedChange}
            />
          ) : activeSection === 'projects' ? (
            <div className="max-w-6xl space-y-6">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects by name..."
                    aria-label="Search projects by name"
                    className="w-full pl-10 pr-9 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Module filter segmented control */}
                  <div
                    role="group"
                    aria-label="Filter by module"
                    className="inline-flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-lg"
                  >
                    {(['all', 'sports', 'house', 'furniture'] as ModuleFilter[]).map(
                      (mod) => (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => setModuleFilter(mod)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            moduleFilter === mod
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {mod === 'all'
                            ? 'All modules'
                            : mod.charAt(0).toUpperCase() + mod.slice(1)}
                        </button>
                      )
                    )}
                  </div>

                  {/* Status filter segmented control */}
                  <div
                    role="group"
                    aria-label="Filter by status"
                    className="inline-flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-lg"
                  >
                    {(['all', 'active', 'archived'] as StatusFilter[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          statusFilter === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st === 'all'
                          ? 'All statuses'
                          : st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project Grid / Loading / Empty States */}
              {loadingProjects ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl p-5 h-[170px] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="h-3.5 w-28 bg-slate-100 rounded animate-pulse" />
                          <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" />
                        </div>
                        <div className="mt-4 h-5 w-48 bg-slate-100 rounded animate-pulse" />
                        <div className="mt-2 h-3.5 w-32 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                        <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl py-16 px-6 text-center">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
                    <FolderKanban className="w-5 h-5 text-slate-600" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 font-display text-base font-semibold text-slate-900">
                    No projects in {activeWorkspaceName}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
                    Create your first Sports, House, or Furniture project container to start organizing work in this workspace.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateProjectOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Create first project</span>
                  </button>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl py-14 px-6 text-center">
                  <Search className="w-6 h-6 text-slate-300 mx-auto" aria-hidden="true" />
                  <h2 className="mt-3 font-display text-base font-semibold text-slate-900">
                    No matching projects
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Adjust your search query or module/status filters to view projects.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setModuleFilter('all');
                        setStatusFilter('all');
                      }}
                      className="mt-5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.projectId}
                      project={project}
                      canDelete={canDeleteProject(project)}
                      onOpen={(proj) => {
                        if (proj.module === 'sports') {
                          setEditingFallbackProject(proj);
                          setEditingSportsProjectId(proj.projectId);
                        } else {
                          setSelectedProject(proj);
                        }
                      }}
                      onRename={handleRenameProject}
                      onToggleArchive={handleToggleArchiveProject}
                      onDelete={handleDeleteProject}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeSection === 'members' &&
            activeWorkspace.type === 'org' &&
            activeOrg &&
            activeMembership && (
              <MembersView
                organization={activeOrg}
                currentUserId={user.uid}
                currentUserRole={activeMembership.role}
                members={orgMembers}
                invitations={orgInvitations}
                loadingMembers={loadingMembers}
                onRenameOrg={handleRenameOrganization}
                onInviteMember={handleInviteMember}
                onRevokeInvitation={handleRevokeInvitation}
                onReopenInvitation={handleInviteMember}
                onUpdateMemberRole={handleUpdateMemberRole}
                onRemoveMember={handleRemoveMember}
              />
            )}

          {activeSection === 'invitations' && (
            <MyInvitationsView
              userEmail={user.email || ''}
              invitations={myInvitations}
              onAcceptInvitation={handleAcceptInvitation}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <OrganizationModal
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        onCreate={handleCreateOrganization}
      />

      <CreateProjectModal
        open={createProjectOpen}
        workspaceName={activeWorkspaceName}
        onClose={() => setCreateProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <ProjectDetailModal
        project={
          selectedProject
            ? projects.find((p) => p.projectId === selectedProject.projectId) ?? null
            : null
        }
        workspaceName={activeWorkspaceName}
        canDelete={selectedProject ? canDeleteProject(selectedProject) : false}
        onClose={() => setSelectedProject(null)}
        onToggleArchive={handleToggleArchiveProject}
        onDelete={handleDeleteProject}
      />

      {pendingNavAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-nav-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="unsaved-nav-title"
                  className="font-display text-base font-semibold text-slate-900"
                >
                  Unsaved scene changes
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Your recent Sports Ground edits have not finished saving to Firestore yet.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingNavAction(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                Stay in editor
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingNavAction;
                  setPendingNavAction(null);
                  action();
                }}
                className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 whitespace-nowrap"
              >
                Discard &amp; leave
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingNavAction;
                  void (async () => {
                    await unsavedEditorRef.current.flushSave();
                    setPendingNavAction(null);
                    action();
                  })();
                }}
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                Save &amp; leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <WorkspaceApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}
