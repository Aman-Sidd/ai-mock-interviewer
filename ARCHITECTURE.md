# Architecture & Design Decisions

## Executive Summary

This is an **agentic AI system** that conducts mock interviews with automatic persona detection and real-time behavioral adaptation. Unlike passive chatbots, the system makes intelligent decisions about interview flow and adapts to user communication styles without explicit configuration.

---

## Core Philosophy

**Agentic ≠ Scripted**

Traditional Interview Bots:
```
User selects persona → System plays predetermined script → Output
```

**This System (Agentic)**:
```
User answers → System detects persona → System adapts behavior → Output
```

The AI **makes decisions** based on analysis, not user input.

---

## System Architecture

### 1. Frontend Layer (`app/` + `components/`)

#### Home Page (`app/page.tsx`)
- **Role Selector**: Software Engineer, Product Manager, Sales
- **Duration Slider**: 15-45 minutes
- **No Persona Selector**: (By design - this is automatic)
- **Error Handling**: Shows helpful messages if API fails

#### Interview Page (`app/interview/page.tsx`)
- Gets `sessionId` from URL params
- Renders `ChatInterface` component
- Switches to `FeedbackReport` on completion
- Handles interview lifecycle

#### ChatInterface (`components/ChatInterface.tsx`)
- Displays conversation history
- Text input for user answers
- Auto-scrolling messages
- Turn counter
- **Persona Badge**: Displays detected style once discovered
- Loading states with spinner

#### FeedbackReport (`components/FeedbackReport.tsx`)
- Shows overall score (1-10)
- Lists strengths/weaknesses
- Provides actionable tips
- Displays detected persona + analysis
- "Retake Interview" button

---

### 2. API Layer (`app/api/`)

#### POST `/api/start-interview`
```typescript
Request:
{
  role: "software_engineer" | "product_manager" | "sales",
  duration: number (15-45)
}

Response:
{
  sessionId: string,
  firstQuestion: string,
  maxTurns: number
}

Logic:
1. Generate session ID
2. Load system + role prompts
3. Call LLM to generate first question
4. Store session in memory
5. Return session + question
```

#### POST `/api/submit-answer`
```typescript
Request:
{
  sessionId: string,
  answer: string
}

Response:
{
  acknowledged: boolean,
  action: "followup" | "next-question" | "end-interview",
  assistantResponse: string,
  turnCount: number,
  maxTurns: number,
  detectedPersona: Persona | null
}

Logic:
1. Retrieve session
2. Add user answer to history
3. DETECT PERSONA (first time)
4. Analyze answer for depth
5. Decide action (followup/next/end)
6. Generate response with persona-aware prompt
7. Update session + return result
```

#### GET `/api/get-feedback`
```typescript
Request:
?sessionId=xyz

Response:
{
  feedback: {
    overallScore: 1-10,
    strengths: string[],
    weaknesses: string[],
    actionableTips: string[],
    roleEvaluation: string
  }
}

Logic:
1. Retrieve completed session
2. Build conversation summary
3. Call LLM with feedback prompt
4. Include detected persona in context
5. Parse + return structured feedback
```

---

### 3. Interview Engine (`lib/interviewEngine.ts`)

**Core Responsibility**: Session management + persona detection + decision-making

#### Key Functions

**`startSession(role, duration)`**
- Creates new session with `detectedPersona: null`
- Generates first question via LLM
- Stores in in-memory Map

**`submitAnswer(sessionId, answer)` ← CORE LOGIC**
```typescript
1. Add answer to session history
2. IF first answer:
   - Call detectPersona(user_answers)
   - Set session.detectedPersona
3. Analyze answer depth:
   - Call LLM with "followup_detector" prompt
4. DECIDE ACTION:
   - IF turnCount >= maxTurns: action = "end-interview"
   - ELSE IF shallow/vague: action = "followup"
   - ELSE: action = "next-question"
5. Generate response:
   - Get persona-aware prompt via addPersonaInstructions()
   - Call LLM with personalized instructions
   - Return action + response
```

**`detectPersona(answers): Persona`**
```typescript
// Heuristics-based detection (no LLM call needed)

Calculate: avgLength = total_words / num_answers

IF avgLength < 30:
  return "efficient"
ELSE IF avgLength > 150:
  return "chatty"
ELSE IF answers contain ["don't know", "um", "not sure", "maybe"]:
  return "confused"
ELSE:
  return "edge-case"
```

**`addPersonaInstructions(prompt, persona): string`**
```typescript
// Injects persona-aware tone into system prompt

EFFICIENT:
"Keep questions concise. Avoid lengthy explanations. 
Users prefer direct, focused interactions."

CHATTY:
"Users provide detailed answers. Acknowledge enthusiasm.
Gently redirect if they go off-topic. Explore more deeply."

CONFUSED:
"Users may seem uncertain. Be supportive and encouraging.
Offer to rephrase questions. Provide clarification."

EDGE-CASE:
"Users may provide off-topic or unexpected responses.
Stay professional. Redirect tactfully to interview scope."
```

**`generateFeedback(sessionId): FeedbackReport`**
- Builds conversation summary
- Includes detected persona in feedback prompt
- Parses JSON response
- Returns structured feedback

---

### 4. LLM Integration (`lib/openrouter.ts`)

**Model**: Deepseek Chat v3-0324 (via OpenRouter)

**Why Deepseek?**
- Free tier available
- Strong conversational abilities
- Fast inference
- Reliable for multi-turn conversations

**API Wrapper Features**:
- ✅ Automatic retries (5 attempts)
- ✅ Exponential backoff (1s → 2s → 4s → 8s → 16s)
- ✅ Special handling for 429 (rate limit) errors
- ✅ Message formatting for chat context
- ✅ Template variable substitution

**Request Pattern**:
```typescript
messages = [
  { role: "system", content: systemPrompt + personaInstructions },
  ...conversationHistory,
  { role: "user", content: latestUserMessage }
]

response = await openrouter.chat.completions.create({
  model: "deepseek/deepseek-chat-v3-0324:free",
  messages,
  temperature: 0.7,        // balanced creativity
  max_tokens: 1000
})
```

---

### 5. Prompt Engineering (`prompts/`)

#### `system_interviewer.txt`
Base instructions for realistic interview behavior:
- Professional tone
- Contextual questioning
- Follow-up logic
- Interview conclusion

#### `followup_detector.txt`
Analyzes answer quality:
```
Shallow answers (<50 words, vague) → "followup"
Good answers (50-150 words, specific) → "next-question"
Chatty answers (>150 words) → "next-question" (after redirect)
Confused answers (uncertain keywords) → "followup" (rephrase)
Irrelevant answers (off-topic) → "followup" (re-ask)
```

#### `feedback_generator.txt`
JSON template for feedback:
```json
{
  "overallScore": 1-10,
  "strengths": [
    "Specific accomplishment",
    "Communication quality"
  ],
  "weaknesses": [
    "Area needing improvement"
  ],
  "actionableTips": [
    "Next step to improve"
  ],
  "roleEvaluation": "Role-specific analysis"
}
```

#### `role_templates/software_engineer.txt`
- Question bank (15-20 questions)
- Mix: technical, behavioral, problem-solving
- Evaluation criteria (technical depth, communication, design thinking)

#### `role_templates/product_manager.txt`
- Focus: Strategy, prioritization, user empathy
- Questions: Product thinking, metrics, trade-offs

#### `role_templates/sales.txt`
- Focus: Client needs, negotiation, pipeline management
- Questions: Sales methodology, objection handling

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (Next.js + React)                         │
├─────────────────────────────────────────────────────────────┤
│  Home Page (Role Select) → Interview Page → Feedback Page   │
└───────────────┬──────────────────────────────────────────────┘
                │
                ↓ (HTTP Requests)
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│                  (Next.js Routes)                            │
├─────────────────────────────────────────────────────────────┤
│  /api/start-interview    POST → Initialize session          │
│  /api/submit-answer      POST → Detect & adapt              │
│  /api/get-feedback       GET  → Generate report             │
└───────────────┬──────────────────────────────────────────────┘
                │
                ↓ (Function Calls)
┌─────────────────────────────────────────────────────────────┐
│                 Interview Engine                             │
│          (lib/interviewEngine.ts)                            │
├─────────────────────────────────────────────────────────────┤
│  • Session Management (in-memory Map)                       │
│  • Persona Detection (heuristics)                           │
│  • Action Routing (followup/next/end)                       │
│  • Prompt Adaptation                                         │
│  • Feedback Generation                                       │
└───────────────┬──────────────────────────────────────────────┘
                │
                ↓ (LLM Calls)
┌─────────────────────────────────────────────────────────────┐
│                  OpenRouter SDK                              │
│              (lib/openrouter.ts)                             │
├─────────────────────────────────────────────────────────────┤
│  • Retry Logic (exponential backoff)                        │
│  • Message Formatting                                       │
│  • Error Handling                                           │
└───────────────┬──────────────────────────────────────────────┘
                │
                ↓ (HTTPS)
┌─────────────────────────────────────────────────────────────┐
│            Deepseek (via OpenRouter)                        │
│         (deepseek/deepseek-chat-v3-0324:free)              │
├─────────────────────────────────────────────────────────────┤
│  • Chat Completion                                          │
│  • Context Awareness                                        │
│  • Natural Responses                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Persona Detection: Deep Dive

### Detection Mechanism

**Timing**: After first user answer

**Input**: All user responses so far (usually just 1)

**Output**: One of 4 personas

### Heuristics

```typescript
function detectPersona(userAnswers: string[]): Persona {
  // 1. Calculate average word count
  const wordCounts = userAnswers.map(a => a.split(/\s+/).length)
  const avgLength = wordCounts.reduce((a, b) => a + b) / wordCounts.length

  // 2. Check for uncertainty keywords
  const hasUncertainty = userAnswers.some(a =>
    /don't know|not sure|um|uh|maybe|i think|probably/i.test(a)
  )

  // 3. Apply heuristics
  if (avgLength < 30) return "efficient"
  if (avgLength > 150) return "chatty"
  if (hasUncertainty) return "confused"
  return "edge-case"
}
```

### Why Heuristics (Not LLM)?
- ✅ Fast (no API call needed)
- ✅ Reliable (consistent rules)
- ✅ Cost-effective (saves tokens)
- ✅ Deterministic (same input = same output)

### Adaptation Examples

**Efficient User → Focused Questions**
```
System instruction added:
"Keep questions concise. Avoid lengthy explanations.
Users prefer direct, focused interactions."

Impact:
- Q1: "Describe your architecture"
- A1: "Microservices, 3 services, deployed on K8s" (10 words)
- Q2 (instead of follow-up): "What about your testing strategy?"
- No exploratory questions, no small talk
```

**Chatty User → Exploratory Follow-ups**
```
System instruction added:
"Users provide detailed answers. Acknowledge enthusiasm.
Gently redirect if they go off-topic. Explore more deeply."

Impact:
- Q1: "Describe your architecture"
- A1: "Well, we started with monolith... over time we realized...
       requirements changed... so we migrated to microservices..."
       (60 words)
- Q2 (follow-up): "That's great! You mentioned requirements changed.
       Specifically, how did you prioritize the migration?"
- Probing questions, more engagement
```

---

## Error Handling & Resilience

### API Errors
```
429 (Rate Limit)
├─ Retry with backoff: 3s, 6s, 12s, 24s, 48s
└─ Max 5 attempts

4XX/5XX (Other Errors)
├─ Retry with backoff: 1s, 2s, 4s, 8s, 16s
└─ Max 5 attempts
```

### Graceful Degradation
```
LLM Unreachable
├─ User sees: "AI service experiencing high demand. Try again soon."
└─ No system crash

Feedback Parsing Error
├─ Return default feedback (generic scores)
└─ Interview still completes

Session Not Found
├─ Clear error message
└─ User can start new interview
```

---

## Performance Considerations

### Time Complexity
```
start-interview:  1x LLM call
submit-answer:    2x LLM calls (detect + respond)
get-feedback:     1x LLM call
Total per interview: ~4 LLM calls for 4-turn interview
```

### Space Complexity
```
Per session: ~50KB (conversation history + metadata)
Max concurrent: 100 sessions ≈ 5MB (in-memory)
Suitable for MVP; upgrade to PostgreSQL for scale
```

---

## Design Trade-offs

| Decision | Why | Alternative | Cost |
|----------|-----|-------------|------|
| Auto persona detection | Agentic, natural | Manual selection | Loses "agentic" quality |
| Heuristics for detection | Fast, reliable | LLM-based | Slower, costs tokens |
| In-memory storage | Simple MVP | PostgreSQL | More setup |
| Deepseek model | Free tier | GPT-4 | Cost |
| Prompt injection | Fine-grained control | System prompts only | Less adaptation |

---

## Future Improvements

### Immediate
- Voice integration (STT/TTS)
- Database persistence
- Session history/analytics

### Medium-term
- Advanced persona detection (sentiment analysis)
- More interview roles
- Multi-language support

### Long-term
- Video interview recording
- Real-time behavioral coaching
- ML-based persona weighting

---

## Conclusion

This system prioritizes **agentic intelligence** through automatic persona detection and real-time behavioral adaptation. Every design decision serves the goal of demonstrating true AI decision-making rather than scripted responses.

**Key Differentiators**:
1. Persona is **detected**, not selected
2. Behavior **adapts** in real-time
3. System **decides** interview flow
4. User experience is **natural** and personalized
