import type {
  EnumOption,
  SchemaField,
  SchemaNode,
  SchemaObjectNode,
  ValidationErrorMap,
  ValidationIssue,
} from '@/types/data-manager-editor'
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv'
import {
  coerceKindedNumber,
  MessagePackObject,
  type NumericWireKind,
} from '@/generated/classes'

type KeyMeta = {
  index: number | null
  nullable: boolean
  intType?: NumericWireKind
  genericRef?: unknown
  typeRef?: unknown
}

type ParsedField = {
  name: string
  designType?: unknown
  keyMeta: KeyMeta
}

type ParsedClass = {
  name: string
  fields: ParsedField[]
}

type RuntimeKeyInfo = {
  index: number | string
  propertyKey: string
  designType?: unknown
  info?: {
    nullable?: boolean
    intType?: NumericWireKind
    generic?: unknown[]
    type?: unknown
  }
}

const runtimeGeneratedModules = import.meta.glob(
  '../generated/classes/*.ts',
  { eager: true },
) as Record<string, Record<string, unknown>>
const generatedSchemaModules = import.meta.glob(
  '../generated/schema/*.schema.json',
  { eager: true, import: 'default' },
) as Record<string, unknown>

const parsedClasses = new Map<string, ParsedClass>()
const enumNames = new Set<string>()
const enumOptionsCache = new Map<string, EnumOption[]>()
const enumValueSetCache = new Map<string, Set<number | string>>()
const objectSchemaCache = new Map<string, SchemaObjectNode>()
let dataManagerAjvValidator: ValidateFunction<unknown> | null | undefined

const parserState = {
  isReady: false,
}

const strictIntKinds = new Set<NumericWireKind>([
  'fixpos',
  'fixneg',
  'u8',
  'u16',
  'u32',
  'u64',
  'i8',
  'i16',
  'i32',
  'i64',
])

function isNonFiniteNumericValue (value: unknown): value is number {
  return typeof value === 'number' && !Number.isFinite(value)
}

function ensureParserReady () {
  if (parserState.isReady) {
    return
  }

  for (const moduleExports of Object.values(runtimeGeneratedModules)) {
    for (const [exportName, exportValue] of Object.entries(moduleExports)) {
      collectRuntimeExport(exportName, exportValue)
    }
  }

  parserState.isReady = true
}

function collectRuntimeExport (exportName: string, exportValue: unknown) {
  if (isRuntimeEnumExport(exportValue)) {
    enumNames.add(exportName)
    return
  }

  if (!isMessagePackConstructor(exportValue)) {
    return
  }

  collectClassMetadata(exportName, exportValue)
}

function collectClassMetadata (
  className: string,
  classConstructor: typeof MessagePackObject,
) {
  const keyEntries = getClassKeyMetadata(classConstructor)
  if (keyEntries.length === 0) {
    return
  }

  const fields: ParsedField[] = keyEntries.map(keyInfo => {
    return {
      name: keyInfo.propertyKey,
      designType: keyInfo.designType,
      keyMeta: toKeyMeta(keyInfo),
    }
  })

  parsedClasses.set(className, {
    name: className,
    fields,
  })
}

function getClassKeyMetadata (
  classConstructor: typeof MessagePackObject,
): RuntimeKeyInfo[] {
  const metadataKeys = Reflect.getMetadataKeys(classConstructor)
  for (const metadataKey of metadataKeys) {
    const metadataValue = Reflect.getMetadata(metadataKey, classConstructor)
    if (!isRuntimeKeyMap(metadataValue)) {
      continue
    }

    return [...metadataValue.values()]
  }

  return []
}

function isRuntimeKeyMap (value: unknown): value is Map<string | number, RuntimeKeyInfo> {
  if (!(value instanceof Map)) {
    return false
  }

  for (const entryValue of value.values()) {
    if (!isRuntimeKeyInfo(entryValue)) {
      return false
    }
  }

  return value.size > 0
}

function isRuntimeKeyInfo (value: unknown): value is RuntimeKeyInfo {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as RuntimeKeyInfo
  return (
    (typeof candidate.index === 'number' || typeof candidate.index === 'string')
    && typeof candidate.propertyKey === 'string'
  )
}

function toKeyMeta (keyInfo: RuntimeKeyInfo): KeyMeta {
  const info = keyInfo.info
  return {
    index: toFieldIndex(keyInfo.index),
    nullable: info?.nullable === true,
    intType: info?.intType,
    genericRef: info?.generic?.[0],
    typeRef: info?.type,
  }
}

function toFieldIndex (value: string | number): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  if (!/^-?\d+$/.test(value)) {
    return null
  }

  return Number.parseInt(value, 10)
}

function isRuntimeEnumExport (value: unknown): value is Record<string, string | number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    return false
  }

  let hasNamedEntries = false
  let hasNumericReverseMap = false

  for (const [entryKey, entryValue] of entries) {
    if (typeof entryValue !== 'string' && typeof entryValue !== 'number') {
      return false
    }

    const isNumericKey = !Number.isNaN(Number(entryKey))
    if (isNumericKey) {
      if (typeof entryValue === 'string') {
        hasNumericReverseMap = true
      }
      continue
    }

    hasNamedEntries = true
  }

  return hasNamedEntries && (hasNumericReverseMap || entries.every(([, entryValue]) => {
    return typeof entryValue === 'string'
  }))
}

function isMessagePackConstructor (value: unknown): value is typeof MessagePackObject {
  if (typeof value !== 'function') {
    return false
  }

  return value === MessagePackObject || value.prototype instanceof MessagePackObject
}

function isTypeFactory (value: unknown): value is (() => unknown) {
  if (typeof value !== 'function') {
    return false
  }

  return !Object.prototype.hasOwnProperty.call(value, 'prototype')
}

function resolveTypeRef (typeRef: unknown): unknown {
  if (!isTypeFactory(typeRef)) {
    return typeRef
  }

  try {
    return typeRef()
  } catch {
    return undefined
  }
}

function resolveTypeName (typeRef: unknown): string {
  const resolved = resolveTypeRef(typeRef)
  if (typeof resolved === 'string') {
    return resolved.trim()
  }

  if (typeof resolved === 'function') {
    return resolved.name
  }

  return ''
}

function isArrayType (typeRef: unknown): boolean {
  const resolved = resolveTypeRef(typeRef)
  return resolved === Array || resolveTypeName(typeRef) === 'Array'
}

function cloneNodeWithNullable (node: SchemaNode, nullable: boolean): SchemaNode {
  return {
    ...node,
    nullable,
  } as SchemaNode
}

function getEnumOptions (enumName: string): EnumOption[] {
  const cached = enumOptionsCache.get(enumName)
  if (cached) {
    return cached
  }

  const enumExport = findRuntimeExport(enumName)
  if (!enumExport || typeof enumExport !== 'object') {
    enumOptionsCache.set(enumName, [])
    return []
  }

  const options: EnumOption[] = []
  for (const [key, value] of Object.entries(enumExport as Record<string, unknown>)) {
    if (!Number.isNaN(Number(key))) {
      continue
    }

    if (typeof value === 'number' || typeof value === 'string') {
      options.push({
        name: key,
        value,
      })
    }
  }

  options.sort((a, b) => {
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      return a.value - b.value
    }

    return a.name.localeCompare(b.name)
  })

  enumOptionsCache.set(enumName, options)
  return options
}

function getEnumValueSet (enumName: string): Set<number | string> {
  const cached = enumValueSetCache.get(enumName)
  if (cached) {
    return cached
  }

  const nextSet = new Set<number | string>(getEnumOptions(enumName).map(option => option.value))
  enumValueSetCache.set(enumName, nextSet)
  return nextSet
}

function findRuntimeExport (exportName: string): unknown {
  for (const moduleExports of Object.values(runtimeGeneratedModules)) {
    if (exportName in moduleExports) {
      return moduleExports[exportName]
    }
  }

  return undefined
}

function buildClassObjectNode (
  className: string,
  stack: string[],
): SchemaObjectNode {
  const cached = objectSchemaCache.get(className)
  if (cached) {
    return cached
  }

  if (stack.includes(className)) {
    return {
      kind: 'object',
      nullable: false,
      readOnly: true,
      typeName: className,
      fields: [],
    }
  }

  const parsedClass = parsedClasses.get(className)
  if (!parsedClass) {
    return {
      kind: 'object',
      nullable: false,
      readOnly: true,
      typeName: className,
      fields: [],
    }
  }

  const placeholder: SchemaObjectNode = {
    kind: 'object',
    nullable: false,
    typeName: className,
    fields: [],
  }
  objectSchemaCache.set(className, placeholder)

  const nextStack = [...stack, className]
  const fields = parsedClass.fields.map<SchemaField>(field => {
    return {
      key: field.name,
      index: field.keyMeta.index,
      node: buildNodeFromField(field, nextStack),
    }
  })

  fields.sort((a, b) => {
    if (a.index === null && b.index === null) {
      return a.key.localeCompare(b.key)
    }

    if (a.index === null) {
      return 1
    }

    if (b.index === null) {
      return -1
    }

    if (a.index === b.index) {
      return a.key.localeCompare(b.key)
    }

    return a.index - b.index
  })

  placeholder.fields = fields
  return placeholder
}

function buildNodeFromField (field: ParsedField, stack: string[]): SchemaNode {
  const isNullable = field.keyMeta.nullable
  const resolvedTypeRef = field.keyMeta.typeRef ?? field.designType

  if (isArrayType(resolvedTypeRef)) {
    const elementTypeName = resolveTypeName(field.keyMeta.genericRef) || 'unknown'
    const elementNode: SchemaNode = field.keyMeta.genericRef
      ? buildNamedNode(field.keyMeta.genericRef, {
          nullable: false,
          intType: field.keyMeta.intType,
        }, stack)
      : {
          kind: 'unknown',
          nullable: false,
          typeName: 'unknown',
          readOnly: true,
          reason: 'Unable to resolve array element type from metadata',
        }

    return {
      kind: 'array',
      nullable: isNullable,
      typeName: `${elementTypeName}[]`,
      element: elementNode,
    }
  }

  return buildNamedNode(resolvedTypeRef, {
    nullable: isNullable,
    intType: field.keyMeta.intType,
  }, stack)
}

function buildNamedNode (
  typeRef: unknown,
  options: { nullable: boolean, intType?: NumericWireKind },
  stack: string[],
): SchemaNode {
  const resolvedTypeRef = resolveTypeRef(typeRef)
  const normalizedType = resolveTypeName(typeRef)

  if (!normalizedType) {
    return {
      kind: 'unknown',
      nullable: options.nullable,
      typeName: 'unknown',
      readOnly: true,
      reason: 'Unable to resolve type from metadata',
    }
  }

  if (resolvedTypeRef === Boolean || normalizedType === 'boolean' || normalizedType === 'Boolean') {
    return {
      kind: 'boolean',
      nullable: options.nullable,
      typeName: normalizedType,
    }
  }

  if (resolvedTypeRef === String || normalizedType === 'string' || normalizedType === 'String') {
    return {
      kind: 'string',
      nullable: options.nullable,
      typeName: normalizedType,
    }
  }

  if (
    resolvedTypeRef === Number
    || resolvedTypeRef === BigInt
    || normalizedType === 'number'
    || normalizedType === 'Number'
    || normalizedType === 'bigint'
    || normalizedType === 'BigInt'
  ) {
    return {
      kind: 'number',
      nullable: options.nullable,
      typeName: normalizedType,
      intType: options.intType,
    }
  }

  if (resolvedTypeRef === Date || normalizedType === 'Date') {
    return {
      kind: 'string',
      nullable: options.nullable,
      typeName: normalizedType,
      readOnly: true,
    }
  }

  if (normalizedType === 'any' || normalizedType === 'unknown' || normalizedType === 'Object') {
    return {
      kind: 'unknown',
      nullable: options.nullable,
      typeName: normalizedType,
      readOnly: true,
      reason: `Unsupported type: ${normalizedType}`,
    }
  }

  if (enumNames.has(normalizedType)) {
    return {
      kind: 'enum',
      nullable: options.nullable,
      typeName: normalizedType,
      intType: options.intType,
      options: getEnumOptions(normalizedType),
    }
  }

  if (typeof resolvedTypeRef === 'function' && parsedClasses.has(resolvedTypeRef.name)) {
    return cloneNodeWithNullable(
      buildClassObjectNode(resolvedTypeRef.name, stack),
      options.nullable,
    )
  }

  if (parsedClasses.has(normalizedType)) {
    return cloneNodeWithNullable(
      buildClassObjectNode(normalizedType, stack),
      options.nullable,
    )
  }

  return {
    kind: 'unknown',
    nullable: options.nullable,
    typeName: normalizedType,
    readOnly: true,
    reason: `Unable to resolve type: ${normalizedType}`,
  }
}

export function getDataManagerSchema (): SchemaObjectNode {
  ensureParserReady()
  const rootNode = buildClassObjectNode('DataManager', [])
  return cloneNodeWithNullable(rootNode, false) as SchemaObjectNode
}

function getGeneratedDataManagerSchema (): Record<string, unknown> | null {
  for (const [path, schemaValue] of Object.entries(generatedSchemaModules)) {
    if (!path.endsWith('/DataManager.schema.json')) {
      continue
    }

    if (schemaValue && typeof schemaValue === 'object') {
      return schemaValue as Record<string, unknown>
    }
  }

  return null
}

function getDataManagerAjvValidator (): ValidateFunction<unknown> | null {
  if (dataManagerAjvValidator !== undefined) {
    return dataManagerAjvValidator
  }

  const jsonSchema = getGeneratedDataManagerSchema()
  if (!jsonSchema) {
    dataManagerAjvValidator = null
    return dataManagerAjvValidator
  }

  try {
    const ajv = new Ajv({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
      strictNumbers: false,
      validateFormats: false,
    })
    dataManagerAjvValidator = ajv.compile(jsonSchema)
  } catch {
    dataManagerAjvValidator = null
  }

  return dataManagerAjvValidator
}

export function hasDataManagerAjvSchema (): boolean {
  return getDataManagerAjvValidator() !== null
}

export function validateDraftByAjvSchema (
  draft: unknown,
  options?: {
    allowNullPaths?: Set<string>
  },
): ValidationIssue[] | null {
  const validator = getDataManagerAjvValidator()
  if (!validator) {
    return null
  }

  const isValid = validator(draft)
  if (isValid || !validator.errors || validator.errors.length === 0) {
    return []
  }

  const issues: ValidationIssue[] = []
  const dedupe = new Set<string>()
  for (const error of validator.errors) {
    if (shouldIgnoreAjvTypeNullError(error, draft, options?.allowNullPaths)) {
      continue
    }

    if (shouldIgnoreAjvEnumNonFiniteError(error, draft)) {
      continue
    }

    const issuePath = getIssuePathFromAjvError(error)
    const code = `ajv.${error.keyword}`
    const message = getAjvErrorMessage(error)
    const dedupeKey = `${issuePath}|${code}|${message}`
    if (dedupe.has(dedupeKey)) {
      continue
    }

    dedupe.add(dedupeKey)
    addIssue(issues, issuePath, code, message)
  }

  return issues
}

function shouldIgnoreAjvTypeNullError (
  error: ErrorObject,
  draft: unknown,
  allowNullPaths?: Set<string>,
): boolean {
  if (!allowNullPaths || error.keyword !== 'type') {
    return false
  }

  const valueAtPath = getValueAtJsonPointer(draft, error.instancePath)
  if (valueAtPath !== null) {
    return false
  }

  const issuePath = toValidationPathFromJsonPointer(error.instancePath)
  return allowNullPaths.has(issuePath)
}

function shouldIgnoreAjvEnumNonFiniteError (
  error: ErrorObject,
  draft: unknown,
): boolean {
  if (error.keyword !== 'enum') {
    return false
  }

  const valueAtPath = getValueAtJsonPointer(draft, error.instancePath)
  return isNonFiniteNumericValue(valueAtPath)
}

function getIssuePathFromAjvError (error: ErrorObject): string {
  const basePath = toValidationPathFromJsonPointer(error.instancePath)
  if (error.keyword === 'required') {
    const requiredParams = error.params as { missingProperty?: unknown }
    if (typeof requiredParams.missingProperty === 'string') {
      return `${basePath}.${requiredParams.missingProperty}`
    }
  }

  if (error.keyword === 'additionalProperties') {
    const additionalPropsParams = error.params as { additionalProperty?: unknown }
    if (typeof additionalPropsParams.additionalProperty === 'string') {
      return `${basePath}.${additionalPropsParams.additionalProperty}`
    }
  }

  return basePath
}

function getAjvErrorMessage (error: ErrorObject): string {
  if (error.keyword === 'enum') {
    const enumParams = error.params as { allowedValues?: unknown }
    if (Array.isArray(enumParams.allowedValues) && enumParams.allowedValues.length > 0) {
      return `Expected one of: ${enumParams.allowedValues.join(', ')}`
    }
  }

  if (error.keyword === 'additionalProperties') {
    return 'Unknown field is not allowed in strict mode'
  }

  return error.message ?? 'Validation failed'
}

function toValidationPathFromJsonPointer (pointer: string): string {
  if (!pointer) {
    return '$'
  }

  const tokens = pointer
    .split('/')
    .slice(1)
    .map(token => decodeJsonPointerToken(token))

  let result = '$'
  for (const token of tokens) {
    result += /^\d+$/.test(token)
      ? `[${token}]`
      : `.${token}`
  }

  return result
}

function decodeJsonPointerToken (token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~')
}

function getValueAtJsonPointer (value: unknown, pointer: string): unknown {
  if (!pointer) {
    return value
  }

  const tokens = pointer
    .split('/')
    .slice(1)
    .map(token => decodeJsonPointerToken(token))

  let cursor: unknown = value
  for (const token of tokens) {
    if (Array.isArray(cursor)) {
      if (!/^\d+$/.test(token)) {
        return undefined
      }

      cursor = cursor[Number.parseInt(token, 10)]
      continue
    }

    if (!cursor || typeof cursor !== 'object') {
      return undefined
    }

    cursor = (cursor as Record<string, unknown>)[token]
  }

  return cursor
}

export function createDefaultValue (
  node: SchemaNode,
  preferNullIfNullable = false,
): unknown {
  if (node.nullable && preferNullIfNullable) {
    return null
  }

  switch (node.kind) {
    case 'boolean': {
      return false
    }
    case 'string': {
      return ''
    }
    case 'number': {
      if (node.intType === 'i64' || node.intType === 'u64') {
        return '0'
      }
      return 0
    }
    case 'enum': {
      return node.options[0]?.value ?? 0
    }
    case 'array': {
      return []
    }
    case 'object': {
      return {}
    }
    case 'unknown': {
      return null
    }
  }
}

function addIssue (
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
) {
  issues.push({
    path,
    code,
    message,
  })
}

function validateNumericValue (
  value: unknown,
  node: Extract<SchemaNode, { kind: 'number' }>,
  path: string,
  issues: ValidationIssue[],
) {
  if (!node.intType) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      addIssue(issues, path, 'number.invalid', 'Expected a finite number')
    }
    return
  }

  if (strictIntKinds.has(node.intType) && typeof value === 'string' && value.trim() === '') {
    addIssue(issues, path, 'number.invalid', `Expected ${node.intType} value`)
    return
  }

  try {
    coerceKindedNumber(value, node.intType, path)
  } catch (error) {
    addIssue(
      issues,
      path,
      'number.invalid',
      error instanceof Error ? error.message : `Expected ${node.intType} value`,
    )
  }
}

function validateEnumValue (
  value: unknown,
  node: Extract<SchemaNode, { kind: 'enum' }>,
  path: string,
  issues: ValidationIssue[],
) {
  if (isNonFiniteNumericValue(value)) {
    return
  }

  const allowedValues = new Set(node.options.map(option => option.value))
  if (!allowedValues.has(value as never)) {
    addIssue(
      issues,
      path,
      'enum.invalid',
      `Expected one of: ${node.options.map(option => `${option.name} (${option.value})`).join(', ')}`,
    )
  }
}

function isVectorWireShape (
  node: Extract<SchemaNode, { kind: 'object' }>,
  value: unknown[],
): boolean {
  const vectorTypeSet = new Set(['Vector2', 'Vector3', 'Vector2Int', 'Vector3Int'])
  if (!node.typeName || !vectorTypeSet.has(node.typeName)) {
    return false
  }

  if (value.length !== node.fields.length) {
    return false
  }

  return true
}

function validateNode (
  value: unknown,
  node: SchemaNode,
  path: string,
  issues: ValidationIssue[],
  options?: {
    allowNullPaths?: Set<string>
  },
) {
  if (value === undefined) {
    return
  }

  if (value === null) {
    const isAllowedBySnapshot = options?.allowNullPaths?.has(path) ?? false
    if (!node.nullable && !isAllowedBySnapshot) {
      addIssue(issues, path, 'value.null', 'Null is not allowed')
    }
    return
  }

  switch (node.kind) {
    case 'boolean': {
      if (typeof value !== 'boolean') {
        addIssue(issues, path, 'boolean.invalid', 'Expected boolean')
      }
      return
    }
    case 'string': {
      if (typeof value !== 'string') {
        addIssue(issues, path, 'string.invalid', 'Expected string')
      }
      return
    }
    case 'number': {
      validateNumericValue(value, node, path, issues)
      return
    }
    case 'enum': {
      validateEnumValue(value, node, path, issues)
      return
    }
    case 'array': {
      if (!Array.isArray(value)) {
        addIssue(issues, path, 'array.invalid', 'Expected array')
        return
      }

      for (const [index, item] of value.entries()) {
        validateNode(item, node.element, `${path}[${index}]`, issues, options)
      }
      return
    }
    case 'object': {
      if (Array.isArray(value)) {
        if (isVectorWireShape(node, value)) {
          for (const [index, field] of node.fields.entries()) {
            validateNode(value[index], field.node, `${path}[${index}]`, issues, options)
          }
          return
        }

        addIssue(issues, path, 'object.invalid', 'Expected object')
        return
      }

      if (typeof value !== 'object') {
        addIssue(issues, path, 'object.invalid', 'Expected object')
        return
      }

      const objectValue = value as Record<string, unknown>
      const knownFieldSet = new Set<string>()
      for (const field of node.fields) {
        knownFieldSet.add(field.key)
        validateNode(objectValue[field.key], field.node, `${path}.${field.key}`, issues, options)
      }

      for (const key of Object.keys(objectValue)) {
        if (knownFieldSet.has(key)) {
          continue
        }

        if (key.startsWith('__UNKNOWN_')) {
          continue
        }

        addIssue(
          issues,
          `${path}.${key}`,
          'field.unknown',
          'Unknown field is not allowed in strict mode',
        )
      }
      return
    }
    case 'unknown': {
      return
    }
  }
}

export function validateDraftBySchema (
  draft: unknown,
  rootNode: SchemaNode,
  options?: {
    allowNullPaths?: Set<string>
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  validateNode(draft, rootNode, '$', issues, options)
  return issues
}

export function toValidationErrorMap (issues: ValidationIssue[]): ValidationErrorMap {
  const map: ValidationErrorMap = {}
  for (const issue of issues) {
    if (!map[issue.path]) {
      map[issue.path] = []
    }
    map[issue.path].push(issue)
  }
  return map
}

type InferredEnumArrayRule = {
  enumName: string
  path: string
  tokens: Array<string | number>
}

const inferredEnumRuleCache = new WeakMap<object, InferredEnumArrayRule[]>()

export function validateDraftByInferredEnums (
  draft: unknown,
  sourceSnapshot: unknown,
): ValidationIssue[] {
  ensureParserReady()
  const rules = getInferredEnumArrayRules(sourceSnapshot)
  if (rules.length === 0) {
    return []
  }

  const issues: ValidationIssue[] = []
  for (const rule of rules) {
    const draftValue = getValueByPathTokens(draft, rule.tokens)
    if (!Array.isArray(draftValue)) {
      continue
    }

    const allowedValues = getEnumValueSet(rule.enumName)
    for (const [index, item] of draftValue.entries()) {
      if (item === null || item === undefined) {
        continue
      }

      if (typeof item !== 'number' && typeof item !== 'string') {
        continue
      }

      if (isNonFiniteNumericValue(item)) {
        continue
      }

      if (!allowedValues.has(item)) {
        addIssue(
          issues,
          `${rule.path}[${index}]`,
          'enum.invalid',
          `Expected one of inferred ${rule.enumName} values`,
        )
      }
    }
  }

  return issues
}

function getInferredEnumArrayRules (sourceSnapshot: unknown): InferredEnumArrayRule[] {
  if (!sourceSnapshot || typeof sourceSnapshot !== 'object') {
    return []
  }

  const cached = inferredEnumRuleCache.get(sourceSnapshot)
  if (cached) {
    return cached
  }

  const rules: InferredEnumArrayRule[] = []
  collectInferredEnumArrayRules(sourceSnapshot, '$', [], rules)
  inferredEnumRuleCache.set(sourceSnapshot, rules)
  return rules
}

function collectInferredEnumArrayRules (
  value: unknown,
  path: string,
  tokens: Array<string | number>,
  out: InferredEnumArrayRule[],
) {
  if (Array.isArray(value)) {
    const enumName = inferEnumNameFromArrayValues(value)
    if (enumName) {
      out.push({
        enumName,
        path,
        tokens,
      })
    }

    for (const [index, item] of value.entries()) {
      collectInferredEnumArrayRules(item, `${path}[${index}]`, [...tokens, index], out)
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    collectInferredEnumArrayRules(nestedValue, `${path}.${key}`, [...tokens, key], out)
  }
}

function inferEnumNameFromArrayValues (value: unknown[]): string | null {
  if (value.length === 0) {
    return null
  }

  const uniquePrimitiveValues = new Set<number | string>()
  for (const item of value) {
    if (typeof item !== 'number' && typeof item !== 'string') {
      return null
    }

    uniquePrimitiveValues.add(item)
  }

  if (uniquePrimitiveValues.size === 0) {
    return null
  }

  const candidates: string[] = []
  for (const enumName of enumNames) {
    const allowed = getEnumValueSet(enumName)
    if (allowed.size === 0) {
      continue
    }

    let isSubset = true
    for (const item of uniquePrimitiveValues) {
      if (!allowed.has(item)) {
        isSubset = false
        break
      }
    }

    if (isSubset) {
      candidates.push(enumName)
      if (candidates.length > 1) {
        return null
      }
    }
  }

  return candidates[0] ?? null
}

function getValueByPathTokens (
  value: unknown,
  tokens: Array<string | number>,
): unknown {
  let cursor: unknown = value
  for (const token of tokens) {
    if (typeof token === 'number') {
      if (!Array.isArray(cursor)) {
        return undefined
      }

      cursor = cursor[token]
      continue
    }

    if (!cursor || typeof cursor !== 'object') {
      return undefined
    }

    cursor = (cursor as Record<string, unknown>)[token]
  }

  return cursor
}

export function getF32RoundedValue (value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.fround(value)
}

export function isUnknownKey (key: string): boolean {
  return key.startsWith('__UNKNOWN_')
}

export function stripUndefinedDeep<T = unknown> (value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefinedDeep(item)) as T
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) {
        continue
      }

      output[key] = stripUndefinedDeep(nestedValue)
    }
    return output as T
  }

  return value
}
