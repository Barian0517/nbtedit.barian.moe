import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TagType, NBTTag, TagTypeNames } from '../types';
import { ChevronRight, ChevronDown, Edit2, Trash, Plus } from 'lucide-react';

interface NBTNodeProps {
  tag: NBTTag;
  depth: number;
  onUpdate: (updatedTag: NBTTag) => void;
  onDelete: () => void;
  onAdd: (parentType: TagType) => void;
  path: string;
  searchTerm: string;
  // New Props
  selectedPaths: Set<string>;
  onSelect: (path: string, type: 'single' | 'toggle' | 'range') => void;
  expandSignal: { id: number; type: 'expand_all' | 'collapse_all' | 'expand_selected' | 'collapse_selected'; targets?: Set<string> };
}

const getTypeColor = (type: TagType) => {
  switch (type) {
    case TagType.Byte: return 'text-nbt-byte';
    case TagType.Short: return 'text-nbt-short';
    case TagType.Int: return 'text-nbt-int';
    case TagType.Long: return 'text-nbt-long';
    case TagType.Float: return 'text-nbt-float';
    case TagType.Double: return 'text-nbt-double';
    case TagType.String: return 'text-nbt-string';
    case TagType.List: return 'text-nbt-list';
    case TagType.Compound: return 'text-nbt-compound';
    case TagType.IntArray: 
    case TagType.ByteArray:
    case TagType.LongArray: return 'text-nbt-array';
    default: return 'text-gray-400';
  }
};

const checkMatch = (t: NBTTag, term: string): boolean => {
    if (!term) return false;
    const termLower = term.toLowerCase();
    if (t.name && t.name.toLowerCase().includes(termLower)) return true;
    if (t.value !== null && typeof t.value !== 'object' && String(t.value).toLowerCase().includes(termLower)) return true;
    if (t.type === TagType.List && t.value.list) return t.value.list.some((c: NBTTag) => checkMatch(c, term));
    if (t.type === TagType.Compound && Array.isArray(t.value)) return t.value.some((c: NBTTag) => checkMatch(c, term));
    return false;
};

export const NBTNode: React.FC<NBTNodeProps> = ({ 
    tag, depth, onUpdate, onDelete, onAdd, path, searchTerm,
    selectedPaths, onSelect, expandSignal 
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); 
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [editName, setEditName] = useState<string>(tag.name || '');
  const [isHovered, setIsHovered] = useState(false);

  const isSelected = selectedPaths.has(path);
  const isContainer = [TagType.Compound, TagType.List].includes(tag.type);

  // Handle Global Expansion Signals
  useEffect(() => {
    if (expandSignal.id === 0) return; // Initial state

    if (expandSignal.type === 'expand_all') {
        if (isContainer) setIsExpanded(true);
    } else if (expandSignal.type === 'collapse_all') {
        if (isContainer) setIsExpanded(false);
    } else if (expandSignal.type === 'expand_selected') {
        if (isContainer && isSelected) setIsExpanded(true);
    } else if (expandSignal.type === 'collapse_selected') {
        if (isContainer && isSelected) setIsExpanded(false);
    }
  }, [expandSignal, isContainer, isSelected]);

  const isDirectMatch = useMemo(() => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    const nameMatch = tag.name?.toLowerCase().includes(term);
    const valMatch = tag.value !== null && typeof tag.value !== 'object' && String(tag.value).toLowerCase().includes(term);
    return nameMatch || valMatch;
  }, [tag, searchTerm]);

  useEffect(() => {
    if (searchTerm) {
        const hasChildMatch = checkMatch(tag, searchTerm);
        if (hasChildMatch && isContainer) setIsExpanded(true);
    }
  }, [searchTerm, tag, isContainer]);

  useEffect(() => {
    if (tag.value !== undefined && tag.value !== null) setEditValue(tag.value.toString());
  }, [tag.value]);

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleSave = () => {
    let newValue: any = editValue;
    try {
        switch (tag.type) {
            case TagType.Byte: case TagType.Short: case TagType.Int:
                newValue = parseInt(editValue);
                if (isNaN(newValue)) throw new Error("無效的整數");
                break;
            case TagType.Long: newValue = BigInt(editValue); break;
            case TagType.Float: case TagType.Double:
                newValue = parseFloat(editValue);
                if (isNaN(newValue)) throw new Error("無效的浮點數");
                break;
            case TagType.String: newValue = editValue; break;
        }
        onUpdate({ ...tag, name: editName, value: newValue });
        setIsEditing(false);
    } catch (e) {
        alert("格式錯誤");
    }
  };

  const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (e.ctrlKey || e.metaKey) {
          onSelect(path, 'toggle');
      } else if (e.shiftKey) {
          onSelect(path, 'range');
      } else {
          onSelect(path, 'single');
          if (isContainer && !isEditing) handleToggle();
      }
  };

  const renderValue = () => {
    if (tag.type === TagType.Compound) return <span className="text-gray-500 italic text-xs">{tag.value.length} 項</span>;
    if (tag.type === TagType.List) return <span className="text-gray-500 italic text-xs">{tag.value.list.length} 項 (型態: {TagTypeNames[tag.value.itemType].split(' ')[0]})</span>;
    if ([TagType.ByteArray, TagType.IntArray, TagType.LongArray].includes(tag.type)) return <span className="text-gray-500 italic text-xs">陣列長度 [{tag.value.length}]</span>;
    return <span className="text-blue-200 font-mono ml-2 break-all">{tag.value.toString()}</span>;
  };

  // Recursion handlers (Update, Delete, Add) are same as before but need to pass down new props
  const handleChildUpdate = (index: number, updatedChild: NBTTag) => {
    const newValue = [...tag.value];
    if (tag.type === TagType.List) {
        const newList = [...tag.value.list];
        newList[index] = updatedChild;
        onUpdate({ ...tag, value: { ...tag.value, list: newList }});
    } else if (tag.type === TagType.Compound) {
        newValue[index] = updatedChild;
        onUpdate({ ...tag, value: newValue });
    }
  };

  const handleChildDelete = (index: number) => {
    if (tag.type === TagType.List) {
        const newList = [...tag.value.list];
        newList.splice(index, 1);
        onUpdate({ ...tag, value: { ...tag.value, list: newList }});
    } else if (tag.type === TagType.Compound) {
        const newValue = [...tag.value];
        newValue.splice(index, 1);
        onUpdate({ ...tag, value: newValue });
    }
  };

  const handleAddChild = (parentType: TagType) => {
      // Simplified add logic
      if (tag.type === TagType.Compound) {
          const newTag: NBTTag = { type: TagType.String, name: 'new_tag', value: 'value' };
          onUpdate({ ...tag, value: [...tag.value, newTag] });
          setIsExpanded(true);
      } else if (tag.type === TagType.List) {
          let defaultValue: any = 0;
          if (tag.value.itemType === TagType.String) defaultValue = "";
          if (tag.value.itemType === TagType.Compound) defaultValue = [];
          const newTag: NBTTag = { type: tag.value.itemType, name: null, value: defaultValue };
          const newList = [...tag.value.list, newTag];
          onUpdate({ ...tag, value: { ...tag.value, list: newList }});
          setIsExpanded(true);
      }
  };

  return (
    <div className="font-mono text-sm select-none">
      <div 
        className={`flex items-center py-1 px-2 rounded cursor-pointer group transition-colors duration-100
        ${isEditing ? 'bg-gray-800 ring-1 ring-blue-500' : ''}
        ${isDirectMatch ? 'ring-1 ring-yellow-500/50' : ''}
        ${isSelected ? 'bg-blue-900/60 border-l-2 border-blue-400' : 'hover:bg-gray-800 border-l-2 border-transparent'}
        `}
        style={{ paddingLeft: `${depth * 20}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      >
        <div className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500">
          {isContainer && (
            <div onClick={(e) => { e.stopPropagation(); handleToggle(); }}>
               {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          )}
        </div>

        <span className={`mr-2 font-bold ${getTypeColor(tag.type)} text-xs uppercase opacity-80`}>
          {isContainer ? (tag.type === TagType.Compound ? 'CMP' : 'LST') : TagTypeNames[tag.type].split(' ')[0]}
        </span>

        {isEditing ? (
          <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
             {tag.name !== null && (
               <input 
                 className="bg-gray-900 border border-gray-600 rounded px-1 text-white w-24"
                 value={editName}
                 onChange={e => setEditName(e.target.value)}
                 autoFocus onClick={e => e.stopPropagation()}
               />
             )}
             {!isContainer && (
                 <input 
                    className="bg-gray-900 border border-gray-600 rounded px-1 text-white flex-1"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    autoFocus={tag.name === null} onClick={e => e.stopPropagation()}
                 />
             )}
             <button onClick={handleSave} className="text-green-400 px-1">V</button>
             <button onClick={() => setIsEditing(false)} className="text-red-400 px-1">X</button>
          </div>
        ) : (
          <div className="flex-1 flex items-center overflow-hidden">
             {tag.name && <span className={`mr-2 ${isDirectMatch ? 'text-yellow-300 font-bold' : 'text-orange-300'}`}>{tag.name}:</span>}
             <span className={isDirectMatch && !isContainer ? 'text-yellow-200 font-bold' : ''}>{renderValue()}</span>
          </div>
        )}

        {/* Floating Actions for Single Item */}
        {!isSelected && (
            <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4 bg-gray-900/80 rounded px-1`}>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="text-gray-400 hover:text-blue-400"><Edit2 size={14} /></button>
            {isContainer && <button onClick={(e) => { e.stopPropagation(); handleAddChild(tag.type); }} className="text-gray-400 hover:text-green-400"><Plus size={14} /></button>}
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-400 hover:text-red-400"><Trash size={14} /></button>
            </div>
        )}
      </div>

      {isContainer && isExpanded && (
        <div className="border-l border-gray-700 ml-[10px]">
          {tag.type === TagType.Compound && (tag.value as NBTTag[]).map((child, idx) => (
             <NBTNode 
                key={idx} tag={child} depth={depth + 1} path={`${path}.${child.name}`}
                onUpdate={(updated) => handleChildUpdate(idx, updated)}
                onDelete={() => handleChildDelete(idx)}
                onAdd={handleAddChild}
                searchTerm={searchTerm}
                selectedPaths={selectedPaths}
                onSelect={onSelect}
                expandSignal={expandSignal}
             />
          ))}
          {tag.type === TagType.List && (tag.value.list as NBTTag[]).map((child, idx) => (
             <NBTNode 
                key={idx} tag={child} depth={depth + 1} path={`${path}[${idx}]`}
                onUpdate={(updated) => handleChildUpdate(idx, updated)}
                onDelete={() => handleChildDelete(idx)}
                onAdd={handleAddChild}
                searchTerm={searchTerm}
                selectedPaths={selectedPaths}
                onSelect={onSelect}
                expandSignal={expandSignal}
             />
          ))}
        </div>
      )}
    </div>
  );
};