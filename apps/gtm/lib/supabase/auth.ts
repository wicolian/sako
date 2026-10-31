/**
 * Auth Functions - Clerk
 * 
 * MIGRATED: Authentication is now handled by Clerk.
 * These functions are stubs that redirect to Clerk.
 * 
 * For client-side auth:
 *   import { useSignIn, useSignUp, useUser } from '@clerk/nextjs'
 * 
 * For server-side auth:
 *   import { auth, currentUser } from '@clerk/nextjs/server'
 */

// ============================================================================
// Deprecated - Use Clerk hooks instead
// ============================================================================

/**
 * @deprecated Use useSignIn() from @clerk/nextjs instead
 */
export async function signInWithEmail(_email: string, _password: string) {
  console.warn('signInWithEmail is deprecated. Use useSignIn() from @clerk/nextjs');
  return { 
    data: null, 
    error: new Error('Use Clerk for authentication. Import useSignIn from @clerk/nextjs') 
  };
}

/**
 * @deprecated Use useSignUp() from @clerk/nextjs instead
 */
export async function signUpWithEmail(
  _email: string, 
  _password: string, 
  _metadata?: { full_name?: string }
) {
  console.warn('signUpWithEmail is deprecated. Use useSignUp() from @clerk/nextjs');
  return { 
    data: null, 
    error: new Error('Use Clerk for authentication. Import useSignUp from @clerk/nextjs') 
  };
}

/**
 * @deprecated Use useClerk().signOut() from @clerk/nextjs instead
 */
export async function signOut() {
  console.warn('signOut is deprecated. Use useClerk().signOut() from @clerk/nextjs');
  return { error: new Error('Use Clerk for authentication') };
}

/**
 * @deprecated Use useUser() from @clerk/nextjs or auth() from @clerk/nextjs/server
 */
export async function getCurrentUser() {
  console.warn('getCurrentUser is deprecated. Use useUser() or auth() from @clerk/nextjs');
  return null;
}

/**
 * @deprecated Use Clerk's forgot password flow
 */
export async function resetPassword(_email: string) {
  console.warn('resetPassword is deprecated. Use Clerk forgot password flow');
  return { 
    data: null, 
    error: new Error('Use Clerk for password reset') 
  };
}

// ============================================================================
// Utility re-exports for gradual migration
// ============================================================================

// Re-export Clerk utilities for convenience
export { auth, currentUser } from '@clerk/nextjs/server';
