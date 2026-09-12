import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Function to generate a valid PNG buffer with a given width, height, background color, and foreground badge
function generatePngBuffer(width, height, isMaskable = false) {
  // We'll create a PNG with header, IHDR chunk, IDAT chunk, and IEND chunk.
  // Colors:
  // Background: #020617 (slate-950) -> R:2, G:6, B:23, A:255
  // Shield / Badge: #f59e0b (amber-500) -> R:245, G:158, B:11, A:255
  // Letter P / S: #020617 (slate-950) or #ffffff

  const padding = isMaskable ? Math.floor(width * 0.15) : Math.floor(width * 0.08); // 15% safe area for maskable
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  // Uncompressed RGBA scanlines: (1 byte filter type + width * 4 bytes RGBA) per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const badgeRadius = Math.min(innerW, innerH) * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Simple shape: Amber Shield circle/rounded rect in center
      const isInBadge = Math.abs(dx) <= badgeRadius * 0.8 && Math.abs(dy) <= badgeRadius * 0.8;
      const isInCross = (Math.abs(dx) < badgeRadius * 0.2 && Math.abs(dy) < badgeRadius * 0.5) ||
                        (Math.abs(dy) < badgeRadius * 0.2 && Math.abs(dx) < badgeRadius * 0.5);

      if (isInBadge && isInCross) {
        // Dark icon symbol
        rawData[pxOffset] = 2;     // R
        rawData[pxOffset + 1] = 6; // G
        rawData[pxOffset + 2] = 23;// B
        rawData[pxOffset + 3] = 255; // A
      } else if (isInBadge) {
        // Amber badge (#f59e0b)
        rawData[pxOffset] = 245;   // R
        rawData[pxOffset + 1] = 158;// G
        rawData[pxOffset + 2] = 11; // B
        rawData[pxOffset + 3] = 255; // A
      } else {
        // Background (#020617)
        rawData[pxOffset] = 2;     // R
        rawData[pxOffset + 1] = 6; // G
        rawData[pxOffset + 2] = 23;// B
        rawData[pxOffset + 3] = 255; // A
      }
    }
  }

  // Compress raw RGBA data with zlib
  const compressedData = zlib.deflateSync(rawData);

  // Helper CRC32
  function crc32(buf) {
    let crc = 0xffffffff;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, dataBuf) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(dataBuf.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, dataBuf]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
  }

  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePngBuffer(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePngBuffer(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePngBuffer(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePngBuffer(180, 180, false));

// Write SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="128" fill="#020617"/>
  <rect x="96" y="96" width="320" height="320" rx="64" fill="#f59e0b"/>
  <path d="M 216 160 L 296 160 C 320 160 336 176 336 200 C 336 224 320 240 296 240 L 256 240 L 256 352 L 216 352 Z M 256 200 L 288 200 C 298 200 304 196 304 190 C 304 184 298 180 288 180 L 256 180 Z" fill="#020617"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('✅ Standard PWA PNG & SVG icons generated in /public/');
