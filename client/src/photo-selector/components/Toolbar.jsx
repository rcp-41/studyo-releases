import { useTranslation } from 'react-i18next';
import usePhotoSelectorStore from '../stores/photoSelectorStore';
import {
    Grid3X3, Image, Columns2, Star, ListOrdered, Undo2, Redo2,
    Save, Minus, Plus, ArrowLeft, Check
} from 'lucide-react';

export default function Toolbar({ onOpenSelection: _onOpenSelection, onSaveAndClose, onSaveNumbering, onBack }) {
    const { t } = useTranslation();
    const currentView = usePhotoSelectorStore(s => s.currentView);
    const setView = usePhotoSelectorStore(s => s.setView);
    const filterMode = usePhotoSelectorStore(s => s.filterMode);
    const setFilterMode = usePhotoSelectorStore(s => s.setFilterMode);
    const gridColumns = usePhotoSelectorStore(s => s.gridColumns);
    const setGridColumns = usePhotoSelectorStore(s => s.setGridColumns);
    const undo = usePhotoSelectorStore(s => s.undo);
    const redo = usePhotoSelectorStore(s => s.redo);
    const undoStack = usePhotoSelectorStore(s => s.undoStack);
    const redoStack = usePhotoSelectorStore(s => s.redoStack);
    const archiveInfo = usePhotoSelectorStore(s => s.archiveInfo);
    const thumbnailProgress = usePhotoSelectorStore(s => s.thumbnailProgress);
    const operationMode = usePhotoSelectorStore(s => s.operationMode);

    const isGenerating = thumbnailProgress.total > 0 && thumbnailProgress.done < thumbnailProgress.total;

    const saveButtonLabel = operationMode === 'archive_new' ? t('photoSelector.toolbar.completeRecord')
        : operationMode === 'archive_existing' ? t('photoSelector.toolbar.updateArchive')
            : t('photoSelector.toolbar.saveAndClose');

    return (
        <div className="ps-toolbar">
            {/* Left: Back + Title + Archive info */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    title={t('photoSelector.toolbar.back')}
                    className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-200
                               hover:bg-neutral-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-neutral-700" />
                <h1 className="text-sm font-semibold text-neutral-300">
                    {archiveInfo?.archiveNo
                        ? `#${archiveInfo.archiveNo}`
                        : 'Pixonai'}
                    {archiveInfo?.customerName && (
                        <span className="ml-2 text-neutral-500 font-normal">
                            — {archiveInfo.customerName}
                        </span>
                    )}
                </h1>

                {isGenerating && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                style={{ width: `${(thumbnailProgress.done / thumbnailProgress.total) * 100}%` }}
                            />
                        </div>
                        <span>{thumbnailProgress.done}/{thumbnailProgress.total}</span>
                    </div>
                )}
            </div>

            {/* Center: View mode + Filter */}
            <div className="flex items-center gap-1">
                {/* View buttons */}
                <div className="flex items-center gap-0.5 bg-neutral-800 rounded-lg p-0.5">
                    <ToolbarBtn
                        icon={Grid3X3}
                        active={currentView === 'grid'}
                        onClick={() => setView('grid')}
                        title={t('photoSelector.toolbar.gridView')}
                    />
                    <ToolbarBtn
                        icon={Image}
                        active={currentView === 'single'}
                        onClick={() => setView('single')}
                        title={t('photoSelector.toolbar.singleView')}
                    />
                    <ToolbarBtn
                        icon={Columns2}
                        active={currentView === 'compare'}
                        onClick={() => setView('compare')}
                        title={t('photoSelector.toolbar.compareView')}
                    />
                </div>

                <div className="w-px h-6 bg-neutral-700 mx-2" />

                {/* Filter buttons */}
                <div className="flex items-center gap-0.5 bg-neutral-800 rounded-lg p-0.5">
                    {['all', 'favorites', 'unfavorited', 'numbered'].map((mode) => {
                        const filterLabelMap = {
                            all: t('photoSelector.toolbar.filters.all'),
                            favorites: t('photoSelector.toolbar.filters.favorites'),
                            unfavorited: t('photoSelector.toolbar.filters.unfavorited'),
                            numbered: t('photoSelector.toolbar.filters.numbered'),
                        };
                        return (
                        <button
                            key={mode}
                            onClick={() => setFilterMode(mode)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filterMode === mode
                                ? 'bg-amber-500 text-neutral-900 font-medium'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                                }`}
                        >
                            {mode === 'favorites' && <Star className="w-3 h-3 inline mr-1" />}
                            {mode === 'numbered' && <ListOrdered className="w-3 h-3 inline mr-1" />}
                            {filterLabelMap[mode]}
                        </button>
                    );
                    })}
                </div>

                {/* Grid column size (only in grid view) */}
                {currentView === 'grid' && (
                    <>
                        <div className="w-px h-6 bg-neutral-700 mx-2" />
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setGridColumns(Math.max(3, gridColumns - 1))}
                                className="p-1 text-neutral-400 hover:text-neutral-200 rounded"
                                title={t('photoSelector.toolbar.decreaseColumns')}
                            >
                                <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-neutral-500 w-4 text-center">{gridColumns}</span>
                            <button
                                onClick={() => setGridColumns(Math.min(10, gridColumns + 1))}
                                className="p-1 text-neutral-400 hover:text-neutral-200 rounded"
                                title={t('photoSelector.toolbar.increaseColumns')}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
                <ToolbarBtn
                    icon={Undo2}
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    title={t('photoSelector.toolbar.undo')}
                />
                <ToolbarBtn
                    icon={Redo2}
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    title={t('photoSelector.toolbar.redo')}
                />


                {/* Save (keeps window open) */}
                <button
                    onClick={onSaveNumbering}
                    title={t('photoSelector.toolbar.save')}
                    className="px-3 py-1.5 text-xs bg-neutral-700 text-neutral-200
                               hover:bg-neutral-600 rounded-lg transition-colors font-medium
                               flex items-center gap-1.5"
                >
                    <Save className="w-3.5 h-3.5" />
                    {t('photoSelector.toolbar.save')}
                </button>
                {/* Finalize: update archive + send result + close */}
                <button
                    onClick={onSaveAndClose}
                    className="px-3 py-1.5 text-xs bg-amber-500 text-neutral-900
                               hover:bg-amber-400 rounded-lg transition-colors font-medium
                               flex items-center gap-1.5"
                >
                    <Check className="w-3.5 h-3.5" />
                    {saveButtonLabel}
                </button>
            </div>
        </div>
    );
}

function ToolbarBtn({ icon: Icon, active, onClick, disabled, title }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1.5 rounded-md transition-colors ${active
                ? 'bg-amber-500 text-neutral-900'
                : disabled
                    ? 'text-neutral-600 cursor-not-allowed'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
                }`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
