import type { Timestamp } from 'firebase/firestore';
import type { FloorPlan } from '../lib/house/types';
import type { SportPresetId, SportsScene } from '../lib/sports/types';

export type MembershipRole = 'owner' | 'admin' | 'manager' | 'collaborator';
export type InvitationRole = 'admin' | 'manager' | 'collaborator';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';
export type ProjectOwnerType = 'user' | 'org';
export type ProjectModule = 'sports' | 'house' | 'furniture';
export type ProjectStatus = 'active' | 'archived';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  locale: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrganizationDoc {
  orgId: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface MembershipDoc {
  membershipId: string;
  orgId: string;
  userId: string;
  role: MembershipRole;
  displayName?: string;
  createdAt?: Timestamp;
}

export interface InvitationDoc {
  invitationId: string;
  orgId: string;
  orgName: string;
  email: string;
  role: InvitationRole;
  invitedBy: string;
  status: InvitationStatus;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectDoc {
  projectId: string;
  ownerType: ProjectOwnerType;
  ownerId: string;
  name: string;
  module: ProjectModule;
  status: ProjectStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  sport?: SportPresetId;
  scene?: SportsScene;
  floorPlan?: FloorPlan;
}

export type ActiveWorkspace =
  | { type: 'personal' }
  | { type: 'org'; orgId: string };

export type ActiveSection = 'projects' | 'members' | 'invitations';

/**
 * Synchronized verbatim with firebase-blueprint.json schema boundaries.
 */
export const BLUEPRINT_CONSTRAINTS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  user: {
    displayNameMin: 1,
    displayNameMax: 120,
    emailMin: 3,
    emailMax: 254,
    localeMin: 2,
    localeMax: 35,
  },
  organization: {
    nameMin: 1,
    nameMax: 100,
  },
  project: {
    nameMin: 1,
    nameMax: 120,
  },
  invitation: {
    emailMin: 3,
    emailMax: 254,
  },
} as const;
