import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.toLowerCase().includes('permission')) {
          return `Permission denied while trying to ${parsed.operationType ?? 'access'} ${parsed.path ?? 'data'}.`;
        }
        return parsed.error;
      }
    } catch {
      // Not a JSON FirestoreErrorInfo payload
    }
    if (error.message.includes('auth/popup-closed-by-user')) {
      return 'Google sign-in popup was closed before completing authentication.';
    }
    if (error.message.includes('auth/popup-blocked')) {
      return 'Sign-in popup was blocked by your browser. Please allow popups and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred.';
}
