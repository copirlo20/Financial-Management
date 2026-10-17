import { inflateRawSync } from "node:zlib";

// An .xlsx file is a zip archive. The 5 MB upload limit applies to the archive, but exceljs inflates
// everything in memory, and a few megabytes of zip can inflate to gigabytes ("zip bomb"). Before exceljs
// sees a file, every entry is inflated here with a hard cap on the output, so the check is based on the
// real size rather than the sizes the archive claims. A genuine statement of 10,000 rows is a few MB.
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRIES = 1000;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

export class ArchiveTooLargeError extends Error {}
export class ArchiveUnreadableError extends Error {}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The record is 22 bytes plus a comment of up to 65,535 bytes, at the very end of the file.
  const lowest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= lowest; offset--) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new ArchiveUnreadableError("No end of central directory");
}

// Throws ArchiveTooLargeError when the entries inflate to more than allowed, ArchiveUnreadableError when
// the archive is malformed or uses features a spreadsheet does not need (zip64, unusual compression).
export function checkXlsxArchive(buffer: Buffer): void {
  if (buffer.length < 22) throw new ArchiveUnreadableError("Too short");
  const end = findEndOfCentralDirectory(buffer);
  const entries = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  if (entries === 0xffff || directoryOffset === 0xffffffff) throw new ArchiveUnreadableError("zip64");
  if (entries > MAX_ENTRIES) throw new ArchiveTooLargeError("Too many entries");
  if (directoryOffset + directorySize > end) throw new ArchiveUnreadableError("Central directory out of range");

  let remaining = MAX_UNCOMPRESSED_BYTES;
  let position = directoryOffset;
  for (let index = 0; index < entries; index++) {
    if (position + 46 > end || buffer.readUInt32LE(position) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new ArchiveUnreadableError("Bad central directory entry");
    }
    const method = buffer.readUInt16LE(position + 10);
    const compressedSize = buffer.readUInt32LE(position + 20);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const localOffset = buffer.readUInt32LE(position + 42);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new ArchiveUnreadableError("zip64");

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new ArchiveUnreadableError("Bad local header");
    }
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (data.length !== compressedSize) throw new ArchiveUnreadableError("Entry runs past the end");

    let size: number;
    if (method === 0) {
      size = compressedSize; // stored as is
    } else if (method === 8) {
      try {
        // One byte more than what is left, so going over the limit is detectable.
        size = inflateRawSync(data, { maxOutputLength: remaining + 1 }).length;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") throw new ArchiveTooLargeError("Inflates too far");
        throw new ArchiveUnreadableError("Corrupt entry");
      }
    } else {
      throw new ArchiveUnreadableError(`Compression method ${method}`);
    }
    remaining -= size;
    if (remaining < 0) throw new ArchiveTooLargeError("Inflates too far");
    position += 46 + nameLength + extraLength + commentLength;
  }
}
