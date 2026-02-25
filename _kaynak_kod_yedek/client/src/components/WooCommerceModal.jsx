import { useState, useEffect, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { whatsappApi } from '../services/api';
import { woocommerceApi } from '../services/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    X, Loader2, Link2, Copy, Check, Plus, Trash2,
    Upload, Globe, MessageCircle, ShoppingCart, Package,
    FolderOpen, AlertCircle, FolderInput, Image
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

// Safe date formatter that handles Firestore Timestamps and invalid dates
const safeFormatDate = (dateValue, formatStr = 'dd MMM yyyy') => {
    if (!dateValue) return '-';
    try {
        // Handle Firestore Timestamp objects
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return format(dateValue.toDate(), formatStr, { locale: tr });
        }
        // Handle seconds/nanoseconds format from Firestore
        if (dateValue._seconds || dateValue.seconds) {
            const seconds = dateValue._seconds || dateValue.seconds;
            return format(new Date(seconds * 1000), formatStr, { locale: tr });
        }
        // Handle regular date strings or Date objects
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '-';
        return format(date, formatStr, { locale: tr });
    } catch (error) {
        console.error('Date format error:', error, dateValue);
        return '-';
    }
};


export default function WooCommerceModal({ isOpen, onClose, archive }) {
    const [view, setView] = useState('loading'); // loading, empty, dashboard, upload
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Upload state
    const [uploadMode, setUploadMode] = useState('single'); // single, bulk
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [priceList, setPriceList] = useState([
        { size: '10x15', price: 20 },
        { size: '15x21', price: 40 },
        { size: 'Dijital', price: 50 }
    ]);
    const [password, setPassword] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percent: 0 });

    // BUG FIX: Changed from useState to useRef for file input reference
    // useState causes re-render issues with file inputs
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen && archive) {
            loadStats();
            // Generate default password from phone last 4 digits
            setPassword(archive.phone?.slice(-4) || '1234');
        }
    }, [isOpen, archive]);

    const loadStats = async () => {
        setView('loading');
        try {
            const { data } = await woocommerceApi.getStats(archive.id);
            setStats(data);
            setView(data.wcLink ? 'dashboard' : 'empty');
        } catch (error) {
            console.error('Stats load error:', error);
            setView('empty');
        }
    };

    const handleSelectFiles = async () => {
        if (window.electron?.showOpenDialog) {
            // Electron: Use native file dialog
            const result = await window.electron.showOpenDialog({
                defaultPath: archive.folderPath || '',
                filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
                properties: ['openFile', 'multiSelections']
            });
            if (result && result.length > 0) {
                setSelectedFiles(result);
            }
        } else {
            // Browser: Trigger hidden file input
            const input = document.getElementById('wc-file-input');
            if (input) input.click();
        }
    };

    // Browser file input handler
    const handleBrowserFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Store File objects directly for browser
            setSelectedFiles(files);
        }
    };

    const handleSelectFolder = async () => {
        if (window.electron?.showOpenDialog) {
            const result = await window.electron.showOpenDialog({
                defaultPath: archive.folderPath || '',
                properties: ['openDirectory']
            });
            if (result && result.length > 0) {
                // Get all image files from folder
                if (window.electron?.getFilesInFolder) {
                    const files = await window.electron.getFilesInFolder(result[0], ['jpg', 'jpeg', 'png', 'webp']);
                    setSelectedFiles(files);
                } else {
                    setSelectedFiles(result);
                }
            }
        }
    };

    const addPriceRow = () => {
        setPriceList([...priceList, { size: '', price: 0 }]);
    };

    const removePriceRow = (index) => {
        setPriceList(priceList.filter((_, i) => i !== index));
    };

    const updatePriceRow = (index, field, value) => {
        const updated = [...priceList];
        updated[index][field] = field === 'price' ? parseFloat(value) || 0 : value;
        setPriceList(updated);
    };

    /**
     * Upload files to Firebase Storage, then create WooCommerce products
     */
    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            return toast.error('Dosya seçiniz');
        }
        if (priceList.length === 0 || priceList.some(p => !p.size || !p.price)) {
            return toast.error('Fiyat listesini doldurunuz');
        }
        if (!password) {
            return toast.error('Şifre giriniz');
        }

        setUploading(true);
        setUploadProgress({ current: 0, total: selectedFiles.length, percent: 0 });

        try {
            // Step 1: Upload files to Firebase Storage
            const uploadedImages = [];

            for (let i = 0; i < selectedFiles.length; i++) {
                const fileItem = selectedFiles[i];

                // Determine if this is a browser File object or Electron file path
                const isBrowserFile = fileItem instanceof File;
                const fileName = isBrowserFile ? fileItem.name : fileItem.split(/[\\/]/).pop();

                setUploadProgress({
                    current: i + 1,
                    total: selectedFiles.length,
                    percent: Math.round(((i) / selectedFiles.length) * 100),
                    currentFile: fileName
                });

                // Get file data based on source
                let fileData;
                if (isBrowserFile) {
                    // Browser: File is already a blob
                    fileData = fileItem;
                } else if (window.electron?.readFileAsBuffer) {
                    // Electron: Read file from path
                    fileData = await window.electron.readFileAsBuffer(fileItem);
                } else {
                    throw new Error('File reading not supported');
                }

                // Create storage reference
                const storagePath = `selections/${archive.id}/${Date.now()}_${fileName}`;
                const storageRef = ref(storage, storagePath);

                // Upload to Firebase Storage
                await new Promise((resolve, reject) => {
                    const uploadTask = uploadBytesResumable(storageRef, fileData);

                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const filePercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            const overallPercent = Math.round(((i + filePercent / 100) / selectedFiles.length) * 100);
                            setUploadProgress(prev => ({ ...prev, percent: overallPercent }));
                        },
                        (error) => reject(error),
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            uploadedImages.push({
                                name: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                                url: downloadURL,
                                storagePath: storagePath
                            });
                            resolve();
                        }
                    );
                });
            }

            setUploadProgress(prev => ({ ...prev, percent: 100, currentFile: 'WooCommerce ürünleri oluşturuluyor...' }));

            // Step 2: Create WooCommerce products with Firebase URLs
            const { data } = await woocommerceApi.uploadSingle({
                archiveId: archive.id,
                categoryName: archive.fullName || `Galeri-${archive.id}`,
                password: password,
                images: uploadedImages,
                priceList: priceList
            });

            toast.success(`${uploadedImages.length} fotoğraf yüklendi ve WooCommerce'e aktarıldı!`);
            loadStats();

        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Yükleme başarısız');
        }

        setUploading(false);
        setUploadProgress({ current: 0, total: 0, percent: 0 });
    };

    const handleReset = async () => {
        if (!confirm('Seçim linki, ürünler ve yüklenen fotoğraflar silinecek. Emin misiniz?')) return;

        setLoading(true);
        try {
            await woocommerceApi.reset(archive.id);
            toast.success('Link ve fotoğraflar silindi');
            loadStats();
        } catch (error) {
            toast.error('Sıfırlama başarısız');
        }
        setLoading(false);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(stats.wcLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Link kopyalandı');
    };

    const sendWhatsApp = async (type) => {
        let message = '';
        if (type === 'link') {
            message = `Sayın ${archive.fullName},\n\nFotoğraflarınız hazırdır. Aşağıdaki linkten görüntüleyebilir ve sipariş verebilirsiniz:\n\n${stats.wcLink}\nŞifre: ${stats.wcPassword}\n\nİyi günler dileriz.`;
        } else if (type === 'order') {
            const totalItems = stats.orders?.reduce((sum, o) => sum + o.items.length, 0) || 0;
            const totalSpent = stats.orders?.reduce((sum, o) => sum + parseFloat(o.total), 0) || 0;
            message = `Sayın ${archive.fullName},\n\nToplam ${totalItems} adet fotoğraf seçiminiz onaylandı.\nToplam tutar: ${totalSpent.toLocaleString('tr-TR')} ₺\n\nFotoğraflarınız hazırlanmaya başlanacaktır. İletmek istediğiniz bir mesajınız var mı?`;
        }

        try {
            await whatsappApi.send({ phone: archive.phone, message });
            toast.success('Mesaj gönderildi');
        } catch (error) {
            toast.error('Mesaj gönderilemedi');
        }
    };

    const handleCopyPhotos = async () => {
        const toastId = toast.loading('İşlem başlatılıyor...');

        try {
            const { data } = await woocommerceApi.copyPhotos({
                archiveId: archive.id
            });

            if (data.success) {
                toast.success(data.message, { id: toastId });
                return;
            }
        } catch (err) {
            if (err.response?.data?.needPath) {
                toast.dismiss(toastId);

                if (!window.electron) {
                    toast.error('Bu özellik sadece masaüstü uygulamasında çalışır');
                    return;
                }

                try {
                    const result = await window.electron.showOpenDialog({
                        properties: ['openDirectory'],
                        buttonLabel: 'Klasörü Seç ve Kopyala',
                        title: 'Orijinal Kaynak Klasörünü Seçin'
                    });

                    if (!result.canceled && result.filePaths.length > 0) {
                        const sourcePath = result.filePaths[0];
                        const loadingId = toast.loading('Fotoğraflar kopyalanıyor...');

                        try {
                            const { data } = await woocommerceApi.copyPhotos({
                                archiveId: archive.id,
                                sourcePath
                            });

                            if (data.success) {
                                toast.success(data.message, { id: loadingId });
                            } else {
                                toast.error(data.message || 'Kopyalama başarısız', { id: loadingId });
                            }
                        } catch (retryErr) {
                            console.error('Retry error:', retryErr);
                            toast.error('İşlem başarısız', { id: loadingId });
                        }
                    }
                } catch (dialogErr) {
                    console.error('Dialog error:', dialogErr);
                }
                return;
            }

            console.error('Copy error:', err);
            toast.error(err.response?.data?.error || 'İşlem başarısız', { id: toastId });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Hidden file input for browser */}
            <input
                type="file"
                id="wc-file-input"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleBrowserFileSelect}
                className="hidden"
            />
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <Globe className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold">WooCommerce Entegrasyonu</h2>
                            <p className="text-sm text-muted-foreground">{archive?.fullName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Loading State */}
                    {view === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Yükleniyor...</p>
                        </div>
                    )}

                    {/* Empty State - No Link */}
                    {view === 'empty' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                                <Link2 className="w-8 h-8 text-purple-500" />
                            </div>
                            <h3 className="text-lg font-medium mb-2">Seçim Linki Oluştur</h3>
                            <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                                Fotoğrafları Firebase'e yükleyip WooCommerce'e aktararak müşterinizin online seçim yapmasını sağlayın.
                            </p>
                            <button
                                onClick={() => setView('upload')}
                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                                Fotoğraf Yükle
                            </button>
                        </div>
                    )}

                    {/* Dashboard State - Link Exists */}
                    {view === 'dashboard' && stats && (
                        <div className="space-y-6">
                            {/* Link Info Card */}
                            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/20">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Link2 className="w-4 h-4 text-purple-500" />
                                            <span className="text-sm font-medium">Seçim Linki</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                                                {stats.wcLink}
                                            </code>
                                            <button
                                                onClick={copyLink}
                                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                                            >
                                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span>🔑 Şifre: <strong className="text-foreground">{stats.wcPassword}</strong></span>
                                            <span>📅 {safeFormatDate(stats.wcUploadedAt)}</span>
                                            {stats.imageCount > 0 && <span>📷 {stats.imageCount} fotoğraf</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Stats */}
                            <div className="space-y-3">
                                <h4 className="font-medium flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" />
                                    Sipariş Durumu
                                </h4>

                                {stats.orders && stats.orders.length > 0 ? (
                                    <div className="space-y-2">
                                        {stats.orders.map((order, i) => (
                                            <div key={i} className="bg-muted/50 rounded-lg p-3 border">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium">Sipariş #{order.id}</span>
                                                    <span className={cn(
                                                        'text-xs px-2 py-0.5 rounded-full',
                                                        order.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                            order.status === 'processing' ? 'bg-blue-500/10 text-blue-500' :
                                                                'bg-yellow-500/10 text-yellow-500'
                                                    )}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {order.items.map((item, j) => (
                                                        <div key={j} className="flex justify-between">
                                                            <span>{item.name} x{item.quantity}</span>
                                                            <span>{item.total} ₺</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="text-right font-medium mt-1">
                                                    Toplam: {order.total} ₺
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        Henüz sipariş yok
                                    </div>
                                )}
                            </div>

                            {/* Copy Files Button */}
                            {stats.orders && stats.orders.length > 0 && (
                                <div className="bg-muted/30 rounded-lg p-4 border border-blue-500/20 mb-4">
                                    <h4 className="font-medium flex items-center gap-2 mb-2 text-blue-600">
                                        <FolderInput className="w-4 h-4" />
                                        Dosya İşlemleri
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Satın alınan fotoğrafları orijinal klasöründen "Online Seçilenler" klasörüne kopyalayabilirsiniz.
                                    </p>
                                    <button
                                        onClick={handleCopyPhotos}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium w-full transition-colors"
                                    >
                                        <FolderInput className="w-4 h-4" />
                                        Seçilen Fotoğrafları Kopyala
                                    </button>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                                <button
                                    onClick={() => sendWhatsApp('link')}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Link Gönder
                                </button>
                                <button
                                    onClick={() => sendWhatsApp('order')}
                                    disabled={!stats.orders?.length}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Check className="w-4 h-4" />
                                    Sipariş Onayı
                                </button>
                            </div>

                            <button
                                onClick={handleReset}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Linki ve Fotoğrafları Sıfırla
                            </button>
                        </div>
                    )}

                    {/* Upload State */}
                    {view === 'upload' && (
                        <div className="space-y-6">
                            {/* Mode Toggle */}
                            <div className="flex gap-2 p-1 bg-muted rounded-lg">
                                <button
                                    onClick={() => setUploadMode('single')}
                                    className={cn(
                                        'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                                        uploadMode === 'single' ? 'bg-card shadow' : 'hover:bg-background/50'
                                    )}
                                >
                                    Bireysel Çekim
                                </button>
                                <button
                                    onClick={() => setUploadMode('bulk')}
                                    className={cn(
                                        'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                                        uploadMode === 'bulk' ? 'bg-card shadow' : 'hover:bg-background/50'
                                    )}
                                >
                                    Toplu Çekim (Okul)
                                </button>
                            </div>

                            {/* File Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {uploadMode === 'single' ? 'Fotoğrafları Seç' : 'Ana Klasörü Seç'}
                                </label>
                                <button
                                    onClick={uploadMode === 'single' ? handleSelectFiles : handleSelectFolder}
                                    disabled={uploading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                                >
                                    <FolderOpen className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                        {selectedFiles.length > 0
                                            ? `${selectedFiles.length} dosya seçildi`
                                            : 'Tıklayarak seçin'}
                                    </span>
                                </button>
                            </div>

                            {/* Selected Files Preview */}
                            {selectedFiles.length > 0 && (
                                <div className="bg-muted/30 rounded-lg p-3 border">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Image className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Seçilen Dosyalar ({selectedFiles.length})</span>
                                    </div>
                                    <div className="max-h-24 overflow-y-auto text-xs text-muted-foreground space-y-1">
                                        {selectedFiles.slice(0, 5).map((file, i) => (
                                            <div key={i} className="truncate">
                                                {file instanceof File ? file.name : file.split(/[\\/]/).pop()}
                                            </div>
                                        ))}
                                        {selectedFiles.length > 5 && (
                                            <div className="text-primary">... ve {selectedFiles.length - 5} dosya daha</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Price List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Fiyat Listesi</label>
                                    <button
                                        onClick={addPriceRow}
                                        disabled={uploading}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Ekle
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {priceList.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={item.size}
                                                onChange={(e) => updatePriceRow(i, 'size', e.target.value)}
                                                placeholder="Ebat (örn: 10x15)"
                                                disabled={uploading}
                                                className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm disabled:opacity-50"
                                            />
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => updatePriceRow(i, 'price', e.target.value)}
                                                placeholder="Fiyat"
                                                disabled={uploading}
                                                className="w-24 px-3 py-2 bg-background border border-input rounded-lg text-sm disabled:opacity-50"
                                            />
                                            <span className="text-sm text-muted-foreground">₺</span>
                                            <button
                                                onClick={() => removePriceRow(i)}
                                                disabled={uploading}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Sayfa Şifresi</label>
                                <input
                                    type="text"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Müşteriye verilecek şifre"
                                    disabled={uploading}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg disabled:opacity-50"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Müşteri bu şifreyi girerek fotoğraflarını görebilecek
                                </p>
                            </div>

                            {/* Upload Progress */}
                            {uploading && (
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Yükleniyor...</span>
                                        <span className="text-sm text-muted-foreground">{uploadProgress.percent}%</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                                        <div
                                            className="bg-primary h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${uploadProgress.percent}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {uploadProgress.currentFile || `${uploadProgress.current} / ${uploadProgress.total} dosya`}
                                    </p>
                                </div>
                            )}

                            {/* Upload Button */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setView('empty')}
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || selectedFiles.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Yükleniyor...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Firebase'e Yükle
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
