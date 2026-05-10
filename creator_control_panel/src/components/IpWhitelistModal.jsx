import { useState } from 'react';
import { X, Shield, Plus, Trash2, Loader2 } from 'lucide-react';
import { creatorApi } from '../services/creatorApi';
import toast from 'react-hot-toast';

// Validate CIDR (e.g. 192.168.1.0/24) or plain IPv4 (e.g. 192.168.1.1)
function isValidEntry(val) {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2]\d|3[0-2]))?$/;
    if (!cidrRegex.test(val)) return false;
    const parts = val.split('/')[0].split('.');
    return parts.every(p => parseInt(p, 10) <= 255);
}

export default function IpWhitelistModal({ studio, onClose }) {
    const initial = studio.security?.ipWhitelist || [];
    const [list, setList] = useState([...initial]);
    const [input, setInput] = useState('');
    const [inputError, setInputError] = useState('');
    const [saving, setSaving] = useState(false);

    function handleAdd() {
        const trimmed = input.trim();
        if (!trimmed) return;
        if (!isValidEntry(trimmed)) {
            setInputError('Geçersiz CIDR/IPv4. Örn: 192.168.1.0/24 veya 10.0.0.5');
            return;
        }
        if (list.includes(trimmed)) {
            setInputError('Bu giriş zaten listede');
            return;
        }
        setList(p => [...p, trimmed]);
        setInput('');
        setInputError('');
    }

    function handleRemove(entry) {
        setList(p => p.filter(x => x !== entry));
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            await creatorApi.updateIpWhitelist(studio.organizationId, studio.id, list);
            toast.success('IP Whitelist güncellendi');
            onClose();
        } catch (err) {
            toast.error('Kaydetme hatası: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={18} /> IP Whitelist — {studio.info?.name}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Liste boş ise tüm IP'lere izin verilir. CIDR notasyonu veya tekil IPv4 girin.
                    </p>

                    {/* Add input */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Örn: 192.168.1.0/24"
                            value={input}
                            onChange={e => { setInput(e.target.value); setInputError(''); }}
                            onKeyDown={handleKeyDown}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{ whiteSpace: 'nowrap' }}>
                            <Plus size={14} /> Ekle
                        </button>
                    </div>
                    {inputError && (
                        <p style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{inputError}</p>
                    )}

                    {/* List */}
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {list.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                                Liste boş — tüm IP'lere izin verilir.
                            </p>
                        ) : list.map(entry => (
                            <div key={entry} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', background: 'var(--bg-secondary)',
                                borderRadius: '6px', border: '1px solid var(--border-color)'
                            }}>
                                <code style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{entry}</code>
                                <button
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 8px' }}
                                    onClick={() => handleRemove(entry)}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}
