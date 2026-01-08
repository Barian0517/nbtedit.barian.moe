import pako from 'pako';
import { TagType, NBTTag } from '../types';

// Helper to handle 64-bit integers
const parseLong = (view: DataView, offset: number): bigint => {
  const high = view.getInt32(offset);
  const low = view.getInt32(offset + 4);
  return (BigInt(high) << 32n) | (BigInt(low) & 0xFFFFFFFFn);
};

const writeLong = (view: DataView, offset: number, value: bigint) => {
  const high = Number(value >> 32n);
  const low = Number(value & 0xFFFFFFFFn);
  view.setInt32(offset, high);
  view.setInt32(offset + 4, low);
};

export class NBTParser {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;
  private decoder = new TextDecoder('utf-8');

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  static async parse(file: File): Promise<{ root: NBTTag; isCompressed: boolean }> {
    const buffer = await file.arrayBuffer();
    const arr = new Uint8Array(buffer);

    let finalBuffer = buffer;
    let isCompressed = false;

    // Check GZIP magic number (1F 8B)
    if (arr[0] === 0x1f && arr[1] === 0x8b) {
      try {
        const inflated = pako.ungzip(arr);
        finalBuffer = inflated.buffer;
        isCompressed = true;
      } catch (e) {
        console.error("Decompression failed", e);
        throw new Error("Invalid GZIP format");
      }
    }

    const parser = new NBTParser(finalBuffer);
    return { root: parser.readTag(true), isCompressed };
  }

  private readString(): string {
    const len = this.view.getUint16(this.offset);
    this.offset += 2;
    const strBuffer = new Uint8Array(this.buffer, this.offset, len);
    const str = this.decoder.decode(strBuffer);
    this.offset += len;
    return str;
  }

  private readTag(isRoot: boolean = false, forcedType?: TagType, forcedName: string | null = null): NBTTag {
    let type = forcedType;
    let name = forcedName;

    if (type === undefined) {
      type = this.view.getUint8(this.offset) as TagType;
      this.offset += 1;
    }

    if (type === TagType.End) {
      return { type, name: null, value: null };
    }

    if (name === null && isRoot) {
      name = this.readString();
    } else if (name === null && forcedType === undefined) {
      // If we are reading a named tag (not inside a list), read name
      name = this.readString();
    }

    let value: any;

    switch (type) {
      case TagType.Byte:
        value = this.view.getInt8(this.offset);
        this.offset += 1;
        break;
      case TagType.Short:
        value = this.view.getInt16(this.offset);
        this.offset += 2;
        break;
      case TagType.Int:
        value = this.view.getInt32(this.offset);
        this.offset += 4;
        break;
      case TagType.Long:
        value = parseLong(this.view, this.offset);
        this.offset += 8;
        break;
      case TagType.Float:
        value = this.view.getFloat32(this.offset);
        this.offset += 4;
        break;
      case TagType.Double:
        value = this.view.getFloat64(this.offset);
        this.offset += 8;
        break;
      case TagType.ByteArray:
        const lenByte = this.view.getInt32(this.offset);
        this.offset += 4;
        value = Array.from(new Int8Array(this.buffer, this.offset, lenByte));
        this.offset += lenByte;
        break;
      case TagType.String:
        value = this.readString();
        break;
      case TagType.List:
        const itemType = this.view.getUint8(this.offset) as TagType;
        this.offset += 1;
        const listLen = this.view.getInt32(this.offset);
        this.offset += 4;
        value = {
          itemType,
          list: [] as NBTTag[]
        };
        for (let i = 0; i < listLen; i++) {
          value.list.push(this.readTag(false, itemType, null));
        }
        break;
      case TagType.Compound:
        value = [];
        while (true) {
            // Peek next type
            const nextType = this.view.getUint8(this.offset) as TagType;
            if (nextType === TagType.End) {
                this.offset += 1;
                break;
            }
            value.push(this.readTag(false));
        }
        break;
      case TagType.IntArray:
        const lenInt = this.view.getInt32(this.offset);
        this.offset += 4;
        value = [];
        for(let i=0; i<lenInt; i++) {
            value.push(this.view.getInt32(this.offset));
            this.offset += 4;
        }
        break;
      case TagType.LongArray:
        const lenLong = this.view.getInt32(this.offset);
        this.offset += 4;
        value = [];
        for(let i=0; i<lenLong; i++) {
            value.push(parseLong(this.view, this.offset));
            this.offset += 8;
        }
        break;
    }

    return { type, name, value };
  }
}

export class NBTWriter {
    private buffer: number[] = [];
    private encoder = new TextEncoder();

    static write(root: NBTTag, compress: boolean = true): Uint8Array {
        const writer = new NBTWriter();
        writer.writeTag(root, true);
        const u8 = new Uint8Array(writer.buffer);
        if (compress) {
            return pako.gzip(u8);
        }
        return u8;
    }

    private writeByte(b: number) {
        this.buffer.push(b & 0xFF);
    }

    private writeShort(s: number) {
        this.buffer.push((s >> 8) & 0xFF, s & 0xFF);
    }

    private writeInt(i: number) {
        this.buffer.push((i >> 24) & 0xFF, (i >> 16) & 0xFF, (i >> 8) & 0xFF, i & 0xFF);
    }

    private writeLong(l: bigint) {
        const high = Number(l >> 32n);
        const low = Number(l & 0xFFFFFFFFn);
        this.writeInt(high);
        this.writeInt(low);
    }

    private writeFloat(f: number) {
        const view = new DataView(new ArrayBuffer(4));
        view.setFloat32(0, f);
        for(let i=0; i<4; i++) this.writeByte(view.getUint8(i));
    }

    private writeDouble(d: number) {
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat64(0, d);
        for(let i=0; i<8; i++) this.writeByte(view.getUint8(i));
    }

    private writeString(s: string) {
        const bytes = this.encoder.encode(s);
        this.writeShort(bytes.length);
        for (const b of bytes) this.writeByte(b);
    }

    private writeTag(tag: NBTTag, isRoot: boolean = false, skipHeader: boolean = false) {
        if (!skipHeader) {
            this.writeByte(tag.type);
            if (isRoot || tag.name !== null) {
                this.writeString(tag.name || '');
            }
        }

        switch (tag.type) {
            case TagType.Byte: this.writeByte(tag.value); break;
            case TagType.Short: this.writeShort(tag.value); break;
            case TagType.Int: this.writeInt(tag.value); break;
            case TagType.Long: this.writeLong(BigInt(tag.value)); break;
            case TagType.Float: this.writeFloat(tag.value); break;
            case TagType.Double: this.writeDouble(tag.value); break;
            case TagType.ByteArray: 
                this.writeInt(tag.value.length);
                for(const b of tag.value) this.writeByte(b);
                break;
            case TagType.String: this.writeString(tag.value); break;
            case TagType.List:
                this.writeByte(tag.value.itemType);
                this.writeInt(tag.value.list.length);
                for(const item of tag.value.list) {
                    this.writeTag(item, false, true);
                }
                break;
            case TagType.Compound:
                for(const child of tag.value) {
                    this.writeTag(child);
                }
                this.writeByte(TagType.End);
                break;
            case TagType.IntArray:
                this.writeInt(tag.value.length);
                for(const i of tag.value) this.writeInt(i);
                break;
            case TagType.LongArray:
                this.writeInt(tag.value.length);
                for(const l of tag.value) this.writeLong(BigInt(l));
                break;
        }
    }
}