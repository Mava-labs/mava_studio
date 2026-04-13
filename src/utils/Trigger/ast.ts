// ast.ts

/**
 * All AST node types produced by the Mava DSL parser.
 */

export type NodeType =
    | 'Program'
    | 'GroupDef'
    | 'NamedTriggerDef'
    | 'TriggerDef'
    | 'EventClause'
    | 'EventSpec'
    | 'Subject'
    | 'ConditionalBody'
    | 'ShortBody'
    | 'WhenBranch'
    | 'ElseBranch'
    | 'BinaryExpr'
    | 'UnaryExpr'
    | 'Comparison'
    | 'Identifier'
    | 'Literal'
    | 'StructuralRef'
    | 'ActionList'
    | 'ShowAction'
    | 'HideAction'
    | 'EnableAction'
    | 'DisableAction'
    | 'HighlightAction'
    | 'PlayAction'
    | 'PauseAction'
    | 'ResumeAction'
    | 'StopAction'
    | 'FinishAction'
    | 'RunAction'
    | 'NavigateAction'
    | 'LockAction'
    | 'UnlockAction'
    | 'SubmitAction'
    | 'WaitAction'
    | 'ExecuteAction'
    | 'TriggerAction'
    | 'AssignAction'

// ─── Base ─────────────────────────────────────────────────────────────────────

export interface BaseNode {
    type: NodeType
    line: number
    col: number
}

// ─── Program ──────────────────────────────────────────────────────────────────

export interface ProgramNode extends BaseNode {
    type: 'Program'
    body: DefinitionNode[]
}

export type DefinitionNode =
    | GroupDefNode
    | NamedTriggerDefNode
    | TriggerDefNode

// ─── Group ────────────────────────────────────────────────────────────────────

export interface GroupDefNode extends BaseNode {
    type: 'GroupDef'
    name: string
    groupKind: 'element' | 'variable'
    // element group  → ids inside []
    // variable group → ids without []
    members: string[]
}

// ─── Named trigger ────────────────────────────────────────────────────────────

export interface NamedTriggerDefNode extends BaseNode {
    type: 'NamedTriggerDef'
    name: string
    body: TriggerBodyNode
}

// ─── Trigger ─────────────────────────────────────────────────────────────────

export interface TriggerDefNode extends BaseNode {
    type: 'TriggerDef'
    body: TriggerBodyNode
}

export interface TriggerBodyNode extends BaseNode {
    type: 'TriggerDef'
    eventClause: EventClauseNode
    rest: ConditionalBodyNode | ShortBodyNode
}

// ─── Event clause ─────────────────────────────────────────────────────────────

export type EventQualifier = 'single' | 'either' | 'all-of'

export interface EventClauseNode extends BaseNode {
    type: 'EventClause'
    qualifier: EventQualifier
    events: EventSpecNode[]
}

export interface EventSpecNode extends BaseNode {
    type: 'EventSpec'
    name: string          // e.g. 'click', 'media.play', 'variable.change'
    subject: SubjectNode | null
}

// ─── Subject ──────────────────────────────────────────────────────────────────

export type SubjectKind =
    | 'element-list'      // [id, id, ...]
    | 'group'             // group_name
    | 'variable'          // plain identifier (variable.change)
    | 'structural-ref'    // {\p page_name}
    | 'key-name'          // keypress [Enter]
    | 'nav-keyword'       // next | prev

export interface SubjectNode extends BaseNode {
    type: 'Subject'
    kind: SubjectKind
    ids: string[]         // for element-list and group
    ref?: StructuralRefNode
}

export interface StructuralRefNode extends BaseNode {
    type: 'StructuralRef'
    refType: 'p' | 'l'        // p = page, l = lesson
    name: string
}

// ─── Trigger body ─────────────────────────────────────────────────────────────

export interface ConditionalBodyNode extends BaseNode {
    type: 'ConditionalBody'
    branches: WhenBranchNode[]
    elseBranch: ElseBranchNode | null
}

export interface WhenBranchNode extends BaseNode {
    type: 'WhenBranch'
    condition: ExprNode
    actions: ActionNode[]
}

export interface ElseBranchNode extends BaseNode {
    type: 'ElseBranch'
    actions: ActionNode[]
}

export interface ShortBodyNode extends BaseNode {
    type: 'ShortBody'
    actions: ActionNode[]
}

// ─── Expressions ─────────────────────────────────────────────────────────────

export type ExprNode =
    | BinaryExprNode
    | UnaryExprNode
    | ComparisonNode
    | IdentifierNode
    | LiteralNode

export interface BinaryExprNode extends BaseNode {
    type: 'BinaryExpr'
    op: 'and' | 'or'
    left: ExprNode
    right: ExprNode
}

export interface UnaryExprNode extends BaseNode {
    type: 'UnaryExpr'
    op: 'not'
    operand: ExprNode
}

export interface ComparisonNode extends BaseNode {
    type: 'Comparison'
    left: ExprNode
    op: '>' | '>=' | '<' | '<=' | '==' | '!='
    right: ExprNode
}

export interface IdentifierNode extends BaseNode {
    type: 'Identifier'
    name: string
}

export type LiteralKind = 'number' | 'time' | 'percent' | 'pixels' | 'string' | 'bool' | 'list' | 'object'

export interface LiteralNode extends BaseNode {
    type: 'Literal'
    kind: LiteralKind
    value: unknown
    raw: string
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type ActionNode =
    | ShowActionNode
    | HideActionNode
    | EnableActionNode
    | DisableActionNode
    | HighlightActionNode
    | PlayActionNode
    | PauseActionNode
    | ResumeActionNode
    | StopActionNode
    | FinishActionNode
    | RunActionNode
    | NavigateActionNode
    | LockActionNode
    | UnlockActionNode
    | SubmitActionNode
    | WaitActionNode
    | ExecuteActionNode
    | TriggerActionNode
    | AssignActionNode

export interface TargetedActionNode extends BaseNode {
    target: SubjectNode
    delay?: LiteralNode   // TIME literal from 'after X'
}

export interface ShowActionNode extends TargetedActionNode { type: 'ShowAction' }
export interface HideActionNode extends TargetedActionNode { type: 'HideAction' }
export interface EnableActionNode extends TargetedActionNode { type: 'EnableAction' }
export interface DisableActionNode extends TargetedActionNode { type: 'DisableAction' }
export interface HighlightActionNode extends TargetedActionNode { type: 'HighlightAction' }
export interface PlayActionNode extends TargetedActionNode { type: 'PlayAction' }
export interface PauseActionNode extends TargetedActionNode { type: 'PauseAction' }
export interface ResumeActionNode extends TargetedActionNode { type: 'ResumeAction' }
export interface StopActionNode extends TargetedActionNode { type: 'StopAction' }
export interface FinishActionNode extends TargetedActionNode { type: 'FinishAction' }
export interface RunActionNode extends TargetedActionNode { type: 'RunAction' }
export interface LockActionNode extends TargetedActionNode { type: 'LockAction' }
export interface UnlockActionNode extends TargetedActionNode { type: 'UnlockAction' }
export interface SubmitActionNode extends TargetedActionNode { type: 'SubmitAction' }

export interface NavigateActionNode extends BaseNode {
    type: 'NavigateAction'
    target: SubjectNode
    delay?: LiteralNode
}

export interface WaitActionNode extends BaseNode {
    type: 'WaitAction'
    duration: LiteralNode    // TIME literal
}

export interface ExecuteActionNode extends BaseNode {
    type: 'ExecuteAction'
    scriptName: string
}

export interface TriggerActionNode extends BaseNode {
    type: 'TriggerAction'
    triggerName: string
}

export type AssignOp = '=' | '+=' | '-='

export interface AssignActionNode extends BaseNode {
    type: 'AssignAction'
    variable: string
    op: AssignOp
    value: ExprNode
}