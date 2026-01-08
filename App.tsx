import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NBTParser, NBTWriter } from './utils/nbtParser';
import { NBTFile, NBTTag, TagType } from './types';
import { NBTNode } from './components/NBTNode';
import { deleteNodesByPaths, flattenTree, cloneTag } from './utils/treeUtils';
import { 
    FileUp, Save, X, Box, Search, 
    ChevronsDown, ChevronsUp, FolderOpen, FolderClosed, 
    Trash2, RotateCcw, RotateCw, CheckSquare, Square, Info
} from 'lucide-react';

type ExpandSignal = {
    id: number;
    type: 'expand_all' | 'collapse_all' | 'expand_selected' | 'collapse_selected';
    targets?: Set<string>;
};

const App: React.FC = () => {
  const [files, setFiles] = useState<NBTFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection State
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastClickedPath, setLastClickedPath] = useState<string | null>(null);
  
  // Expansion Signal
  const [expandSignal, setExpandSignal] = useState<ExpandSignal>({ id: 0, type: 'expand_all' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFile = files.find(f => f.id === activeFileId);

  // --- History Management ---
  const pushHistory = (fileId: string, newRoot: NBTTag) => {
      setFiles(prev => prev.map(f => {
          if (f.id !== fileId) return f;
          const newUndo = [...f.undoStack, cloneTag(f.root)].slice(-50); // Limit 50 steps
          return { ...f, root: newRoot, isModified: true, undoStack: newUndo, redoStack: [] };
      }));
  };

  const handleUndo = useCallback(() => {
      if (!activeFile || activeFile.undoStack.length === 0) return;
      const prevRoot = activeFile.undoStack[activeFile.undoStack.length - 1];
      const newUndo = activeFile.undoStack.slice(0, -1);
      const newRedo = [...activeFile.redoStack, cloneTag(activeFile.root)];
      
      setFiles(prev => prev.map(f => f.id === activeFile.id ? {
          ...f, root: prevRoot, undoStack: newUndo, redoStack: newRedo, isModified: true
      } : f));
  }, [activeFile]);

  const handleRedo = useCallback(() => {
      if (!activeFile || activeFile.redoStack.length === 0) return;
      const nextRoot = activeFile.redoStack[activeFile.redoStack.length - 1];
      const newRedo = activeFile.redoStack.slice(0, -1);
      const newUndo = [...activeFile.undoStack, cloneTag(activeFile.root)];

      setFiles(prev => prev.map(f => f.id === activeFile.id ? {
          ...f, root: nextRoot, undoStack: newUndo, redoStack: newRedo, isModified: true
      } : f));
  }, [activeFile]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) handleRedo();
              else handleUndo();
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              handleRedo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // --- File Operations ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: NBTFile[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        try {
          const { root, isCompressed } = await NBTParser.parse(file);
          newFiles.push({
            id: crypto.randomUUID(),
            filename: file.name,
            root,
            isCompressed,
            isModified: false,
            undoStack: [],
            redoStack: []
          });
        } catch (err) {
          console.error(err);
          alert(`無法解析 ${file.name}`);
        }
      }
      setFiles(prev => [...prev, ...newFiles]);
      if (newFiles.length > 0 && !activeFileId) setActiveFileId(newFiles[0].id);
    }
  };

  const handleSaveFile = (file: NBTFile) => {
    try {
        const bytes = NBTWriter.write(file.root, file.isCompressed);
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFiles(files.map(f => f.id === file.id ? { ...f, isModified: false } : f));
    } catch (e) { console.error(e); alert("存檔失敗"); }
  };

  const closeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (activeFileId === id) setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
  };

  const updateActiveFileRoot = (newRoot: NBTTag) => {
      if (!activeFileId) return;
      pushHistory(activeFileId, newRoot);
  };

  // --- Selection Logic ---
  const handleSelect = (path: string, type: 'single' | 'toggle' | 'range') => {
      if (type === 'single') {
          setSelectedPaths(new Set([path]));
          setLastClickedPath(path);
      } else if (type === 'toggle') {
          const newSet = new Set(selectedPaths);
          if (newSet.has(path)) newSet.delete(path);
          else newSet.add(path);
          setSelectedPaths(newSet);
          setLastClickedPath(path);
      } else if (type === 'range' && activeFile && lastClickedPath) {
          // Flatten tree to find range
          const allPaths = flattenTree(activeFile.root);
          const startIdx = allPaths.indexOf(lastClickedPath);
          const endIdx = allPaths.indexOf(path);
          
          if (startIdx !== -1 && endIdx !== -1) {
              const min = Math.min(startIdx, endIdx);
              const max = Math.max(startIdx, endIdx);
              const range = allPaths.slice(min, max + 1);
              const newSet = new Set(selectedPaths);
              range.forEach(p => newSet.add(p));
              setSelectedPaths(newSet);
          }
      }
  };

  // --- Bulk Actions ---
  const triggerExpand = (type: ExpandSignal['type']) => {
      setExpandSignal({ id: Date.now(), type, targets: selectedPaths });
  };

  const deleteSelected = () => {
      if (!activeFile || selectedPaths.size === 0) return;
      if (!confirm(`確定刪除 ${selectedPaths.size} 個項目?`)) return;
      
      const newRoot = deleteNodesByPaths(activeFile.root, selectedPaths);
      updateActiveFileRoot(newRoot);
      setSelectedPaths(new Set());
  };

  const invertSelection = () => {
      if (!activeFile) return;
      const allPaths = flattenTree(activeFile.root);
      const newSet = new Set<string>();
      allPaths.forEach(p => {
          if (p !== 'root' && !selectedPaths.has(p)) newSet.add(p);
      });
      setSelectedPaths(newSet);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 font-sans">
      {/* Header */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between select-none shrink-0 z-20">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-bold text-blue-400 text-lg">
                <Box className="w-6 h-6" />
                <span>NBT Studio Web</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 rounded border border-blue-500/30 font-mono tracking-wide transform -translate-y-0.5">BETA</span>
            </div>
            <div className="h-8 w-px bg-gray-700 mx-2"></div>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded hover:bg-gray-800">
                <FileUp size={18} /> 開啟
            </button>
            <button onClick={() => activeFile && handleSaveFile(activeFile)} disabled={!activeFile} className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${!activeFile ? 'text-gray-600' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}>
                <Save size={18} /> 儲存
            </button>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>
        
        {activeFile && (
            <div className="flex-1 max-w-md mx-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input type="text" placeholder="搜尋..." className="w-full bg-gray-950 border border-gray-700 rounded-md py-1.5 pl-10 pr-4 text-sm text-gray-200 focus:border-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        )}

        <a 
          href="https://home.barian.moe/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          <Info size={18} />
          <span className="hidden sm:inline">關於作者</span>
        </a>
      </header>

      {/* Tabs */}
      <div className="flex bg-gray-900 overflow-x-auto border-b border-gray-800 scrollbar-hide shrink-0">
        {files.map(file => (
            <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`group flex items-center min-w-[120px] max-w-[200px] px-3 py-2 text-sm border-r border-gray-800 cursor-pointer ${activeFileId === file.id ? 'bg-gray-800 text-white border-t-2 border-t-blue-500' : 'bg-gray-900 text-gray-500 hover:bg-gray-850'}`}>
                <span className="truncate flex-1">{file.filename}</span>
                {file.isModified && <div className="w-2 h-2 rounded-full bg-blue-500 ml-2"></div>}
                <button onClick={(e) => closeFile(e, file.id)} className="ml-2 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-700 rounded text-gray-400"><X size={12} /></button>
            </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Vertical Sidebar */}
        {activeFile && (
            <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-2 shrink-0 overflow-y-auto scrollbar-hide">
                <SidebarBtn icon={<ChevronsDown size={20} />} title="全部展開" onClick={() => triggerExpand('expand_all')} />
                <SidebarBtn icon={<ChevronsUp size={20} />} title="全部摺疊" onClick={() => triggerExpand('collapse_all')} />
                <div className="w-6 h-px bg-gray-700 my-1"></div>
                <SidebarBtn icon={<RotateCcw size={20} />} title="復原 (Ctrl+Z)" onClick={handleUndo} disabled={activeFile.undoStack.length === 0} />
                <SidebarBtn icon={<RotateCw size={20} />} title="重做 (Ctrl+Y)" onClick={handleRedo} disabled={activeFile.redoStack.length === 0} />
                <div className="w-6 h-px bg-gray-700 my-1"></div>
                {/* Selection Actions */}
                <SidebarBtn icon={<FolderOpen size={20} />} title="展開選中" onClick={() => triggerExpand('expand_selected')} disabled={selectedPaths.size === 0} />
                <SidebarBtn icon={<FolderClosed size={20} />} title="摺疊選中" onClick={() => triggerExpand('collapse_selected')} disabled={selectedPaths.size === 0} />
                <SidebarBtn icon={<Trash2 size={20} />} title="刪除選中" onClick={deleteSelected} disabled={selectedPaths.size === 0} danger />
                <div className="w-6 h-px bg-gray-700 my-1"></div>
                <SidebarBtn icon={<CheckSquare size={20} />} title="反轉選取" onClick={invertSelection} />
                <SidebarBtn icon={<Square size={20} />} title="取消選取" onClick={() => setSelectedPaths(new Set())} disabled={selectedPaths.size === 0} />
            </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 bg-gray-950 overflow-auto p-4 relative" onClick={() => setSelectedPaths(new Set())}>
            {activeFile ? (
                <div className="min-w-fit pb-20">
                    <NBTNode 
                        tag={activeFile.root} depth={0} path="root"
                        onUpdate={(newRoot) => updateActiveFileRoot(newRoot)}
                        onDelete={() => { if(confirm("無法刪除根目錄。")) closeFile(React.MouseEvent as any, activeFile.id); }}
                        onAdd={() => {}}
                        searchTerm={searchTerm}
                        selectedPaths={selectedPaths}
                        onSelect={handleSelect}
                        expandSignal={expandSignal}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                    <Box size={64} className="mb-4 opacity-20" />
                    <h2 className="text-xl font-medium mb-2">未選擇檔案</h2>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded shadow-lg mt-4">開啟檔案</button>
                </div>
            )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="h-6 bg-gray-900 border-t border-gray-800 flex items-center justify-end px-4 text-[10px] text-gray-500 select-none shrink-0 z-20 font-mono">
        <span>由幽影櫻製作 by barian</span>
      </footer>
    </div>
  );
};

const SidebarBtn: React.FC<{ icon: React.ReactNode, title: string, onClick: () => void, disabled?: boolean, danger?: boolean }> = ({ icon, title, onClick, disabled, danger }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={disabled}
        title={title}
        className={`
            p-2 rounded-md transition-all
            ${disabled ? 'text-gray-700 cursor-not-allowed' : 
              danger ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300' : 
              'text-gray-400 hover:bg-gray-800 hover:text-blue-400'}
        `}
    >
        {icon}
    </button>
);

export default App;