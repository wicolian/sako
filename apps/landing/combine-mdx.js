const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'content');
const outputFile = path.join(__dirname, 'all-pages-combined.md');

// Function to recursively get all MDX files
function getAllMdxFiles(dir, fileList = [], baseDir = dir) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllMdxFiles(filePath, fileList, baseDir);
    } else if (file.endsWith('.mdx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to parse frontmatter and extract priority
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { priority: 999, slug: '', title: '' };
  }
  
  const frontmatter = frontmatterMatch[1];
  const priorityMatch = frontmatter.match(/priority:\s*(\d+)/);
  const slugMatch = frontmatter.match(/slug:\s*["']?([^"'\n]+)["']?/);
  const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/);
  
  return {
    priority: priorityMatch ? parseInt(priorityMatch[1], 10) : 999,
    slug: slugMatch ? slugMatch[1] : '',
    title: titleMatch ? titleMatch[1] : ''
  };
}

// Get all MDX files (including legal)
const mdxFiles = getAllMdxFiles(pagesDir);

// Parse and enrich files with metadata
const filesWithMetadata = mdxFiles.map(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(pagesDir, filePath);
  const metadata = parseFrontmatter(content);
  const isHomepage = relativePath === 'index.mdx' || metadata.slug === '';
  
  return {
    filePath,
    relativePath,
    content,
    priority: isHomepage ? -1 : metadata.priority, // Homepage gets -1 to sort first
    slug: metadata.slug,
    title: metadata.title,
    isHomepage
  };
});

// Sort: homepage first, then by priority (lower = higher priority), then alphabetically
filesWithMetadata.sort((a, b) => {
  // Homepage always first
  if (a.isHomepage && !b.isHomepage) return -1;
  if (!a.isHomepage && b.isHomepage) return 1;
  
  // Then by priority
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  
  // Then alphabetically
  return a.relativePath.localeCompare(b.relativePath);
});

// Combine all files
let combinedContent = `# All MDX Pages Combined - Complete Reference\n\n`;
combinedContent += `*Generated on ${new Date().toISOString()}*\n\n`;
combinedContent += `*Includes: All pages including legal, homepage, and all subdirectories*\n\n`;
combinedContent += `*Sorted: Homepage first, then by priority (lower = higher), then alphabetically*\n\n`;
combinedContent += `**Total files: ${filesWithMetadata.length}**\n\n`;
combinedContent += `---\n\n`;

filesWithMetadata.forEach((file, index) => {
  const pathParts = file.relativePath.split(path.sep);
  const folderPath = pathParts.slice(0, -1).join('/');
  
  // Special header for homepage
  if (file.isHomepage) {
    combinedContent += `## 🏠 HOMEPAGE - ${file.relativePath}\n\n`;
    combinedContent += `*Priority: Homepage (always first)*\n\n`;
    
    // Include the MDX structure
    combinedContent += `### MDX Structure:\n\n`;
    combinedContent += `\`\`\`mdx\n${file.content}\n\`\`\`\n\n`;
    
    // Include actual homepage content from config
    const landingConfigPath = path.join(__dirname, 'src', 'config', 'landing.ts');
    if (fs.existsSync(landingConfigPath)) {
      combinedContent += `### Actual Homepage Content (from src/config/landing.ts):\n\n`;
      const configContent = fs.readFileSync(landingConfigPath, 'utf-8');
      combinedContent += `\`\`\`typescript\n${configContent}\n\`\`\`\n\n`;
    }
  } else {
    combinedContent += `## ${index + 1}. ${file.relativePath}\n\n`;
    if (file.title) {
      combinedContent += `*Title: ${file.title}*\n`;
    }
    combinedContent += `*Priority: ${file.priority === 999 ? 'Not set' : file.priority}*\n`;
    if (folderPath) {
      combinedContent += `*Folder: \`${folderPath}\`*\n`;
    }
    combinedContent += `\n`;
    
    combinedContent += `\`\`\`mdx\n${file.content}\n\`\`\`\n\n`;
  }
  
  combinedContent += `---\n\n`;
});

// Add summary at the end
combinedContent += `\n## Summary\n\n`;
combinedContent += `Total MDX files combined: **${filesWithMetadata.length}**\n\n`;
combinedContent += `### Files by category:\n\n`;

// Group files by category
const categories = {};
filesWithMetadata.forEach(file => {
  const parts = file.relativePath.split(path.sep);
  const category = parts.length > 1 ? parts[0] : 'root';
  if (!categories[category]) {
    categories[category] = [];
  }
  categories[category].push(file.relativePath);
});

Object.keys(categories).sort().forEach(category => {
  combinedContent += `#### ${category === 'root' ? 'Root pages' : category}\n`;
  categories[category].forEach(file => {
    combinedContent += `- \`${file}\`\n`;
  });
  combinedContent += `\n`;
});

// Write to output file
fs.writeFileSync(outputFile, combinedContent, 'utf-8');

console.log(`✅ Combined ${filesWithMetadata.length} MDX files into ${outputFile}`);
console.log(`\n📋 Order: Homepage first, then by priority`);
const homepage = filesWithMetadata.find(f => f.isHomepage);
if (homepage) {
  console.log(`\n🏠 Homepage: ${homepage.relativePath} (Priority: Homepage)`);
}
console.log(`\n📊 Files by priority:`);
const byPriority = {};
filesWithMetadata.filter(f => !f.isHomepage).forEach(file => {
  const p = file.priority === 999 ? 'No priority' : `Priority ${file.priority}`;
  if (!byPriority[p]) byPriority[p] = [];
  byPriority[p].push(file.relativePath);
});
Object.keys(byPriority).sort().forEach(priority => {
  console.log(`\n${priority}: ${byPriority[priority].length} files`);
  byPriority[priority].forEach(file => {
    console.log(`  - ${file}`);
  });
});
console.log(`\nFiles included by category:`);
Object.keys(categories).sort().forEach(category => {
  console.log(`\n${category === 'root' ? 'Root' : category}: ${categories[category].length} files`);
  categories[category].forEach(file => {
    console.log(`  - ${file}`);
  });
});

