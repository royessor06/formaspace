import { useState } from 'react';
import { Armchair, ArrowRight, Building2, Home, Layers, ShieldCheck, Trophy } from 'lucide-react';
import { signInWithGoogle } from '../services/workspaceService';
import { getFriendlyErrorMessage } from '../lib/firestoreErrors';
import { useToast } from './ToastProvider';

export function AuthScreen() {
  const [signingIn, setSigningIn] = useState(false);
  const { showToast } = useToast();

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      showToast({
        variant: 'error',
        title: 'Sign-in failed',
        message: getFriendlyErrorMessage(error),
      });
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-slate-900">
              FormaSpace
            </span>
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-medium text-blue-600 tracking-wide">
              Workspace & Project Containers
            </p>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
              Organize Sports, House, and Furniture projects across teams
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
              Manage personal containers alongside shared organization workspaces with
              role-scoped membership and strict Firestore isolation.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <Trophy className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold text-slate-900">Sports</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Athletic & facility project containers
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <Home className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold text-slate-900">House</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Residential planning & room containers
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <Armchair className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-semibold text-slate-900">Furniture</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Custom joinery & piece containers
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex">
            <div className="w-full bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-800" aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-xl font-semibold text-slate-900">
                  Access your workspaces
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Continue with your Google account to create organizations, invite team
                  members, and organize project containers.
                </p>

                <ul className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Personal workspace plus unlimited team organizations</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Owner, Admin, Manager, and Collaborator access control</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                  className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                  <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <p className="mt-3 text-xs text-slate-500 text-center">
                  Secured by Firebase Authentication (Google Sign-In only)
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
