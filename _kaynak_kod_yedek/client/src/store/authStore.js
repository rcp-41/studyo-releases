import { create } from 'zustand';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { queryClient } from '../lib/queryClient';

const useAuthStore = create((set, get) => ({
    user: null,
    loading: true,
    error: null,

    // Computed property for authentication status
    get isAuthenticated() {
        return !!get().user;
    },

    initialize: () => {
        return onAuthStateChanged(auth, (user) => {
            if (user) {
                user.getIdTokenResult().then((idTokenResult) => {
                    set({
                        user: {
                            ...user,
                            role: idTokenResult.claims.role,
                            studioId: idTokenResult.claims.studioId
                        },
                        loading: false
                    });
                }).catch((error) => {
                    console.error('Failed to get ID token:', error);
                    set({ user: null, loading: false, error: error.message });
                });
            } else {
                set({ user: null, loading: false });
            }
        });
    },

    // Login Function: Accepts full email and password
    // BUG FIX: Added finally block to ensure loading is set to false
    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle setting the user
            return { success: true };
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            // BUG FIX: Always set loading to false, even on success
            set({ loading: false });
        }
    },

    logout: async () => {
        try {
            await firebaseSignOut(auth);
            // Clear React Query cache on logout
            queryClient.clear();
            set({ user: null, error: null });
        } catch (error) {
            console.error('Logout failed:', error);
            set({ error: error.message });
        }
    }
}));

// Export store
export default useAuthStore;
