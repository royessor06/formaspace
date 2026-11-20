import type { Timestamp } from 'firebase/firestore';
import type { MembershipRole, ProjectModule } from '../types/models';

export function formatTimestamp(ts?: Timestamp | null): string {
  if (!ts) return 'Just now';
  try {
    const date = ts.toDate();
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Just now';
  }
}

export function getModuleLabel(module: ProjectModule): string {
  switch (module) {
    case 'sports':
      return 'Sports';
    case 'house':
      return 'House';
    case 'furniture':
      return 'Furniture';
  }
}

export function getRoleLabel(role: MembershipRole): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'collaborator':
      return 'Collaborator';
  }
}

export function getInitials(name?: string | null, email?: string | null): string {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
