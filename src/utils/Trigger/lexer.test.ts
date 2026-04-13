import { lex, TokenType } from './lexer'
import { parse } from './parser'
import { ProjectRegistry, validate } from './validator'
// import { usePagesStore } from '../../stores/pages'
// import { useVariableStore } from '../../stores/variables'
// import { useProjectMetadataStore } from '../../stores/projectMetadata'


// const pagesStore = usePagesStore()
// const varStore = useVariableStore()
// const projectStore = useProjectMetadataStore()

const src = `
// simple click trigger
on click [next_button]
  show [tooltip]
  wait 1.5s
end
`

const src2 = `
on click [next_button]
    when attempts > 3
    then
        disable [quiz_button]
        show [warning_popup] after 1s
    elsewhen attempts == 0
    then
        enable [quiz_button]
    else
        hide [warning_popup]
end
`

const source = `
on click [next_button]
when attempts > 3
then
  disable [quiz_button]
  show [warning_popup] after 1s
end
`

// const registry: ProjectRegistry = {
//     elements: pagesStore.getActivePageData()?.elements ?? {},
//     variables: varStore.definitions,
//     scripts: projectStore.actionScripts,
//     namedTriggers: new Set(),
//     pages: new Set(Object.keys(projectStore.pageMetaById)),
//     lessons: new Set(Object.keys(projectStore.lessonsById)),
// }

const { tokens, diagnostics: lexDiags } = lex(source)
const { ast, diagnostics: parseDiags } = parse(tokens)
// const { diagnostics: validDiags } = validate(ast, registry)

const allDiagnostics = [...lexDiags, ...parseDiags]



console.log(tokens.filter(t => t.type !== TokenType.NEWLINE))
console.log('Diagnostics:', allDiagnostics)
console.log('Ast: ', ast)