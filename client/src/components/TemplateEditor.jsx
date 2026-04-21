/**
 * TemplateEditor — visual editor for print template layouts.
 *
 * Layout
 *   left (200px)   field palette + "add text/barcode" buttons
 *   center         canvas (page scaled at 2px/mm by default); absolute-positioned
 *                  elements are rendered and mutated via mousedown/move/up
 *   right (240px)  properties panel for the selected element
 *
 * State is intentionally small:
 *   - `elements` array (single source of truth for the layout)
 *   - `selectedId` (which element shows its props)
 *   - transient drag/resize state in a ref
 *
 * No undo stack, no multi-select, no grouping — all deferred to v2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    X, Save, RotateCcw, Eye, Download, Upload, Type, Barcode,
    Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Plus
} from 'lucide-react';
import {
    PLACEHOLDER_FIELDS,
    DEFAULT_PAGE_SIZES,
    blankTemplate,
    getCustomTemplate,
    saveCustomTemplate,
    deleteCustomTemplate,
    exportTemplates,
    importTemplates
} from '../lib/customTemplates';
import { renderCustomTemplate } from '../lib/customTemplateRenderer';

const TEMPLATE_LABELS = {
    receipt: 'Kayıt Fişi',
    smallEnvelope: 'Küçük Zarf',
    bigEnvelope: 'Büyük Zarf'
};

const SAMPLE_ARCHIVE = {
    archiveNumber: '12345',
    fullName: 'DEMO MÜŞTERİ',
    phone: '05551234567',
    email: 'demo@ornek.com',
    shootDate: new Date(),
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    size: '6 VS + 1 Albüm',
    photographer: 'Mehmet Demir',
    shootLocation: 'Stüdyo',
    shootType: 'Aile',
    totalAmount: 1500,
    paidAmount: 500,
    remainingAmount: 1000,
    notes: 'Örnek not',
    webPassword: 'ab12x'
};

const MM_TO_PX = 2;   // canvas zoom: 2px per mm is readable for A4-sized rows

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function newTextElement(pageWidth) {
    return {
        id: newId(),
        type: 'text',
        x: 5,
        y: 5,
        width: Math.min(80, pageWidth - 10),
        height: 8,
        content: 'Yeni metin',
        fontSize: 10,
        bold: false,
        align: 'left'
    };
}

function newBarcodeElement(pageWidth) {
    return {
        id: newId(),
        type: 'barcode',
        x: Math.max(5, pageWidth - 65),
        y: 5,
        width: 60,
        height: 18,
        field: 'archiveNumber'
    };
}

/**
 * Resolve placeholders for the canvas preview only. Uses the "example" from
 * PLACEHOLDER_FIELDS so editor labels are legible at 2px/mm without running
 * the full archive formatter.
 */
function previewResolve(content) {
    if (!content) return '';
    return String(content).replace(/\[([a-zA-Z0-9_]+)\]/g, (m, key) => {
        const f = PLACEHOLDER_FIELDS.find(p => p.key === key);
        return f ? f.example : '';
    });
}

export default function TemplateEditor({ open, onClose, templateType }) {
    const pageSize = DEFAULT_PAGE_SIZES[templateType] || { width: 200, height: 65 };
    const [name, setName] = useState('Özel Şablon');
    const [elements, setElements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const canvasRef = useRef(null);
    const dragStateRef = useRef(null);
    const fileInputRef = useRef(null);

    // Load existing custom template on open, else start from a blank layout.
    useEffect(() => {
        if (!open) return;
        const existing = getCustomTemplate(templateType);
        if (existing) {
            setName(existing.name || 'Özel Şablon');
            setElements(existing.elements || []);
        } else {
            const blank = blankTemplate(templateType);
            setName(blank.name);
            setElements([]);
        }
        setSelectedId(null);
        setPreviewOpen(false);
    }, [open, templateType]);

    const selected = useMemo(
        () => elements.find(el => el.id === selectedId) || null,
        [elements, selectedId]
    );

    // ---- mutate helpers ------------------------------------------------------

    const patchElement = useCallback((id, patch) => {
        setElements(prev => prev.map(el => {
            if (el.id !== id) return el;
            const next = { ...el, ...patch };
            // clamp to page bounds
            next.width = clamp(next.width, 1, pageSize.width);
            next.height = clamp(next.height, 1, pageSize.height);
            next.x = clamp(next.x, 0, pageSize.width - next.width);
            next.y = clamp(next.y, 0, pageSize.height - next.height);
            return next;
        }));
    }, [pageSize.width, pageSize.height]);

    const deleteElement = useCallback((id) => {
        setElements(prev => prev.filter(el => el.id !== id));
        setSelectedId(s => (s === id ? null : s));
    }, []);

    const addElement = useCallback((el) => {
        setElements(prev => [...prev, el]);
        setSelectedId(el.id);
    }, []);

    // ---- drag / resize (mousedown/move/up) -----------------------------------
    //
    // On mousedown we capture starting mouse position + element geometry into a
    // ref (so state updates don't tear the drag). Window-level mousemove/mouseup
    // listeners run while a drag is active and clear themselves on release.

    const onElementMouseDown = (e, el, mode) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedId(el.id);
        const startX = e.clientX;
        const startY = e.clientY;
        dragStateRef.current = {
            id: el.id,
            mode, // 'move' | 'resize'
            startX,
            startY,
            orig: { x: el.x, y: el.y, width: el.width, height: el.height }
        };
        window.addEventListener('mousemove', onWindowMouseMove);
        window.addEventListener('mouseup', onWindowMouseUp);
    };

    const onWindowMouseMove = useCallback((e) => {
        const st = dragStateRef.current;
        if (!st) return;
        const dxPx = e.clientX - st.startX;
        const dyPx = e.clientY - st.startY;
        const dx = dxPx / MM_TO_PX;
        const dy = dyPx / MM_TO_PX;

        setElements(prev => prev.map(el => {
            if (el.id !== st.id) return el;
            if (st.mode === 'move') {
                const nx = clamp(st.orig.x + dx, 0, pageSize.width - el.width);
                const ny = clamp(st.orig.y + dy, 0, pageSize.height - el.height);
                return { ...el, x: nx, y: ny };
            }
            // resize (bottom-right handle)
            const nw = clamp(st.orig.width + dx, 4, pageSize.width - el.x);
            const nh = clamp(st.orig.height + dy, 4, pageSize.height - el.y);
            return { ...el, width: nw, height: nh };
        }));
    }, [pageSize.width, pageSize.height]);

    const onWindowMouseUp = useCallback(() => {
        dragStateRef.current = null;
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
    }, [onWindowMouseMove]);

    // Cleanup listeners on unmount so stale refs don't leak if the modal closes
    // mid-drag.
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', onWindowMouseMove);
            window.removeEventListener('mouseup', onWindowMouseUp);
        };
    }, [onWindowMouseMove, onWindowMouseUp]);

    // ---- toolbar actions -----------------------------------------------------

    const handleSave = () => {
        const tpl = {
            type: templateType,
            name: name || 'Özel Şablon',
            pageWidth: pageSize.width,
            pageHeight: pageSize.height,
            elements
        };
        const ok = saveCustomTemplate(templateType, tpl);
        if (ok) {
            toast.success(`${TEMPLATE_LABELS[templateType]}: özel şablon kaydedildi`);
            onClose?.();
        } else {
            toast.error('Şablon kaydedilemedi (geçersiz yapı)');
        }
    };

    const handleReset = () => {
        if (!confirm('Özel şablon silinecek ve varsayılan düzen geri yüklenecek. Emin misiniz?')) return;
        deleteCustomTemplate(templateType);
        setElements([]);
        setSelectedId(null);
        setName('Özel Şablon');
        toast.success('Varsayılan şablona dönüldü');
    };

    const handlePreview = () => {
        try {
            const tpl = {
                type: templateType,
                name,
                pageWidth: pageSize.width,
                pageHeight: pageSize.height,
                elements
            };
            const html = renderCustomTemplate(tpl, SAMPLE_ARCHIVE);
            setPreviewHtml(html);
            setPreviewOpen(true);
        } catch (e) {
            toast.error('Önizleme oluşturulamadı: ' + (e?.message || e));
        }
    };

    const handleExport = () => {
        const json = exportTemplates();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyo-templates-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Şablonlar dışa aktarıldı');
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const res = importTemplates(text);
            if (res.success) {
                toast.success(`İçe aktarıldı: ${res.imported.join(', ')}`);
                const reloaded = getCustomTemplate(templateType);
                if (reloaded) {
                    setName(reloaded.name);
                    setElements(reloaded.elements);
                    setSelectedId(null);
                }
            } else {
                toast.error('İçe aktarma başarısız: ' + (res.errors.join('; ') || 'bilinmeyen hata'));
            }
        } catch (err) {
            toast.error('Dosya okunamadı: ' + (err?.message || err));
        }
    };

    // ---- field palette -------------------------------------------------------

    const insertPlaceholder = (fieldKey) => {
        if (!selected || selected.type !== 'text') {
            // No text element selected — create a new text element with the placeholder.
            const el = newTextElement(pageSize.width);
            el.content = `[${fieldKey}]`;
            addElement(el);
            return;
        }
        patchElement(selected.id, {
            content: (selected.content || '') + `[${fieldKey}]`
        });
    };

    if (!open) return null;

    // ---- render --------------------------------------------------------------

    const canvasWidth = pageSize.width * MM_TO_PX;
    const canvasHeight = pageSize.height * MM_TO_PX;

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-editor-title"
        >
            {/* Top toolbar */}
            <div className="flex items-center gap-3 p-3 border-b border-border bg-card">
                <div className="flex-1 flex items-center gap-3 min-w-0">
                    <h2 id="template-editor-title" className="text-base font-semibold whitespace-nowrap">
                        Şablon Düzenleyici — {TEMPLATE_LABELS[templateType]}
                    </h2>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Şablon adı"
                        className="px-3 py-1.5 rounded-lg bg-background border border-input text-sm w-56"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {pageSize.width} × {pageSize.height} mm
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={handlePreview} className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Önizleme
                    </button>
                    <button type="button" onClick={handleExport} className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Dışa Aktar
                    </button>
                    <button type="button" onClick={handleImportClick} className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> İçe Aktar
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
                    <button type="button" onClick={handleReset} className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
                    </button>
                    <button type="button" onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm flex items-center gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Kaydet
                    </button>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg" aria-label="Kapat">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar — field palette */}
                <aside className="w-[200px] border-r border-border bg-card overflow-y-auto p-3 space-y-3">
                    <div>
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Öğe Ekle</h3>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => addElement(newTextElement(pageSize.width))}
                                className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-2"
                            >
                                <Type className="w-3.5 h-3.5" /> Metin Ekle
                            </button>
                            <button
                                type="button"
                                onClick={() => addElement(newBarcodeElement(pageSize.width))}
                                className="px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm flex items-center gap-2"
                            >
                                <Barcode className="w-3.5 h-3.5" /> Barkod Ekle
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Alanlar</h3>
                        <p className="text-[11px] text-muted-foreground mb-2">
                            Bir alana tıklayın — seçili metne eklenir, yoksa yeni metin oluşturulur.
                        </p>
                        <div className="flex flex-col gap-1">
                            {PLACEHOLDER_FIELDS.map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => insertPlaceholder(f.key)}
                                    className="text-left px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted text-xs flex items-center gap-1.5"
                                    title={`[${f.key}] — ${f.example}`}
                                >
                                    <Plus className="w-3 h-3 flex-shrink-0 opacity-60" />
                                    <span className="truncate">{f.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Center — canvas */}
                <main className="flex-1 overflow-auto bg-muted/30 p-8 flex items-start justify-center">
                    <div
                        ref={canvasRef}
                        className="relative bg-white shadow-xl"
                        style={{
                            width: `${canvasWidth}px`,
                            height: `${canvasHeight}px`,
                            outline: '1px solid rgba(0,0,0,0.15)'
                        }}
                        onMouseDown={() => setSelectedId(null)}
                    >
                        {/* ruler grid — light 10mm lines for alignment */}
                        <div
                            aria-hidden
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage:
                                    `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                                     linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`,
                                backgroundSize: `${10 * MM_TO_PX}px ${10 * MM_TO_PX}px`
                            }}
                        />
                        {elements.map(el => {
                            const isSelected = el.id === selectedId;
                            const style = {
                                position: 'absolute',
                                left: `${el.x * MM_TO_PX}px`,
                                top: `${el.y * MM_TO_PX}px`,
                                width: `${el.width * MM_TO_PX}px`,
                                height: `${el.height * MM_TO_PX}px`,
                                border: isSelected ? '2px solid rgb(59, 130, 246)' : '1px dashed rgba(0,0,0,0.2)',
                                background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                cursor: 'move',
                                userSelect: 'none',
                                overflow: 'hidden',
                                boxSizing: 'border-box'
                            };
                            const innerStyle = el.type === 'text' ? {
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                                fontSize: `${(el.fontSize || 10) * (MM_TO_PX * 0.353)}px`,
                                fontWeight: el.bold ? 700 : 400,
                                textAlign: el.align || 'left',
                                padding: '1px 2px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                lineHeight: 1.15,
                                color: '#111'
                            } : {};
                            return (
                                <div
                                    key={el.id}
                                    style={style}
                                    onMouseDown={(e) => onElementMouseDown(e, el, 'move')}
                                    onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                                >
                                    {el.type === 'text' ? (
                                        <div style={innerStyle}>{previewResolve(el.content) || <span style={{ opacity: 0.4 }}>(boş)</span>}</div>
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px)',
                                            color: '#fff', fontSize: 10, fontWeight: 600
                                        }}>
                                            BARKOD [{el.field}]
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div
                                            onMouseDown={(e) => onElementMouseDown(e, el, 'resize')}
                                            style={{
                                                position: 'absolute',
                                                right: -5, bottom: -5,
                                                width: 10, height: 10,
                                                background: 'rgb(59, 130, 246)',
                                                borderRadius: 2,
                                                cursor: 'nwse-resize'
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>

                {/* Right sidebar — properties */}
                <aside className="w-[240px] border-l border-border bg-card overflow-y-auto p-3 space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">Özellikler</h3>
                    {!selected && (
                        <p className="text-xs text-muted-foreground">
                            Düzenlemek için bir öğe seçin veya soldan yeni bir öğe ekleyin.
                        </p>
                    )}
                    {selected && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">
                                    {selected.type === 'text' ? 'Metin' : 'Barkod'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => deleteElement(selected.id)}
                                    className="p-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600"
                                    aria-label="Öğeyi sil"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <LabeledNumber label="X (mm)" value={selected.x} onChange={v => patchElement(selected.id, { x: v })} />
                                <LabeledNumber label="Y (mm)" value={selected.y} onChange={v => patchElement(selected.id, { y: v })} />
                                <LabeledNumber label="Genişlik" value={selected.width} onChange={v => patchElement(selected.id, { width: v })} />
                                <LabeledNumber label="Yükseklik" value={selected.height} onChange={v => patchElement(selected.id, { height: v })} />
                            </div>

                            {selected.type === 'text' && (
                                <>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">İçerik</label>
                                        <textarea
                                            value={selected.content}
                                            onChange={e => patchElement(selected.id, { content: e.target.value })}
                                            rows={4}
                                            className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs font-mono"
                                            placeholder="Metin veya [fullName]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Alan Ekle</label>
                                        <select
                                            value=""
                                            onChange={e => {
                                                const key = e.target.value;
                                                if (!key) return;
                                                patchElement(selected.id, { content: (selected.content || '') + `[${key}]` });
                                                e.target.value = '';
                                            }}
                                            className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs"
                                        >
                                            <option value="">— Seç —</option>
                                            {PLACEHOLDER_FIELDS.map(f => (
                                                <option key={f.key} value={f.key}>{f.label} [{f.key}]</option>
                                            ))}
                                        </select>
                                    </div>
                                    <LabeledNumber label="Yazı boyutu (pt)" value={selected.fontSize} onChange={v => patchElement(selected.id, { fontSize: v })} />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => patchElement(selected.id, { bold: !selected.bold })}
                                            className={`p-2 rounded-md border ${selected.bold ? 'bg-primary text-primary-foreground border-primary' : 'border-input bg-background hover:bg-muted'}`}
                                            aria-label="Kalın"
                                        >
                                            <Bold className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="flex items-center rounded-md border border-input bg-background overflow-hidden">
                                            {[
                                                { k: 'left', Icon: AlignLeft },
                                                { k: 'center', Icon: AlignCenter },
                                                { k: 'right', Icon: AlignRight }
                                            ].map(({ k, Icon }) => (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => patchElement(selected.id, { align: k })}
                                                    className={`p-2 ${selected.align === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                                                    aria-label={`Hizala ${k}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {selected.type === 'barcode' && (
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Veri alanı</label>
                                    <select
                                        value={selected.field}
                                        onChange={e => patchElement(selected.id, { field: e.target.value })}
                                        className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs"
                                    >
                                        {PLACEHOLDER_FIELDS.map(f => (
                                            <option key={f.key} value={f.key}>{f.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Code 39 barkod — yalnızca A-Z, 0-9 ve birkaç sembol desteklenir.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>

            {/* Preview overlay */}
            {previewOpen && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 z-10" onClick={() => setPreviewOpen(false)}>
                    <div className="bg-white rounded-lg shadow-2xl max-w-[95vw] max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-3 border-b border-border">
                            <span className="text-sm font-semibold text-foreground">Önizleme — Örnek Veri</span>
                            <button onClick={() => setPreviewOpen(false)} className="p-1.5 hover:bg-muted rounded-md" aria-label="Kapat">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <iframe
                            title="Şablon Önizleme"
                            srcDoc={previewHtml}
                            style={{
                                width: `${pageSize.width * 3}px`,
                                height: `${pageSize.height * 3}px`,
                                border: 0,
                                maxWidth: '90vw',
                                maxHeight: '80vh'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function LabeledNumber({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="block text-[11px] text-muted-foreground mb-0.5">{label}</span>
            <input
                type="number"
                step="0.5"
                value={Number.isFinite(value) ? Number(value.toFixed?.(2) ?? value) : 0}
                onChange={e => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) onChange(n);
                }}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs"
            />
        </label>
    );
}
