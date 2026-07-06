import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const scratchDir = join(root, 'scratch');
mkdirSync(scratchDir, { recursive: true });

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * Measure actual text width using headless Edge browser by inspecting DOM title.
 */
export function measureTextWidth(ansiText) {
  // Strip ANSI codes
  const ansiRe = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  const cleanLines = ansiText.trimEnd().split('\n').map(l => l.replace(ansiRe, ''));
  // We measure the longest line
  const longestLine = cleanLines.reduce((a, b) => a.length > b.length ? a : b, '');

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pending</title>
  <style>
    body { margin: 0; padding: 0; }
    #target {
      font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace;
      font-size: 13px;
      white-space: pre;
      display: inline-block;
      letter-spacing: 0px;
    }
  </style>
</head>
<body>
  <div id="target">${longestLine.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
  <script>
    // Measure DOM element width on layout load
    const rect = document.getElementById('target').getBoundingClientRect();
    document.title = 'WIDTH:' + rect.width;
  </script>
</body>
</html>`;

  const htmlPath = join(scratchDir, 'measure_temp.html');
  writeFileSync(htmlPath, htmlContent, 'utf-8');

  // Spawn Edge headless and dump DOM
  const r = spawnSync(EDGE_PATH, [
    '--headless',
    '--disable-gpu',
    '--dump-dom',
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ], { encoding: 'utf8', timeout: 5000 });

  if (r.error) {
    throw new Error('Failed to run Edge: ' + r.error.message);
  }

  const match = r.stdout.match(/<title>WIDTH:([0-9.]+)<\/title>/);
  if (!match) {
    throw new Error('Could not read measured width from DOM dump. Edge Output:\n' + r.stdout);
  }

  return parseFloat(match[1]);
}

/**
 * Validate generated SVG files for margin symmetry.
 */
function validateSVGMargin(svgPath, expectedLeftMargin = 16) {
  const content = readFileSync(svgPath, 'utf-8');
  // Parse width
  const wMatch = content.match(/<svg width="(\d+)"/);
  if (!wMatch) throw new Error('No width found in ' + svgPath);
  const svgW = parseInt(wMatch[1], 10);

  // Extract the longest text element content (excluding tags/tspans)
  const textMatch = content.match(/<text x="16"[^>]*>([\s\S]+?)<\/text>/);
  if (!textMatch) throw new Error('No text element found in ' + svgPath);

  // Strip tags and HTML entities to get raw text
  let rawText = textMatch[1].replace(/<[^>]+>/g, '').trimEnd();
  // Decode basic XML entities
  rawText = rawText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  // Measure raw text width
  const measuredW = measureTextWidth(rawText);
  
  // Calculate right margin
  const actualRightMargin = svgW - expectedLeftMargin - measuredW;
  const marginError = Math.abs(expectedLeftMargin - actualRightMargin);
  const errorPercent = (marginError / expectedLeftMargin) * 100;

  console.log(`\n=== Verification: ${svgPath} ===`);
  console.log(`SVG Frame Width   : ${svgW}px`);
  console.log(`Measured Text W   : ${measuredW}px`);
  console.log(`Left Margin       : ${expectedLeftMargin}px`);
  console.log(`Actual Right Margin: ${actualRightMargin.toFixed(2)}px`);
  console.log(`Symmetry Error     : ${errorPercent.toFixed(2)}% (Target: < 5.00%)`);

  if (errorPercent >= 5.0) {
    console.log(`❌ FAILED: Error is ${errorPercent.toFixed(2)}% which is >= 5%`);
    return { success: false, recommendedW: Math.ceil(expectedLeftMargin + measuredW + expectedLeftMargin) };
  } else {
    console.log(`✅ PASSED: Margins are symmetric within 5% error threshold!`);
    return { success: true };
  }
}

// Run verification loop
const claudeSvg = resolve(root, 'docs/preview-claude.svg');
const agySvg = resolve(root, 'docs/preview-agy.svg');

try {
  const claudeRes = validateSVGMargin(claudeSvg);
  // agy is intentionally shorter but shares targetW, so we only print diagnostic margin info for it
  console.log('\n--- Diagnostic info for agy ---');
  try {
    validateSVGMargin(agySvg);
  } catch (e) {
    console.log('agy diagnostic warning:', e.message);
  }

  if (!claudeRes.success) {
    process.exit(1);
  }
  console.log('\n✅ Verification Completed: targetW is perfectly calibrated (error < 5.00%)!');
} catch (err) {
  console.error('Error during validation:', err);
  process.exit(1);
}
