import type { ReactNode } from 'react'

import { Renderer as RawRenderer } from '../../node_modules/@openuidev/react-lang/dist/Renderer.js'
import { createLibrary as rawCreateLibrary, defineComponent as rawDefineComponent } from '../../node_modules/@openuidev/react-lang/dist/library.js'
import { createParser as rawCreateParser } from '../../node_modules/@openuidev/react-lang/dist/parser/index.js'
import * as z4 from '../../node_modules/@openuidev/react-lang/node_modules/zod/v4/index.js'

export interface OpenUiNode<P = Record<string, unknown>> {
  type: 'element'
  typeName: string
  props: P
  partial: boolean
}

export interface OpenUiParseResult {
  root: OpenUiNode | null
  meta: {
    incomplete: boolean
    unresolved: string[]
    statementCount: number
    validationErrors: Array<{
      component: string
      path: string
      message: string
    }>
  }
}

export interface OpenUiComponentRenderProps<P> {
  props: P
  renderNode: (value: unknown) => ReactNode
}

export const z = z4 as typeof z4

export const defineComponent = rawDefineComponent as <P>(config: {
  name: string
  props: unknown
  description: string
  component: (props: OpenUiComponentRenderProps<P>) => ReactNode
}) => {
  name: string
  props: unknown
  description: string
  component: (props: OpenUiComponentRenderProps<P>) => ReactNode
  ref: unknown
}

export const createLibrary = rawCreateLibrary as (input: {
  components: Array<ReturnType<typeof defineComponent>>
  componentGroups?: Array<{ name: string; components: string[]; notes?: string[] }>
  root?: string
}) => {
  prompt: (options?: {
    preamble?: string
    additionalRules?: string[]
    examples?: string[]
  }) => string
  toJSONSchema: () => object
}

export const Renderer = RawRenderer as (props: {
  response: string | null
  library: ReturnType<typeof createLibrary>
  isStreaming?: boolean
  onParseResult?: (result: OpenUiParseResult | null) => void
}) => ReactNode

export const createParser = rawCreateParser as (schema: object) => {
  parse: (input: string) => OpenUiParseResult
}
