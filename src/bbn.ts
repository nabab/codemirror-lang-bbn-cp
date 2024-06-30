import {LRLanguage, LanguageSupport} from "@codemirror/language"
import {html} from "@codemirror/lang-html"
import {javascriptLanguage} from "@codemirror/lang-javascript"
import {styleTags, tags as t} from "@lezer/highlight"
import {parseMixed, SyntaxNodeRef, Input} from "@lezer/common"
import {parser} from "./bbn.grammar"

const exprParser = javascriptLanguage.parser.configure({
  top: "SingleExpression"
})

const baseParser = parser.configure({
  props: [
    styleTags({
      Text: t.content,
      Is: t.definitionOperator,
      AttributeName: t.attributeName,
      BbnAttributeName: t.keyword,
      Identifier: t.variableName,
      "AttributeValue ScriptAttributeValue": t.attributeValue,
      Entity: t.character,
      "{{ }}": t.brace,
      "@ :": t.punctuation
    })
  ]
})

const exprMixed = {parser: exprParser}

const textParser = baseParser.configure({
  wrap: parseMixed((node, input) => node.name == "InterpolationContent" ? exprMixed : null),
})

const attrParser = baseParser.configure({
  wrap: parseMixed((node, input) => node.name == "AttributeScript" ? exprMixed : null),
  top: "Attribute"
})

const textMixed = {parser: textParser}, attrMixed = {parser: attrParser}

const baseHTML = html()

function makeBbn(base: LRLanguage) {
  return base.configure({
    dialect: "selfClosing",
    wrap: parseMixed(mixBbn)
  }, "bbn")
}

/// A language provider for Bbn templates.
export const bbnLanguage = makeBbn(baseHTML.language as LRLanguage)

function mixBbn(node: SyntaxNodeRef, input: Input) {
  switch (node.name) {
    case "Attribute":
      return /^(@|:|v-|bbn-)/.test(input.read(node.from, node.from + 2)) ? attrMixed : null
    case "Text":
      return textMixed
  }
  return null
}

/// Bbn template support.
export function bbn(config: {
  /// Provide an HTML language configuration to use as a base. _Must_
  /// be the result of calling `html()` from `@codemirror/lang-html`,
  /// not just any `LanguageSupport` object.
  base?: LanguageSupport
} = {}) {
  let base = baseHTML
  if (config.base) {
    if (config.base.language.name != "html" || !(config.base.language instanceof LRLanguage))
      throw new RangeError("The base option must be the result of calling html(...)")
    base = config.base
  }
  return new LanguageSupport(base.language == baseHTML.language ? bbnLanguage : makeBbn(base.language as LRLanguage), [
    base.support,
    base.language.data.of({closeBrackets: {brackets: ["{", '"']}})
  ])
}
