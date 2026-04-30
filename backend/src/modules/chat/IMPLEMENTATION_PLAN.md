# Hybrid Chatbot Implementation Plan

## Overview
Transform the current rigid FSM-based chatbot into a hybrid system that combines structured booking flow with flexible AI-powered conversation.

## Current Problems
1. FSM only triggers on specific keywords ("захиалах", "booking")
2. Strict validation shows error messages instead of using AI
3. No intelligent switching between FSM and AI modes
4. Users can't ask questions during booking process

## Solution Architecture

### 1. Input Classifier (`inputClassifier.ts`)
**Purpose**: Determine if input is structured or conversational

**Responsibilities**:
- Classify input as STRUCTURED or CONVERSATIONAL
- Detect intent (booking, question, greeting, etc.)
- Extract structured data (numbers, dates, selections)
- Identify FSM trigger keywords

**Key Functions**:
- `classifyInput(message: string, currentState: BotState): InputClassification`
- `isStructuredInput(message: string, expectedFormat: ExpectedFormat): boolean`
- `extractIntent(message: string): Intent`
- `detectFSMTrigger(message: string): boolean`

### 2. Hybrid Router (`hybridRouter.ts`)
**Purpose**: Intelligently route between FSM and AI

**Responsibilities**:
- Decide whether to use FSM or AI based on input classification
- Maintain conversation context and state
- Handle fallback scenarios
- Coordinate between FSM and AI responses

**Key Functions**:
- `routeMessage(message: string, context: ChatContext): RouteDecision`
- `shouldUseFSM(classification: InputClassification, context: ChatContext): boolean`
- `shouldUseAI(classification: InputClassification, context: ChatContext): boolean`
- `handleHybridResponse(fsmResult: FSMResponse, aiResult: AIResponse): HybridResponse`

### 3. Enhanced FSM Service (`enhancedFsm.service.ts`)
**Purpose**: Flexible state machine with AI fallback

**Responsibilities**:
- Handle structured inputs in each state
- Fall back to AI for conversational inputs
- Maintain booking context
- Provide helpful error messages via AI

**Key Functions**:
- `processMessage(message: string, context: ChatContext): EnhancedFSMResponse`
- `handleStateWithFallback(message: string, state: BotState, context: ChatContext): Promise<FSMResponse>`
- `generateAIHelpForState(state: BotState, userInput: string): Promise<string>`
- `validateStructuredInput(message: string, state: BotState): ValidationResult`

### 4. AI Context Manager (`aiContextManager.ts`)
**Purpose**: Keep AI aware of conversation state

**Responsibilities**:
- Build context-aware prompts for AI
- Include current FSM state in AI prompts
- Format booking data for AI understanding
- Maintain conversation history

**Key Functions**:
- `buildAIContext(context: ChatContext, message: string): AIContext`
- `formatBookingDataForAI(context: ChatContext): string`
- `generateStateAwarePrompt(state: BotState, message: string): string`
- `includeConversationHistory(history: Message[]): string`

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create input classifier
2. Create hybrid router
3. Update types and interfaces

### Phase 2: Enhanced FSM
1. Refactor existing FSM service
2. Add AI fallback capabilities
3. Improve validation logic

### Phase 3: AI Integration
1. Create AI context manager
2. Update Gemini client prompts
3. Add state-aware AI responses

### Phase 4: Integration & Testing
1. Update chat routes
2. Integrate all components
3. Test various scenarios
4. Handle edge cases

## Key Design Decisions

### Input Classification Logic
```typescript
// Structured inputs:
- Numbers: "1", "2", "3" (for selections)
- Dates: "2026-06-01", "2026/06/01" (for dates)
- Yes/No: "тийм", "үгүй", "yes", "no"
- Specific keywords: "захиалах", "booking"

// Conversational inputs:
- Questions: "ямар вэ?", "how much?", "what is...?"
- Greetings: "сайн байна уу", "hi", "hello"
- General statements: "хямд аялал хайж байна"
- Unclear inputs: anything that doesn't match structured patterns
```

### FSM State Transitions
```typescript
// Current state -> Input classification -> Next action
IDLE + FSM trigger -> START_BOOKING_FLOW
IDLE + Conversational -> AI_RESPONSE
WAITING_FOR_TOUR + Number -> VALIDATE_SELECTION
WAITING_FOR_TOUR + Conversational -> AI_HELP
WAITING_FOR_DATE + Date -> VALIDATE_DATE
WAITING_FOR_DATE + Conversational -> AI_HELP
// etc.
```

### AI Response Strategy
```typescript
// When AI is triggered during FSM:
1. Acknowledge current state
2. Answer user's question
3. Remind user what's needed
4. Provide helpful suggestions
5. Maintain booking context
```

## Success Criteria

### User Experience
- ✅ Users can chat freely without breaking the flow
- ✅ Natural language questions are answered intelligently
- ✅ Structured booking flow still works when needed
- ✅ No confusing validation errors
- ✅ Conversational feel throughout

### Technical Requirements
- ✅ Input classification accuracy > 90%
- ✅ FSM state management remains robust
- ✅ AI responses are context-aware
- ✅ Fallback mechanisms work reliably
- ✅ Performance remains acceptable

## Testing Scenarios

### Scenario 1: Natural Conversation
```
User: "Сайн байна уу"
Bot: 🤖 AI greeting response

User: "Хамгийн хямд аялал хайж байна"
Bot: 🤖 AI shows cheapest tours with explanations
```

### Scenario 2: Mixed Flow
```
User: "1" (select tour)
Bot: FSM: "Та Thailand аялалыг сонголоо. Хэзээ явах вэ?"

User: "Шагай аялалын онцлог юу вэ?"
Bot: 🤖 AI explains Thailand tour features, then reminds about date

User: "2026-06-01"
Bot: FSM: "Та 2026-06-01 огноог сонголоо. Хэдэн хүн явах вэ?"
```

### Scenario 3: Error Recovery
```
User: "хуурхнуу" (invalid input)
Bot: 🤖 AI: "Ямар аялал танд таалагдаж байна? Хамгийн хямд аялалуудыг санал болгож болох уу?"

User: "1"
Bot: FSM continues normally
```

## File Structure
```
backend/src/modules/chat/
├── routes.ts (update)
├── fsm.service.ts (update)
├── enhancedFsm.service.ts (new)
├── inputClassifier.ts (new)
├── hybridRouter.ts (new)
├── aiContextManager.ts (new)
└── types.ts (update)
```

## Next Steps
1. Implement input classifier
2. Create hybrid router
3. Enhance FSM service
4. Update AI integration
5. Test and refine