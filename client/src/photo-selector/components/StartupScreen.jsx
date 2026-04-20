import { useState, useRef, useEffect, useCallback } from 'react';
import { FolderPlus, FileSearch, FolderOpen, Upload, Search, Loader2, ChevronRight, Camera } from 'lucide-react';
import { archivesApi, settingsApi, optionsApi } from '../../services/api';
import { toast } from 'sonner';

export default function StartupScreen({ onStartMode1, onStartMode2, onStartMode3 }) {
    const [activeCard, setActiveCard] = useState(null); // 1, 2, or 3

    return (
        <div className="h-screen flex flex-col bg-neutral-900 text-neutral-100">
            {/* Header */}
            <div className="h-14 flex items-center justify-center border-b border-neutral-800">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="w-5 h-5 text-amber-400" />
                    Pixonai
                </h1>
            </div>

            {/* Cards or Active Panel */}
            <div className="flex-1 overflow-hidden">
                {!activeCard ? (
                    <CardSelection onSelect={setActiveCard} />
                ) : activeCard === 1 ? (
                    <Mode1Panel onStart={onStartMode1} onBack={() => setActiveCard(null)} />
                ) : activeCard === 2 ? (
                    <Mode2Panel onStart={onStartMode2} onBack={() => setActiveCard(null)} />
                ) : (
                    <Mode3Panel onStart={onStartMode3} onBack={() => setActiveCard(null)} />
                )}
            </div>
        </div>
    );
}

// ===================== CARD SELECTION =====================
function CardSelection({ onSelect }) {
    const cards = [
        {
            id: 1,
            icon: FolderPlus,
            title: 'Arşiv Kaydı Aç',
            description: 'Yeni bir arşiv kaydı oluşturarak fotoğrafları arşiv klasörüne kopyalayın',
            color: '#f59e0b',
        },
        {
            id: 2,
            icon: FileSearch,
            title: 'Arşiv Seç',
            description: 'Mevcut bir arşiv kaydını seçerek fotoğraf seçimi yapın',
            color: '#3b82f6',
        },
        {
            id: 3,
            icon: FolderOpen,
            title: 'Klasör Seç',
            description: 'Arşivden bağımsız olarak bir klasördeki fotoğrafları numaralandırın',
            color: '#22c55e',
        },
    ];

    return (
        <div className="h-full flex items-center justify-center p-8">
            <div className="flex gap-6 max-w-4xl">
                {cards.map(card => (
                    <button
                        key={card.id}
                        onClick={() => onSelect(card.id)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-2xl p-8
                                   hover:border-amber-500/50 hover:bg-neutral-800/80 transition-all duration-200
                                   cursor-pointer group text-left"
                    >
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                            style={{ background: `${card.color}20` }}>
                            <card.icon className="w-7 h-7" style={{ color: card.color }} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-amber-400 transition-colors">
                            {card.title}
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">
                            {card.description}
                        </p>
                        <div className="mt-4 text-xs text-neutral-500 flex items-center gap-1 group-hover:text-amber-400/70 transition-colors">
                            Devam et <ChevronRight className="w-3 h-3" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ===================== MODE 1 - Arşiv Kaydı Aç =====================
function Mode1Panel({ onStart, onBack }) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [shootTypes, setShootTypes] = useState([]);
    const [selectedShootType, setSelectedShootType] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [loading, setLoading] = useState(false);
    const dropRef = useRef(null);

    useEffect(() => {
        optionsApi.getShootTypes().then(res => {
            setShootTypes(res?.data || []);
        }).catch(() => { });
    }, []);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            // Get the folder path from the dropped item
            const firstFile = files[0];
            const filePath = firstFile.path;
            if (filePath) {
                // Get directory from file path
                const folderPath = filePath.replace(/[\\/][^\\/]+$/, '');
                setSelectedFolder(folderPath);
            }
        }
    }, []);

    const handleSelectFolder = async () => {
        const selected = await window.electron?.photoSelector?.selectFolder();
        if (selected) setSelectedFolder(selected);
    };

    const handleCreate = async () => {
        if (!selectedFolder) {
            toast.error('Lütfen bir klasör seçin');
            return;
        }
        if (!selectedShootType) {
            toast.error('Lütfen çekim türü seçin');
            return;
        }

        setLoading(true);
        try {
            const shootType = shootTypes.find(st => st.id === selectedShootType);
            onStart({
                sourcePath: selectedFolder,
                shootType: shootType,
                shootCategory: shootType?.name || '',
                customerName: customerName,
            });
        } catch (err) {
            toast.error('Hata: ' + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-lg space-y-6">
                <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                    ← Geri
                </button>

                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FolderPlus className="w-5 h-5 text-amber-400" />
                    Arşiv Kaydı Aç
                </h2>

                {/* Drag & Drop Zone */}
                <div
                    ref={dropRef}
                    onDragEnter={handleDragIn}
                    onDragLeave={handleDragOut}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                        ${dragActive
                            ? 'border-amber-400 bg-amber-400/10'
                            : selectedFolder
                                ? 'border-green-500/50 bg-green-500/5'
                                : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                        }`}
                    onClick={handleSelectFolder}
                >
                    {selectedFolder ? (
                        <div>
                            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-green-400" />
                            <p className="text-sm font-medium text-green-400">Klasör seçildi</p>
                            <p className="text-xs text-neutral-500 mt-1 truncate max-w-sm mx-auto">
                                {selectedFolder}
                            </p>
                            <p className="text-xs text-neutral-600 mt-2">Değiştirmek için tıklayın</p>
                        </div>
                    ) : (
                        <div>
                            <Upload className="w-10 h-10 mx-auto mb-3 text-neutral-500" />
                            <p className="text-sm text-neutral-400">
                                Fotoğraf klasörünü buraya sürükleyin
                            </p>
                            <p className="text-xs text-neutral-600 mt-1">veya tıklayarak seçin</p>
                        </div>
                    )}
                </div>

                {/* Shoot Type */}
                <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Çekim Türü</label>
                    <select
                        value={selectedShootType}
                        onChange={e => setSelectedShootType(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-800 border border-neutral-700
                                   focus:border-amber-500 outline-none"
                    >
                        <option value="">Seçiniz...</option>
                        {shootTypes.map(st => (
                            <option key={st.id} value={st.id}>
                                {st.name} ({st.category?.replace(/_/g, ' ')})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Customer Name */}
                <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Müşteri Adı (opsiyonel)</label>
                    <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Müşteri adı..."
                        className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-800 border border-neutral-700
                                   focus:border-amber-500 outline-none"
                    />
                </div>

                {/* Create Button */}
                <button
                    onClick={handleCreate}
                    disabled={!selectedFolder || !selectedShootType || loading}
                    className="w-full py-3 bg-amber-500 text-neutral-900 rounded-xl font-semibold
                               hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        'Kayıt Oluştur ve Devam Et'
                    )}
                </button>
            </div>
        </div>
    );
}

// ===================== MODE 2 - Arşiv Seç =====================
function Mode2Panel({ onStart, onBack }) {
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArchive, setSelectedArchive] = useState(null);

    useEffect(() => {
        loadArchives();
    }, []);

    const loadArchives = async (search = '') => {
        setLoading(true);
        try {
            const result = await archivesApi.list({
                search: search || undefined,
                limit: 100,
            });
            setArchives(result?.data || []);
        } catch (err) {
            toast.error('Arşivler yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        // Debounce search
        clearTimeout(window._archiveSearchTimer);
        window._archiveSearchTimer = setTimeout(() => {
            loadArchives(value);
        }, 300);
    };

    const handleSelect = () => {
        if (!selectedArchive) return;
        onStart(selectedArchive);
    };

    return (
        <div className="h-full flex flex-col p-6">
            <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4">
                ← Geri
            </button>

            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <FileSearch className="w-5 h-5 text-blue-400" />
                Arşiv Seç
            </h2>

            {/* Search */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Arşiv no, müşteri adı veya telefon ile arayın..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-neutral-800 border border-neutral-700
                               focus:border-blue-500 outline-none"
                />
            </div>

            {/* Archive List */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800/50">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    </div>
                ) : archives.length === 0 ? (
                    <div className="text-center py-16 text-neutral-500 text-sm">
                        {searchTerm ? 'Arama sonucu bulunamadı' : 'Arşiv kaydı yok'}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-neutral-800 text-neutral-400">
                            <tr>
                                <th className="text-left px-4 py-2.5 font-medium">No</th>
                                <th className="text-left px-4 py-2.5 font-medium">Müşteri</th>
                                <th className="text-left px-4 py-2.5 font-medium">Telefon</th>
                                <th className="text-left px-4 py-2.5 font-medium">Çekim Türü</th>
                                <th className="text-left px-4 py-2.5 font-medium">Tarih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {archives.map(arc => (
                                <tr
                                    key={arc.id}
                                    onClick={() => setSelectedArchive(arc)}
                                    className={`cursor-pointer border-t border-neutral-700/50 transition-colors
                                        ${selectedArchive?.id === arc.id
                                            ? 'bg-blue-500/10 border-blue-500/30'
                                            : 'hover:bg-neutral-700/30'
                                        }`}
                                >
                                    <td className="px-4 py-2.5 font-mono font-semibold text-amber-400">
                                        {arc.archiveNumber || arc.id}
                                    </td>
                                    <td className="px-4 py-2.5">{arc.fullName || '—'}</td>
                                    <td className="px-4 py-2.5 text-neutral-400">{arc.phone || '—'}</td>
                                    <td className="px-4 py-2.5 text-neutral-400">
                                        {arc.shootType?.name || arc.shootTypeId || '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-neutral-500 text-xs">
                                        {arc.createdAt ? new Date(arc.createdAt).toLocaleDateString('tr-TR') : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Action */}
            <div className="mt-4 flex justify-end">
                <button
                    onClick={handleSelect}
                    disabled={!selectedArchive}
                    className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium
                               hover:bg-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center gap-2"
                >
                    <ChevronRight className="w-4 h-4" />
                    Seçim Yap
                </button>
            </div>
        </div>
    );
}

// ===================== MODE 3 - Klasör Seç =====================
function Mode3Panel({ onStart, onBack }) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [pixonaiConfigs, setPixonaiConfigs] = useState([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);
    const dropRef = useRef(null);

    // Load Pixonai configs when a folder is selected
    useEffect(() => {
        if (!selectedFolder) return;
        setLoadingConfigs(true);
        import('../../services/api').then(({ pixonaiApi }) => {
            pixonaiApi.getConfigs().then(result => {
                setPixonaiConfigs(result?.configs || []);
            }).catch(() => {
                setPixonaiConfigs([]);
            }).finally(() => setLoadingConfigs(false));
        });
    }, [selectedFolder]);

    const handleFolderSelected = useCallback((folderPath) => {
        setSelectedFolder(folderPath);
    }, []);

    const handleShootTypeSelect = (config) => {
        // config is null for 'paketsiz' mode
        onStart(selectedFolder, config);
    };

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const filePath = files[0].path;
            if (filePath) {
                const folderPath = filePath.replace(/[\\/][^\\/]+$/, '');
                handleFolderSelected(folderPath);
            }
        }
    }, [handleFolderSelected]);

    const handleSelectFolder = async () => {
        const selected = await window.electron?.photoSelector?.selectFolder();
        if (selected) handleFolderSelected(selected);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-lg space-y-6">
                <button
                    onClick={() => selectedFolder ? setSelectedFolder(null) : onBack()}
                    className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                    ← {selectedFolder ? 'Klasör Değiştir' : 'Geri'}
                </button>

                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-green-400" />
                    {selectedFolder ? 'Çekim Türü Seç' : 'Klasör Seç'}
                </h2>

                {!selectedFolder ? (
                    <>
                        <p className="text-sm text-neutral-400">
                            Arşivden bağımsız olarak bir klasördeki fotoğrafları inceleyin ve numaralandırın.
                        </p>

                        {/* Drag & Drop Zone */}
                        <div
                            ref={dropRef}
                            onDragEnter={handleDragIn}
                            onDragLeave={handleDragOut}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={handleSelectFolder}
                            className={`border-2 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer
                                ${dragActive
                                    ? 'border-green-400 bg-green-400/10'
                                    : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/50'
                                }`}
                        >
                            <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-500" />
                            <p className="text-neutral-300 font-medium">
                                Fotoğraf klasörünü buraya sürükleyin
                            </p>
                            <p className="text-xs text-neutral-600 mt-2">veya tıklayarak seçin</p>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-neutral-400">
                            <span className="text-neutral-300 font-mono text-xs">{selectedFolder}</span>
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">
                            Numaralandırma türünü seçin:
                        </p>

                        {loadingConfigs ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Paketsiz option */}
                                <button
                                    onClick={() => handleShootTypeSelect(null)}
                                    className="w-full flex items-center gap-3 p-4 rounded-xl
                                             bg-neutral-800 hover:bg-neutral-750 border border-neutral-700
                                             hover:border-neutral-600 transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-neutral-700 flex items-center justify-center shrink-0">
                                        <span className="text-lg">🔢</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-neutral-200">Paketsiz (Sadece Numaralandır)</p>
                                        <p className="text-xs text-neutral-500">01, 02, 03... şeklinde basit numaralandırma</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-neutral-600 ml-auto" />
                                </button>

                                {/* Pixonai configs */}
                                {pixonaiConfigs.map(config => (
                                    <button
                                        key={config.id}
                                        onClick={() => handleShootTypeSelect(config)}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl
                                                 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700
                                                 hover:border-amber-500/50 transition-all text-left"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30
                                                      flex items-center justify-center shrink-0">
                                            <Camera className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-neutral-200">{config.shootCategoryLabel}</p>
                                            <p className="text-xs text-neutral-500">
                                                {config.packages?.length || 0} paket ·{' '}
                                                {config.type === 'yearly' ? 'Yıllık' :
                                                    config.type === 'set' ? 'Set' :
                                                        config.type === 'portrait' ? 'Vesikalık/Biyometrik' : config.type}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-neutral-600 ml-auto" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
