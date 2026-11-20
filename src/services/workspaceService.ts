import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, db, googleProvider } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { createInitialFloorPlan } from '../lib/house/presets';
import { createInitialScene } from '../lib/sports/presets';
import type { SportPresetId } from '../lib/sports/types';
import {
  BLUEPRINT_CONSTRAINTS,
  type InvitationDoc,
  type InvitationRole,
  type MembershipRole,
  type OrganizationDoc,
  type ProjectModule,
  type ProjectOwnerType,
  type ProjectStatus,
} from '../types/models';

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function getBrowserLocale(): string {
  const raw = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  return raw.slice(0, BLUEPRINT_CONSTRAINTS.user.localeMax);
}

function normalizeDisplayName(name: string | null, email: string | null): string {
  const fallback = email ? email.split('@')[0] : 'Workspace User';
  const cleaned = (name || fallback).trim();
  return cleaned.slice(0, BLUEPRINT_CONSTRAINTS.user.displayNameMax) || 'Workspace User';
}

export function computeEmailSlug(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export async function syncUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const email = (user.email || '').trim().toLowerCase().slice(0, BLUEPRINT_CONSTRAINTS.user.emailMax);
  if (email.length < BLUEPRINT_CONSTRAINTS.user.emailMin) {
    throw new Error('Google account must provide a valid email address.');
  }
  const displayName = normalizeDisplayName(user.displayName, email);
  const locale = getBrowserLocale();

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName,
        locale,
        createdAt: serverTimestamp(),
      });
    } else {
      const data = existingSnap.data();
      if (
        data.email !== email ||
        data.displayName !== displayName ||
        data.locale !== locale
      ) {
        await updateDoc(userRef, {
          email,
          displayName,
          locale,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createOrganization(name: string, user: User): Promise<string> {
  const trimmedName = name.trim();
  if (
    trimmedName.length < BLUEPRINT_CONSTRAINTS.organization.nameMin ||
    trimmedName.length > BLUEPRINT_CONSTRAINTS.organization.nameMax
  ) {
    throw new Error(
      `Organization name must be between ${BLUEPRINT_CONSTRAINTS.organization.nameMin} and ${BLUEPRINT_CONSTRAINTS.organization.nameMax} characters.`
    );
  }

  const orgRef = doc(collection(db, 'organizations'));
  const orgId = orgRef.id;
  const membershipId = `${orgId}_${user.uid}`;
  const membershipRef = doc(db, 'memberships', membershipId);
  const displayName = normalizeDisplayName(user.displayName, user.email);

  const batch = writeBatch(db);
  batch.set(orgRef, {
    orgId,
    name: trimmedName,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  });
  batch.set(membershipRef, {
    membershipId,
    orgId,
    userId: user.uid,
    role: 'owner' as MembershipRole,
    displayName,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return orgId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `organizations/${orgId}`);
  }
}

export async function renameOrganization(orgId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (
    trimmedName.length < BLUEPRINT_CONSTRAINTS.organization.nameMin ||
    trimmedName.length > BLUEPRINT_CONSTRAINTS.organization.nameMax
  ) {
    throw new Error(
      `Organization name must be between ${BLUEPRINT_CONSTRAINTS.organization.nameMin} and ${BLUEPRINT_CONSTRAINTS.organization.nameMax} characters.`
    );
  }
  const path = `organizations/${orgId}`;
  try {
    await updateDoc(doc(db, 'organizations', orgId), {
      name: trimmedName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function inviteMemberByEmail(
  org: OrganizationDoc,
  rawEmail: string,
  role: InvitationRole,
  invitedByUid: string
): Promise<string> {
  const email = rawEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !emailRegex.test(email) ||
    email.length < BLUEPRINT_CONSTRAINTS.invitation.emailMin ||
    email.length > BLUEPRINT_CONSTRAINTS.invitation.emailMax
  ) {
    throw new Error('Please enter a valid email address.');
  }

  const slug = computeEmailSlug(email);
  const invitationId = `${org.orgId}__${slug}`;
  const path = `invitations/${invitationId}`;
  const inviteRef = doc(db, 'invitations', invitationId);

  try {
    const existingSnap = await getDoc(inviteRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as InvitationDoc;
      if (existingData.status === 'pending') {
        throw new Error(`An invitation is already pending for ${email}.`);
      }
      if (existingData.status === 'revoked') {
        await updateDoc(inviteRef, {
          status: 'pending',
          role,
          updatedAt: serverTimestamp(),
        });
        return invitationId;
      }
      // If previously accepted (e.g., member was later removed), replace cleanly in a batch
      const replaceBatch = writeBatch(db);
      replaceBatch.delete(inviteRef);
      replaceBatch.set(inviteRef, {
        invitationId,
        orgId: org.orgId,
        orgName: org.name.slice(0, BLUEPRINT_CONSTRAINTS.organization.nameMax),
        email,
        role,
        invitedBy: invitedByUid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      await replaceBatch.commit();
      return invitationId;
    }

    await setDoc(inviteRef, {
      invitationId,
      orgId: org.orgId,
      orgName: org.name.slice(0, BLUEPRINT_CONSTRAINTS.organization.nameMax),
      email,
      role,
      invitedBy: invitedByUid,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return invitationId;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already pending')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const path = `invitations/${invitationId}`;
  try {
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function acceptInvitation(invitation: InvitationDoc, user: User): Promise<void> {
  const membershipId = `${invitation.orgId}_${user.uid}`;
  const inviteRef = doc(db, 'invitations', invitation.invitationId);
  const membershipRef = doc(db, 'memberships', membershipId);
  const displayName = normalizeDisplayName(user.displayName, user.email);

  const batch = writeBatch(db);
  batch.update(inviteRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });
  batch.set(membershipRef, {
    membershipId,
    orgId: invitation.orgId,
    userId: user.uid,
    role: invitation.role,
    displayName,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invitations/${invitation.invitationId}`);
  }
}

export async function updateMemberRole(
  membershipId: string,
  role: InvitationRole
): Promise<void> {
  const path = `memberships/${membershipId}`;
  try {
    await updateDoc(doc(db, 'memberships', membershipId), {
      role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMember(membershipId: string): Promise<void> {
  const path = `memberships/${membershipId}`;
  try {
    await deleteDoc(doc(db, 'memberships', membershipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createProject(params: {
  ownerType: ProjectOwnerType;
  ownerId: string;
  name: string;
  module: ProjectModule;
  createdBy: string;
  sport?: SportPresetId;
}): Promise<string> {
  const trimmedName = params.name.trim();
  if (
    trimmedName.length < BLUEPRINT_CONSTRAINTS.project.nameMin ||
    trimmedName.length > BLUEPRINT_CONSTRAINTS.project.nameMax
  ) {
    throw new Error(
      `Project name must be between ${BLUEPRINT_CONSTRAINTS.project.nameMin} and ${BLUEPRINT_CONSTRAINTS.project.nameMax} characters.`
    );
  }

  const projectRef = doc(collection(db, 'projects'));
  const projectId = projectRef.id;
  const path = `projects/${projectId}`;

  const payload: Record<string, unknown> = {
    projectId,
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    name: trimmedName,
    module: params.module,
    status: 'active' as ProjectStatus,
    createdBy: params.createdBy,
    createdAt: serverTimestamp(),
  };

  if (params.module === 'sports') {
    const chosenSport: SportPresetId = params.sport ?? 'custom';
    const initialScene = createInitialScene(chosenSport);
    payload.sport = chosenSport;
    payload.scene = {
      ...initialScene,
      updatedAt: serverTimestamp(),
    };
  } else if (params.module === 'house') {
    const initialFloorPlan = createInitialFloorPlan();
    payload.floorPlan = {
      ...initialFloorPlan,
      updatedAt: serverTimestamp(),
    };
  }

  try {
    await setDoc(projectRef, payload);
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (
    trimmedName.length < BLUEPRINT_CONSTRAINTS.project.nameMin ||
    trimmedName.length > BLUEPRINT_CONSTRAINTS.project.nameMax
  ) {
    throw new Error(
      `Project name must be between ${BLUEPRINT_CONSTRAINTS.project.nameMin} and ${BLUEPRINT_CONSTRAINTS.project.nameMax} characters.`
    );
  }

  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      name: trimmedName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
