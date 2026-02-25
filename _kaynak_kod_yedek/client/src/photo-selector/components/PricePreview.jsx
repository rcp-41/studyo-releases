export default function PricePreview({ breakdown, total }) {
    if (!breakdown || breakdown.length === 0) return null;

    return (
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 overflow-hidden">
            <div className="px-3 py-2 border-b border-neutral-700">
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Fiyat Dökümü
                </h3>
            </div>

            <div className="divide-y divide-neutral-800">
                {breakdown.map((item) => (
                    <div key={`${item.photoId}-${item.orderNumber}`}
                        className="flex items-center justify-between px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono text-amber-400 w-5 shrink-0">
                                #{item.orderNumber}
                            </span>
                            <span className="text-neutral-300 truncate">{item.label}</span>
                        </div>
                        <span className="font-medium text-neutral-200 ml-3 shrink-0">
                            {formatCurrency(item.amount)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between px-3 py-2.5
                            border-t border-neutral-700 bg-neutral-800">
                <span className="text-sm font-semibold text-neutral-200">Toplam</span>
                <span className="text-sm font-bold text-amber-400">
                    {formatCurrency(total)}
                </span>
            </div>
        </div>
    );
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
