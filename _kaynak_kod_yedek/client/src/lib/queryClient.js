import { QueryClient } from '@tanstack/react-query';

// Shared QueryClient instance - exported for use in authStore logout
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
