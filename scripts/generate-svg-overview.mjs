import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const imagesRoot = path.join(root, 'assets', 'images');
const outputDirectory = path.join(root, 'design');
const outputPath = path.join(outputDirectory, 'svg-overview-1920x1080.svg');

async function collectSvgFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSvgFiles(fullPath));
    } else if (
      entry.isFile()
      && entry.name.toLowerCase().endsWith('.svg')
      && fullPath !== outputPath
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const files = (await collectSvgFiles(imagesRoot)).sort((a, b) => a.localeCompare(b));
const width = 1920;
const height = 1080;
const headerHeight = 56;
const margin = 18;
const gap = 8;
const columns = 14;
const rows = Math.ceil(files.length / columns);
const tileWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
const tileHeight = (height - headerHeight - margin - gap * (rows - 1)) / rows;

const tiles = await Promise.all(files.map(async (file, index) => {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const label = path.basename(file, '.svg');
  const imageHref = encodeURI(path.relative(outputDirectory, file).split(path.sep).join('/'));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = margin + column * (tileWidth + gap);
  const y = headerHeight + row * (tileHeight + gap);
  const imagePadding = 7;
  const labelHeight = 18;

  return `
  <g>
    <title>${escapeXml(relative)}</title>
    <rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" rx="7" fill="#ffffff" stroke="#d8dde6"/>
    <image href="${escapeXml(imageHref)}" x="${x + imagePadding}" y="${y + imagePadding}" width="${tileWidth - imagePadding * 2}" height="${tileHeight - labelHeight - imagePadding * 2}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${x + 1}" y="${y + tileHeight - labelHeight}" width="${tileWidth - 2}" height="${labelHeight - 1}" rx="0 0 6 6" fill="#f2f4f8"/>
    <text x="${x + tileWidth / 2}" y="${y + tileHeight - 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" fill="#28303d">${escapeXml(label)}</text>
  </g>`;
}));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="1920" height="1080" fill="#e9edf3"/>
  <text x="18" y="27" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#151922">SVG asset overview</text>
  <text x="18" y="45" font-family="Arial, sans-serif" font-size="11" fill="#596273">${files.length} files · 1920 × 1080 · hover a tile for its full project path</text>
${tiles.join('')}
</svg>
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, svg);
console.log(`Created ${path.relative(root, outputPath)} with ${files.length} SVG files.`);
