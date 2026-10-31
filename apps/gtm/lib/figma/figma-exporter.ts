/**
 * Figma Exporter
 * 
 * Converts WebsiteDesign to Figma-compatible format
 * Generates a console script that can be pasted into Figma
 */

import type { 
  WebsiteDesign, 
  WebsiteSection,
  GlobalStyles,
} from '@/lib/website/ai-designer'

export interface FigmaExportResult {
  script: string
  instructions: string
}

/**
 * Generate a Figma console script to create the design
 */
export function exportToFigma(design: WebsiteDesign): FigmaExportResult {
  const { sections, globalStyles, name } = design

  const sortedSections = [...sections].sort((a, b) => a.order - b.order)
  const sectionScripts = sortedSections.map((section, index) => 
    generateSectionScript(section, index, globalStyles)
  ).join('\n\n')

  const script = `
// Figma Design Import Script
// Generated from: ${name}
// ${new Date().toISOString()}

(async () => {
  // Create main frame
  const page = figma.currentPage;
  const mainFrame = figma.createFrame();
  mainFrame.name = "${escapeString(name)}";
  mainFrame.resize(1440, 900);
  mainFrame.layoutMode = "VERTICAL";
  mainFrame.primaryAxisSizingMode = "AUTO";
  mainFrame.counterAxisSizingMode = "FIXED";
  mainFrame.paddingTop = 0;
  mainFrame.paddingBottom = 0;
  mainFrame.itemSpacing = 0;
  
  // Set background
  mainFrame.fills = [{
    type: "SOLID",
    color: ${globalStyles.colorScheme === 'dark' 
      ? '{ r: 0.039, g: 0.039, b: 0.039 }' 
      : '{ r: 1, g: 1, b: 1 }'
    }
  }];

  // Load fonts
  await Promise.all([
    figma.loadFontAsync({ family: "${globalStyles.fontHeading || 'Inter'}", style: "Bold" }),
    figma.loadFontAsync({ family: "${globalStyles.fontHeading || 'Inter'}", style: "Semi Bold" }),
    figma.loadFontAsync({ family: "${globalStyles.fontBody || 'Inter'}", style: "Regular" }),
    figma.loadFontAsync({ family: "${globalStyles.fontBody || 'Inter'}", style: "Medium" }),
  ]).catch(() => {
    // Fallback to Inter if fonts aren't available
    return Promise.all([
      figma.loadFontAsync({ family: "Inter", style: "Bold" }),
      figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }),
      figma.loadFontAsync({ family: "Inter", style: "Regular" }),
      figma.loadFontAsync({ family: "Inter", style: "Medium" }),
    ]);
  });

  // Primary color
  const primaryColor = hexToRgb("${globalStyles.primaryColor || '#6366f1'}");
  
  // Helper function
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

${sectionScripts}

  // Center on page
  page.selection = [mainFrame];
  figma.viewport.scrollAndZoomIntoView([mainFrame]);
  
  figma.notify("✅ Design imported successfully!");
})();
`

  const instructions = `## How to Import into Figma

1. Open your Figma file
2. Press \`Cmd/Ctrl + Option/Alt + I\` to open the console (or use Plugins > Development > Open Console)
3. Copy the entire script below and paste it into the console
4. Press Enter to run the script
5. The design will be created on your current page

**Note:** Make sure you have the fonts "${globalStyles.fontHeading}" and "${globalStyles.fontBody}" installed, or the script will fall back to Inter.

### Tips
- The script creates auto-layout frames that match your section structure
- You can easily edit text, colors, and spacing after import
- Each section is a separate frame for easy organization`

  return { script, instructions }
}

/**
 * Generate Figma script for a single section
 */
function generateSectionScript(
  section: WebsiteSection, 
  index: number,
  globalStyles: GlobalStyles
): string {
  const { type, content, styles } = section
  const sectionName = `section_${index}_${type}`

  const bgColor = styles.background === 'dark' 
    ? '{ r: 0.058, g: 0.058, b: 0.058 }' 
    : styles.background === 'light'
    ? '{ r: 0.969, g: 0.969, b: 0.969 }'
    : '{ r: 1, g: 1, b: 1 }'

  const padding = styles.spacing === 'compact' ? 48 
    : styles.spacing === 'spacious' ? 96 : 64

  const textColor = styles.background === 'dark' 
    ? '{ r: 0.98, g: 0.98, b: 0.98 }' 
    : '{ r: 0.039, g: 0.039, b: 0.039 }'

  const mutedColor = styles.background === 'dark'
    ? '{ r: 0.6, g: 0.6, b: 0.6 }'
    : '{ r: 0.4, g: 0.4, b: 0.4 }'

  let script = `
  // Section ${index + 1}: ${type}
  const ${sectionName} = figma.createFrame();
  ${sectionName}.name = "${type.charAt(0).toUpperCase() + type.slice(1)} Section";
  ${sectionName}.layoutMode = "VERTICAL";
  ${sectionName}.primaryAxisSizingMode = "AUTO";
  ${sectionName}.counterAxisSizingMode = "FIXED";
  ${sectionName}.resize(1440, 100);
  ${sectionName}.paddingTop = ${padding};
  ${sectionName}.paddingBottom = ${padding};
  ${sectionName}.paddingLeft = 80;
  ${sectionName}.paddingRight = 80;
  ${sectionName}.itemSpacing = 24;
  ${sectionName}.primaryAxisAlignItems = "CENTER";
  ${sectionName}.counterAxisAlignItems = "${styles.alignment === 'left' ? 'MIN' : styles.alignment === 'right' ? 'MAX' : 'CENTER'}";
  ${sectionName}.fills = [{ type: "SOLID", color: ${bgColor} }];
  mainFrame.appendChild(${sectionName});
`

  // Add headline
  if (content.headline) {
    script += `
  const ${sectionName}_headline = figma.createText();
  ${sectionName}_headline.characters = "${escapeString(content.headline)}";
  ${sectionName}_headline.fontSize = ${type === 'hero' ? 56 : 40};
  ${sectionName}_headline.fontName = { family: "${globalStyles.fontHeading || 'Inter'}", style: "Bold" };
  ${sectionName}_headline.fills = [{ type: "SOLID", color: ${textColor} }];
  ${sectionName}_headline.textAlignHorizontal = "${styles.alignment === 'left' ? 'LEFT' : styles.alignment === 'right' ? 'RIGHT' : 'CENTER'}";
  ${sectionName}.appendChild(${sectionName}_headline);
`
  }

  // Add subheadline
  if (content.subheadline) {
    script += `
  const ${sectionName}_subheadline = figma.createText();
  ${sectionName}_subheadline.characters = "${escapeString(content.subheadline)}";
  ${sectionName}_subheadline.fontSize = 20;
  ${sectionName}_subheadline.fontName = { family: "${globalStyles.fontBody || 'Inter'}", style: "Regular" };
  ${sectionName}_subheadline.fills = [{ type: "SOLID", color: ${mutedColor} }];
  ${sectionName}_subheadline.textAlignHorizontal = "${styles.alignment === 'left' ? 'LEFT' : styles.alignment === 'right' ? 'RIGHT' : 'CENTER'}";
  ${sectionName}.appendChild(${sectionName}_subheadline);
`
  }

  // Add CTA buttons
  if (content.cta) {
    script += `
  const ${sectionName}_buttons = figma.createFrame();
  ${sectionName}_buttons.name = "Buttons";
  ${sectionName}_buttons.layoutMode = "HORIZONTAL";
  ${sectionName}_buttons.primaryAxisSizingMode = "AUTO";
  ${sectionName}_buttons.counterAxisSizingMode = "AUTO";
  ${sectionName}_buttons.itemSpacing = 16;
  ${sectionName}_buttons.fills = [];
  ${sectionName}.appendChild(${sectionName}_buttons);

  const ${sectionName}_cta = figma.createFrame();
  ${sectionName}_cta.name = "Primary Button";
  ${sectionName}_cta.layoutMode = "HORIZONTAL";
  ${sectionName}_cta.primaryAxisSizingMode = "AUTO";
  ${sectionName}_cta.counterAxisSizingMode = "AUTO";
  ${sectionName}_cta.paddingTop = 14;
  ${sectionName}_cta.paddingBottom = 14;
  ${sectionName}_cta.paddingLeft = 28;
  ${sectionName}_cta.paddingRight = 28;
  ${sectionName}_cta.cornerRadius = 8;
  ${sectionName}_cta.fills = [{ type: "SOLID", color: primaryColor }];
  ${sectionName}_buttons.appendChild(${sectionName}_cta);

  const ${sectionName}_cta_text = figma.createText();
  ${sectionName}_cta_text.characters = "${escapeString(content.cta.text)}";
  ${sectionName}_cta_text.fontSize = 16;
  ${sectionName}_cta_text.fontName = { family: "${globalStyles.fontBody || 'Inter'}", style: "Medium" };
  ${sectionName}_cta_text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  ${sectionName}_cta.appendChild(${sectionName}_cta_text);
`

    if (content.secondaryCta) {
      script += `
  const ${sectionName}_secondary = figma.createFrame();
  ${sectionName}_secondary.name = "Secondary Button";
  ${sectionName}_secondary.layoutMode = "HORIZONTAL";
  ${sectionName}_secondary.primaryAxisSizingMode = "AUTO";
  ${sectionName}_secondary.counterAxisSizingMode = "AUTO";
  ${sectionName}_secondary.paddingTop = 14;
  ${sectionName}_secondary.paddingBottom = 14;
  ${sectionName}_secondary.paddingLeft = 28;
  ${sectionName}_secondary.paddingRight = 28;
  ${sectionName}_secondary.cornerRadius = 8;
  ${sectionName}_secondary.strokes = [{ type: "SOLID", color: primaryColor }];
  ${sectionName}_secondary.strokeWeight = 2;
  ${sectionName}_secondary.fills = [];
  ${sectionName}_buttons.appendChild(${sectionName}_secondary);

  const ${sectionName}_secondary_text = figma.createText();
  ${sectionName}_secondary_text.characters = "${escapeString(content.secondaryCta.text)}";
  ${sectionName}_secondary_text.fontSize = 16;
  ${sectionName}_secondary_text.fontName = { family: "${globalStyles.fontBody || 'Inter'}", style: "Medium" };
  ${sectionName}_secondary_text.fills = [{ type: "SOLID", color: primaryColor }];
  ${sectionName}_secondary.appendChild(${sectionName}_secondary_text);
`
    }
  }

  // Add items (features, testimonials, etc.)
  if (content.items && content.items.length > 0 && (type === 'features' || type === 'testimonials' || type === 'stats')) {
    const cols = styles.columns || 3
    script += `
  const ${sectionName}_items = figma.createFrame();
  ${sectionName}_items.name = "Items";
  ${sectionName}_items.layoutMode = "HORIZONTAL";
  ${sectionName}_items.layoutWrap = "WRAP";
  ${sectionName}_items.primaryAxisSizingMode = "FIXED";
  ${sectionName}_items.counterAxisSizingMode = "AUTO";
  ${sectionName}_items.resize(1280, 100);
  ${sectionName}_items.itemSpacing = 32;
  ${sectionName}_items.counterAxisSpacing = 32;
  ${sectionName}_items.fills = [];
  ${sectionName}.appendChild(${sectionName}_items);
`

    content.items.forEach((item, i) => {
      script += `
  const ${sectionName}_item_${i} = figma.createFrame();
  ${sectionName}_item_${i}.name = "Item ${i + 1}";
  ${sectionName}_item_${i}.layoutMode = "VERTICAL";
  ${sectionName}_item_${i}.primaryAxisSizingMode = "AUTO";
  ${sectionName}_item_${i}.counterAxisSizingMode = "FIXED";
  ${sectionName}_item_${i}.resize(${Math.floor(1280 / cols) - 32}, 100);
  ${sectionName}_item_${i}.paddingTop = 24;
  ${sectionName}_item_${i}.paddingBottom = 24;
  ${sectionName}_item_${i}.paddingLeft = 24;
  ${sectionName}_item_${i}.paddingRight = 24;
  ${sectionName}_item_${i}.itemSpacing = 12;
  ${sectionName}_item_${i}.cornerRadius = 12;
  ${sectionName}_item_${i}.fills = [{ type: "SOLID", color: ${styles.background === 'dark' ? '{ r: 0.1, g: 0.1, b: 0.1 }' : '{ r: 1, g: 1, b: 1 }'} }];
  ${sectionName}_item_${i}.strokes = [{ type: "SOLID", color: ${styles.background === 'dark' ? '{ r: 0.15, g: 0.15, b: 0.15 }' : '{ r: 0.9, g: 0.9, b: 0.9 }'} }];
  ${sectionName}_items.appendChild(${sectionName}_item_${i});

  const ${sectionName}_item_${i}_title = figma.createText();
  ${sectionName}_item_${i}_title.characters = "${escapeString(item.title)}";
  ${sectionName}_item_${i}_title.fontSize = ${type === 'stats' ? 36 : 20};
  ${sectionName}_item_${i}_title.fontName = { family: "${globalStyles.fontHeading || 'Inter'}", style: "${type === 'stats' ? 'Bold' : 'Semi Bold'}" };
  ${sectionName}_item_${i}_title.fills = [{ type: "SOLID", color: ${type === 'stats' ? 'primaryColor' : textColor} }];
  ${sectionName}_item_${i}.appendChild(${sectionName}_item_${i}_title);

  const ${sectionName}_item_${i}_desc = figma.createText();
  ${sectionName}_item_${i}_desc.characters = "${escapeString(item.description)}";
  ${sectionName}_item_${i}_desc.fontSize = 14;
  ${sectionName}_item_${i}_desc.fontName = { family: "${globalStyles.fontBody || 'Inter'}", style: "Regular" };
  ${sectionName}_item_${i}_desc.fills = [{ type: "SOLID", color: ${mutedColor} }];
  ${sectionName}_item_${i}.appendChild(${sectionName}_item_${i}_desc);
`
    })
  }

  return script
}

/**
 * Escape string for JavaScript
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}
