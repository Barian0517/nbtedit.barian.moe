export enum TagType {
  End = 0,
  Byte = 1,
  Short = 2,
  Int = 3,
  Long = 4,
  Float = 5,
  Double = 6,
  ByteArray = 7,
  String = 8,
  List = 9,
  Compound = 10,
  IntArray = 11,
  LongArray = 12,
}

export interface NBTTag {
  type: TagType;
  name: string | null; // Root or inside Compound has name, inside List does not
  value: any;
}

export interface NBTFile {
  id: string;
  filename: string;
  root: NBTTag;
  isCompressed: boolean;
  isModified: boolean;
  undoStack: NBTTag[];
  redoStack: NBTTag[];
}

export type TagAction = 
  | { type: 'UPDATE_VALUE'; payload: any }
  | { type: 'RENAME'; name: string }
  | { type: 'DELETE' }
  | { type: 'ADD_CHILD'; tag: NBTTag }
  | { type: 'COPY' };

export const TagTypeNames: Record<TagType, string> = {
  [TagType.End]: '結束 (End)',
  [TagType.Byte]: '位元組 (Byte)',
  [TagType.Short]: '短整數 (Short)',
  [TagType.Int]: '整數 (Int)',
  [TagType.Long]: '長整數 (Long)',
  [TagType.Float]: '浮點數 (Float)',
  [TagType.Double]: '雙精度 (Double)',
  [TagType.ByteArray]: '位元組陣列 (Byte Array)',
  [TagType.String]: '字串 (String)',
  [TagType.List]: '列表 (List)',
  [TagType.Compound]: '複合標籤 (Compound)',
  [TagType.IntArray]: '整數陣列 (Int Array)',
  [TagType.LongArray]: '長整數陣列 (Long Array)',
};