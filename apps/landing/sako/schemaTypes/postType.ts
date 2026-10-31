import {defineField, defineType} from 'sanity'

export const postType = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'title'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      type: 'text',
      title: 'Excerpt',
      description: 'Brief description of the post'
    }),
    defineField({
      name: 'metaDescription',
      type: 'text',
      title: 'Meta Description',
      description: 'SEO description (override excerpt). 150-160 chars.'
    }),
    defineField({
      name: 'keywords',
      type: 'array',
      of: [{ type: 'string' }],
      title: 'Keywords',
      description: 'SEO keywords for this post'
    }),
    defineField({
      name: 'category',
      type: 'string',
      title: 'Category',
      options: {
        list: [
          'ROI & Revenue',
          'Agency Comparison',
          'Design Ops',
          'B2B Marketing',
          'Motion',
          'Growth',
          'Process',
          'Comparison',
          'Informational',
        ]
      }
    }),
    defineField({
      name: 'image',
      type: 'image',
      title: 'Featured Image',
      options: {
        hotspot: true
      }
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        {type: 'block'},
        {
          type: 'object',
          name: 'tableBlock',
          title: 'Table',
          fields: [
            {
              name: 'rows',
              title: 'Rows',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'tableRow',
                  title: 'Row',
                  fields: [
                    {
                      name: 'cells',
                      title: 'Cells',
                      type: 'array',
                      of: [{type: 'string'}],
                    },
                  ],
                  preview: {
                    select: { cells: 'cells' },
                    prepare({ cells }: { cells?: string[] }) {
                      return { title: (cells ?? []).join(' | ') || 'Row' }
                    },
                  },
                },
              ],
            },
          ],
          preview: {
            prepare() { return { title: 'Table' } },
          },
        },
      ],
      title: 'Content'
    }),
    defineField({
      name: 'published',
      type: 'boolean',
      title: 'Published',
      initialValue: false,
      description: 'Set to true to publish this post'
    }),
  ],
})