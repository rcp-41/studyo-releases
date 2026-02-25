import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'light', // 'light' or 'dark'

            toggleTheme: () => {
                const newTheme = get().theme === 'light' ? 'dark' : 'light';
                set({ theme: newTheme });

                // Apply theme to document
                if (newTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },

            setTheme: (theme) => {
                set({ theme });

                // Apply theme to document
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },

            initializeTheme: () => {
                const theme = get().theme;

                // Apply theme to document on init
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        }),
        {
            name: 'studyo-theme-storage', // localStorage key
            partialize: (state) => ({ theme: state.theme }) // Only persist theme
        }
    )
);

export default useThemeStore;
