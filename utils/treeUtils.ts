import { NBTTag, TagType } from "../types";

// Deep clone to ensure immutability in history
export const cloneTag = (tag: NBTTag): NBTTag => {
  if (Array.isArray(tag.value)) {
    // IntArray, ByteArray, LongArray are arrays of primitives, but Compound is array of Objects
    if (tag.type === TagType.Compound) {
        return { ...tag, value: (tag.value as NBTTag[]).map(cloneTag) };
    }
    return { ...tag, value: [...tag.value] }; // Primitive arrays
  } else if (typeof tag.value === 'object' && tag.value !== null) {
    if (tag.type === TagType.List) {
        return { 
            ...tag, 
            value: { 
                itemType: tag.value.itemType, 
                list: (tag.value.list as NBTTag[]).map(cloneTag) 
            } 
        };
    }
  }
  return { ...tag };
};

// Flatten tree to paths for Range Selection and Invert Selection
// Returns array of paths in visual order
export const flattenTree = (tag: NBTTag, parentPath: string = 'root'): string[] => {
    let paths: string[] = [parentPath];
    
    if (tag.type === TagType.Compound) {
        (tag.value as NBTTag[]).forEach(child => {
            paths = paths.concat(flattenTree(child, `${parentPath}.${child.name}`));
        });
    } else if (tag.type === TagType.List) {
        (tag.value.list as NBTTag[]).forEach((child, idx) => {
            paths = paths.concat(flattenTree(child, `${parentPath}[${idx}]`));
        });
    }
    
    return paths;
};

// Delete nodes that match the set of paths
export const deleteNodesByPaths = (root: NBTTag, pathsToDelete: Set<string>): NBTTag => {
    const recursiveDelete = (tag: NBTTag, currentPath: string): NBTTag | null => {
        if (pathsToDelete.has(currentPath)) {
            return null; // Signal to delete this node
        }

        if (tag.type === TagType.Compound) {
            const newValue = (tag.value as NBTTag[])
                .map(child => recursiveDelete(child, `${currentPath}.${child.name}`))
                .filter((child): child is NBTTag => child !== null);
            return { ...tag, value: newValue };
        } 
        
        if (tag.type === TagType.List) {
            const newList = (tag.value.list as NBTTag[])
                .map((child, idx) => recursiveDelete(child, `${currentPath}[${idx}]`)) // Note: Indices shift after delete in real-time, but paths are fixed snapshots. 
                // However, for bulk delete by ID/Path, we must be careful. 
                // The current path generation strategy relies on static indices. 
                // If we delete index 0, index 1 becomes 0.
                // A better strategy for bulk delete in lists is to filter.
                .filter((child): child is NBTTag => child !== null);
            return { ...tag, value: { ...tag.value, list: newList } };
        }

        return tag;
    };

    // We clone first to avoid mutating the original state reference if the operation is partial
    // But since we are building a new tree, we can just start.
    const result = recursiveDelete(cloneTag(root), 'root');
    return result || { ...root, value: [] }; // Should not happen for root unless root is deleted (blocked in UI)
};
