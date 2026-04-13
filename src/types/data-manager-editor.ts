import type { NumericWireKind } from '@/generated/classes'

export type SchemaNodeKind = 'object' | 'array' | 'boolean' | 'string' | 'number' | 'enum' | 'unknown'

export type EnumOption = {
  name: string
  value: number | string
}

type SchemaBase = {
  kind: SchemaNodeKind
  nullable: boolean
  readOnly?: boolean
  typeName?: string
  intType?: NumericWireKind
}

export type SchemaField = {
  key: string
  index: number | null
  node: SchemaNode
}

export type SchemaObjectNode = SchemaBase & {
  kind: 'object'
  fields: SchemaField[]
}

export type SchemaArrayNode = SchemaBase & {
  kind: 'array'
  element: SchemaNode
}

export type SchemaBooleanNode = SchemaBase & {
  kind: 'boolean'
}

export type SchemaStringNode = SchemaBase & {
  kind: 'string'
}

export type SchemaNumberNode = SchemaBase & {
  kind: 'number'
}

export type SchemaEnumNode = SchemaBase & {
  kind: 'enum'
  options: EnumOption[]
}

export type SchemaUnknownNode = SchemaBase & {
  kind: 'unknown'
  reason: string
}

export type SchemaNode = SchemaObjectNode | SchemaArrayNode | SchemaBooleanNode | SchemaStringNode | SchemaNumberNode | SchemaEnumNode | SchemaUnknownNode

export type ValidationIssue = {
  code: string
  path: string
  message: string
}

export type ValidationErrorMap = Record<string, ValidationIssue[]>
