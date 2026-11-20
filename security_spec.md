# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & PII Isolation**: `users/{userId}` documents contain PII (`email`) and are readable/writable exclusively by the authenticated user where `request.auth.uid == userId` and `email_verified == true` for writes. No cross-user listing or reading is allowed.
2. **Atomic Organization Ownership**: An `organizations/{orgId}` document cannot be created without atomically creating the corresponding `memberships/{orgId}_{uid}` document with `role == 'owner'` in the same batch (`existsAfter` + `getAfter`).
3. **Deterministic Membership Keying**: Every `memberships/{membershipId}` document ID MUST equal `{orgId}_{userId}`, enabling O(1) authorization lookups via `exists()` and `get()`.
4. **Role-Gated Invitations & Member Management**: Only organization `owner` or `admin` members can create or revoke `invitations`, add/update non-owner `memberships`, or remove non-owner members. `manager` and `collaborator` roles cannot invite or remove members or escalate their own role.
5. **Strict Project Scoping**: A `projects/{projectId}` document can only be read (`get` or `list`) if `(ownerType == 'user' && ownerId == request.auth.uid)` OR `(ownerType == 'org' && isOrgMember(ownerId))`.
6. **Immutable Metadata & Server Timestamps**: `createdAt`, `createdBy`, `ownerType`, `ownerId`, `orgId`, and `userId` are immutable after creation. All `createdAt` and `updatedAt` timestamps must match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User**: Creating `/users/{uid}` with extra field `isAdmin: true`. -> **DENIED** (`hasOnly` check).
2. **Identity Spoofing on User**: Creating `/users/otherUid` while signed in as `uid`. -> **DENIED** (`request.auth.uid == userId`).
3. **Orphan Organization Creation**: Creating `/organizations/org1` without batching `/memberships/org1_{uid}`. -> **DENIED** (`existsAfter` check).
4. **Privilege Escalation on Membership**: A `collaborator` updating their own `/memberships/{orgId}_{uid}` `role` to `'owner'` or `'admin'`. -> **DENIED** (`isOrgAdminOrOwner` check & `role != 'owner'`).
5. **Unauthorized Invite by Collaborator**: A `manager` or `collaborator` creating `/invitations/inv1` for an org. -> **DENIED** (`isOrgAdminOrOwner` check).
6. **Unauthorized Member Removal**: A `collaborator` deleting another member's `/memberships/{orgId}_{otherUid}`. -> **DENIED** (`isOrgAdminOrOwner` check).
7. **Cross-Tenant Project Read**: User B attempting `get` or `list` on `/projects/{projId}` where `ownerType == 'user'` and `ownerId == 'userA'`. -> **DENIED**.
8. **Non-Member Org Project Read**: User C (not a member of `org1`) attempting `get` or `list` on `/projects` with `ownerId == 'org1'`. -> **DENIED** (`isOrgMember` check).
9. **Client Timestamp Forgery**: Creating a project with `createdAt: new Date(0)` instead of `serverTimestamp()`. -> **DENIED** (`incoming().createdAt == request.time`).
10. **Immutable Owner Reassignment**: Updating a project's `ownerId` or `ownerType` or `module` during rename. -> **DENIED** (`affectedKeys().hasOnly(['name', 'updatedAt'])`).
11. **Oversized String / Resource Poisoning**: Creating a project with a 10,000-character `name` or invalid `projectId` containing `/..`. -> **DENIED** (`isValidId` & `.size() <= 120`).
12. **Unverified Email / Spoofed Invitation Acceptance**: Accepting `/invitations/inv1` addressed to `alice@example.com` while signed in with `bob@example.com` or `email_verified == false`. -> **DENIED**.
