import { PortableText, PortableTextComponents } from '@portabletext/react';
import { createImageUrlBuilder } from '@sanity/image-url';
import { client } from '@/sanity/client';
import { toId, blockText } from '@/lib/blog-helpers';

/** Build a _key → stable human-readable ID map using the same dedup logic as extractHeadings */
function buildHeadingIdMap(content: any[]): Map<string, string> {
  const seenIds = new Map<string, number>();
  const map = new Map<string, string>();
  for (const block of content ?? []) {
    if (block._type === 'block' && ['h2', 'h3', 'h4'].includes(block.style ?? '')) {
      const text = (block.children ?? []).map((c: any) => c.text ?? '').join('');
      const baseId = toId(text);
      const count = seenIds.get(baseId) ?? 0;
      seenIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      if (block._key) map.set(block._key, id);
    }
  }
  return map;
}

const { projectId, dataset } = client.config();
const urlFor = (source: any) =>
  projectId && dataset
    ? createImageUrlBuilder({ projectId, dataset }).image(source)
    : null;

function makeComponents(headingIds: Map<string, string>): PortableTextComponents {
  return {
  block: {
    // Heading IDs use toId(text) with dedup — same logic as extractHeadings in blog-helpers.ts.
    h2: ({ value, children }) => {
      const id = headingIds.get((value as any)._key) ?? toId(blockText(value as any));
      return (
        <h2 id={id} className="scroll-mt-32 font-bold tracking-tight text-gray-900">
          {children}
        </h2>
      );
    },
    h3: ({ value, children }) => {
      const id = headingIds.get((value as any)._key) ?? toId(blockText(value as any));
      return (
        <h3 id={id} className="scroll-mt-32 font-bold tracking-tight text-gray-900">
          {children}
        </h3>
      );
    },
    h4: ({ value, children }) => {
      const id = headingIds.get((value as any)._key) ?? toId(blockText(value as any));
      return (
        <h4 id={id} className="scroll-mt-32 font-semibold text-gray-900">
          {children}
        </h4>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[#9AE83E] pl-6 italic text-gray-700 bg-gray-50/50 py-2 pr-4 rounded-r-xl my-8">
        {children}
      </blockquote>
    ),
  },

  marks: {
    link: ({ value, children }) => {
      const isExternal = (value?.href ?? '').startsWith('http');
      return (
        <a
          href={value?.href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-[#1a8a00] font-semibold underline decoration-[#9AE83E]/50 underline-offset-4 hover:decoration-[#1a8a00] transition-colors"
        >
          {children}
        </a>
      );
    },
    code: ({ children }) => (
      <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-sm font-medium text-gray-800 before:hidden after:hidden">
        {children}
      </code>
    ),
  },

  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      const imageUrl = urlFor(value.asset)?.width(1000).fit('max').url();
      return (
        <figure className="my-12">
          <img
            src={imageUrl ?? ''}
            alt={value.alt || ''}
            className="w-full rounded-2xl shadow-sm border border-gray-200"
          />
          {value.caption && (
            <figcaption className="mt-4 text-center text-sm text-gray-500 italic">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
    tableBlock: ({ value }) => {
      const rows: { cells: string[] }[] = value?.rows ?? [];
      if (rows.length === 0) return null;
      const [headerRow, ...bodyRows] = rows;
      return (
        <div className="my-8 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {headerRow.cells.map((cell, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {bodyRows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-gray-50/50'}>
                  {row.cells.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-gray-600 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    },
  },
  };
}

interface BlogContentProps {
  content: any[];
}

/** Strip leftover GFM checkbox markers ([ ] / [x]) from list item text */
function sanitizeContent(content: any[]): any[] {
  return content.map((block) => {
    if (block._type === 'block' && block.listItem && Array.isArray(block.children)) {
      return {
        ...block,
        children: block.children.map((child: any, i: number) => {
          if (i === 0 && child._type === 'span' && typeof child.text === 'string') {
            return { ...child, text: child.text.replace(/^\[[ xX]\]\s*/, '') };
          }
          return child;
        }),
      };
    }
    return block;
  });
}

export function BlogContent({ content }: BlogContentProps) {
  if (!content || !Array.isArray(content)) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Content not available yet.</p>
      </div>
    );
  }

  const clean = sanitizeContent(content);
  const headingIds = buildHeadingIdMap(clean);
  const components = makeComponents(headingIds);
  return <PortableText value={clean} components={components} />;
}