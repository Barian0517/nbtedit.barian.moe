import React, { useMemo } from 'react';
import { NBTTag, TagType } from '../types';
import { X, Shield, Heart, Zap, Drumstick, Gem } from 'lucide-react';

interface PlayerPreviewProps {
  root: NBTTag;
  onClose: () => void;
}

interface Item {
  id: string;
  count: number;
  slot?: number;
  tag?: any;
}

const findTag = (tag: NBTTag, name: string): NBTTag | undefined => {
  if (tag.type !== TagType.Compound) return undefined;
  return (tag.value as NBTTag[]).find(t => t.name === name);
};

const parseItems = (listTag: NBTTag | undefined): Item[] => {
  if (!listTag || listTag.type !== TagType.List) return [];
  return (listTag.value.list as NBTTag[]).map(itemTag => {
    const idTag = findTag(itemTag, 'id');
    const countTag = findTag(itemTag, 'Count');
    const slotTag = findTag(itemTag, 'Slot');
    const tagTag = findTag(itemTag, 'tag');
    
    // Normalize ID (remove minecraft: prefix for display/url)
    const rawId = idTag?.value || 'air';
    
    return {
      id: rawId,
      count: countTag?.value || 0,
      slot: slotTag?.value,
      tag: tagTag
    };
  });
};

const getItemImageUrl = (id: string) => {
  const cleanId = id.replace('minecraft:', '');
  // Try to use item texture first
  return `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/${cleanId}.png`;
};

const ItemSlot: React.FC<{ item?: Item, label?: string }> = ({ item, label }) => {
  const isEmpty = !item || item.id === 'air' || item.id === 'minecraft:air';

  return (
    <div className={`relative group w-10 h-10 bg-gray-700 border flex items-center justify-center rounded-sm ${isEmpty ? 'border-gray-600' : 'border-gray-500'}`} title={item?.id || label}>
      {label && isEmpty && <span className="text-[10px] text-gray-500 uppercase select-none">{label}</span>}
      {!isEmpty && item && (
        <>
          <img 
            src={getItemImageUrl(item.id)} 
            alt={item.id} 
            className="w-8 h-8 object-contain pixelated"
            onError={(e) => {
                // Fallback for blocks that aren't items or modded items
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNzc3IiBzdHJva2Utd2lkdGg9IjIiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgLz48L3N2Zz4='; 
            }}
          />
          {item.count > 1 && (
            <span className="absolute bottom-0 right-0 text-white text-[10px] font-bold leading-none drop-shadow-md px-0.5">
              {item.count}
            </span>
          )}
          {/* Tooltip */}
          <div className="absolute z-50 bottom-full right-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-2 rounded whitespace-nowrap border border-purple-500/50 shadow-xl pointer-events-none">
            <p className="font-bold text-purple-300">{item.id}</p>
            {item.tag && <p className="text-gray-400 italic text-[10px] mt-1">NBT Data Present</p>}
          </div>
        </>
      )}
    </div>
  );
};

export const PlayerPreview: React.FC<PlayerPreviewProps> = ({ root, onClose }) => {
  
const parsedData = useMemo(() => {
    // 1. 基礎數據 (保持不變)
    const health = findTag(root, 'Health')?.value || findTag(root, 'HealF')?.value || 20;
    const food = findTag(root, 'foodLevel')?.value || 20;
    const xp = findTag(root, 'XpLevel')?.value || 0;
    
    // 2. 屬性解析 (保持不變)
    let maxHealth = 20;
    const attributes = findTag(root, 'Attributes');
    if (attributes && attributes.type === TagType.List) {
        const healthAttr = (attributes.value.list as NBTTag[]).find(a => findTag(a, 'Name')?.value === 'minecraft:generic.max_health');
        if (healthAttr) {
            maxHealth = findTag(healthAttr, 'Base')?.value || 20;
        }
    }

    // 3. 背包解析 (保持不變)
    const inventoryTag = findTag(root, 'Inventory');
    const allItems = parseItems(inventoryTag);
    const armor: {[key: number]: Item} = {};
    const inventory: Item[] = new Array(27).fill(null);
    const hotbar: Item[] = new Array(9).fill(null);
    let offhand: Item | undefined = undefined;

    allItems.forEach(item => {
      if (item.slot === undefined) return;
      if (item.slot >= 100 && item.slot <= 103) armor[item.slot] = item;
      else if (item.slot === -106) offhand = item;
      else if (item.slot >= 0 && item.slot <= 8) hotbar[item.slot] = item;
      else if (item.slot >= 9 && item.slot <= 35) inventory[item.slot - 9] = item;
    });
// 針對你提供的特定 NBT 結構重寫
const curiosItems: { identifier: string, items: Item[] }[] = [];
const forgeCaps = findTag(root, 'ForgeCaps');

if (forgeCaps) {
    const curiosInv = findTag(forgeCaps, 'curios:inventory');
    if (curiosInv) {
        // 1. 你的資料中列表名稱是大寫 "Curios"
        const curiosList = findTag(curiosInv, 'Curios');
        
        if (curiosList && curiosList.type === TagType.List) {
            (curiosList.value.list as NBTTag[]).forEach(slotTypeTag => {
                const identifier = findTag(slotTypeTag, 'Identifier')?.value as string;
                const stacksHandler = findTag(slotTypeTag, 'StacksHandler');
                
                if (stacksHandler) {
                    // 2. 進入 Stacks (大寫)
                    const stacksCompound = findTag(stacksHandler, 'Stacks');
                    if (stacksCompound) {
                        // 3. 進入 Items (大寫) - 這是你資料存放物品的地方
                        const itemsList = findTag(stacksCompound, 'Items');
                        
                        if (itemsList && itemsList.type === TagType.List) {
                            const itemsInSlot = parseItems(itemsList); // 使用你現有的 parseItems
                            
                            // 過濾掉空位
                            const validItems = itemsInSlot.filter(i => 
                                i.id && i.id !== 'minecraft:air' && i.id !== 'air'
                            );

                            if (validItems.length > 0) {
                                curiosItems.push({ 
                                    identifier: identifier || 'unknown', 
                                    items: validItems 
                                });
                            }
                        }
                    }
                }
            });
        }
    }
}
    return { health, maxHealth, food, xp, armor, inventory, hotbar, offhand, curiosItems };
  }, [root]);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        
        {/* Header */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">玩家資料預覽</h2>
            <div className="flex gap-4 text-sm font-mono">
              <div className="flex items-center text-red-400 gap-1" title="Health">
                <Heart size={16} fill="currentColor" /> {Math.round(parsedData.health)} / {parsedData.maxHealth}
              </div>
              <div className="flex items-center text-yellow-400 gap-1" title="Food Level">
                <Drumstick size={16} /> {parsedData.food}
              </div>
              <div className="flex items-center text-green-400 gap-1" title="XP Level">
                <Zap size={16} fill="currentColor" /> LV.{parsedData.xp}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Column: Armor & Offhand */}
          <div className="md:col-span-2 flex flex-col items-center gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 h-fit">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
               <Shield size={12} /> 裝備
            </h3>
            <div className="flex flex-col gap-2">
              <ItemSlot item={parsedData.armor[103]} label="頭" />
              <ItemSlot item={parsedData.armor[102]} label="身" />
              <ItemSlot item={parsedData.armor[101]} label="腿" />
              <ItemSlot item={parsedData.armor[100]} label="腳" />
            </div>
            <div className="w-8 h-px bg-gray-700 my-1"></div>
            <ItemSlot item={parsedData.offhand} label="副手" />
          </div>

          {/* Center Column: Inventory */}
          <div className="md:col-span-7 flex flex-col items-center bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 h-fit">
             <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 w-full text-left">物品欄</h3>
             
             {/* Main Inventory 9x3 */}
             <div className="grid grid-cols-9 gap-1 mb-4">
                {parsedData.inventory.map((item, idx) => (
                    <ItemSlot key={`inv-${idx}`} item={item} />
                ))}
             </div>

             {/* Hotbar 9x1 */}
             <div className="grid grid-cols-9 gap-1">
                {parsedData.hotbar.map((item, idx) => (
                    <ItemSlot key={`hot-${idx}`} item={item} />
                ))}
             </div>
          </div>

          {/* Right Column: Curios (Replaces Other Info) */}
          <div className="md:col-span-3 flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 h-full min-h-[300px]">
             <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                 <Gem size={12} /> 飾品 (Curios)
             </h3>
             
             {parsedData.curiosItems.length > 0 ? (
                 <div className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar max-h-[400px]">
                    {parsedData.curiosItems.map((curio, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2 rounded border border-gray-700">
                            <div className="text-[10px] text-purple-300 mb-1.5 font-mono uppercase tracking-wide flex justify-between items-center">
                                <span>{curio.identifier}</span>
                                <span className="bg-purple-900/50 text-purple-200 px-1 rounded text-[9px]">{curio.items.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {curio.items.map((item, i) => (
                                    <ItemSlot key={i} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-600 text-xs italic">
                     <div className="mb-2 opacity-50"><Gem size={24} /></div>
                     未偵測到 Curios 飾品
                 </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};