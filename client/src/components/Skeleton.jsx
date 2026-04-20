import { cn } from '../lib/utils';

function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn('animate-pulse rounded-lg bg-muted/60', className)}
            {...props}
        />
    );
}

export function SkeletonCard({ className }) {
    return (
        <div className={cn('bg-card border border-border rounded-xl p-6 space-y-4', className)}>
            <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
        </div>
    );
}

export function SkeletonRow({ columns = 5, className }) {
    return (
        <div className={cn('flex items-center gap-4 p-4 border-b border-border', className)}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn('h-4', i === 0 ? 'w-12' : i === 1 ? 'w-32' : 'w-20')}
                />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5, columns = 5, className }) {
    return (
        <div className={cn('bg-card border border-border rounded-xl overflow-hidden', className)}>
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/30">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-20" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} />
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <SkeletonCard className="h-64" />
                <SkeletonCard className="lg:col-span-2 h-64" />
            </div>
        </div>
    );
}

export function SkeletonList({ count, rows, className }) {
    // Accept either `count` (legacy) or `rows` (preferred) for the number of items.
    const n = rows ?? count ?? 5;
    return (
        <div className={cn('space-y-3', className)} role="status" aria-busy="true" aria-label="Yükleniyor">
            {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
            ))}
            <span className="sr-only">Yükleniyor...</span>
        </div>
    );
}

export default Skeleton;
