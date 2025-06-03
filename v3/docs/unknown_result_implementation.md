# Unknown Result Type Implementation

## Overview
Add support for `TYPE: unknown_result` to handle cases where Claude cannot determine a definitive answer due to insufficient information.

## Implementation Steps

### 1. Update Research Engine Parsing (research-engine.js)

```javascript
// Line ~470: Update type matching regex
const typeMatch = typeLine.match(/TYPE:\s*(tool_use|positive_result|negative_result|unknown_result)/i);

// Line ~492: Update result type mapping
} else {
  const answer = lines[1] ? lines[1].trim() : '';
  const explanation = lines.slice(2).join('\n').trim();
  
  const typeMap = {
    'positive_result': 'positive',
    'negative_result': 'negative',
    'unknown_result': 'unknown'
  };
  
  return {
    type: typeMap[type],
    answer: answer,
    explanation: explanation,
    confidence_score: confidence_score
  };
}
```

### 2. Update System Prompt (resources/system_prompts.js or criteria.js)

```javascript
// Update the response instructions section:
`You should respond in one of four ways:
1. With a tool use request if you need more information
2. With a positive answer to the criterion 
3. With a negative answer to the criterion
4. With an unknown answer if insufficient information exists

Indicate the response type:
- "TYPE: tool_use" 
- "TYPE: positive_result"
- "TYPE: negative_result" 
- "TYPE: unknown_result"

Use unknown_result when research is insufficient, contradictory, or key information cannot be found.`
```

### 3. Update UI Display (research_gui.js)

```javascript
// In updateTableProgress() method around line 481:
if (result.type === 'error' || !result.answer) {
  cellClass += ' result-error';
  cellText = '✗';
} else if (result.type === 'unknown') {
  cellClass += ' result-unknown';
  cellText = '?';
} else if (criterion.disqualifying) {
  cellClass += result.type === 'positive' ? ' result-positive-disqualifying' : ' result-negative-disqualifying';
  cellText = result.answer;
} else {
  cellText = result.answer;
}
```

### 4. Update CSS (public/styles.css)

```css
.result-unknown {
  background-color: #fff3cd;
  color: #856404;
  text-align: center;
  font-weight: bold;
}

.result-error {
  background-color: #f8d7da;
  color: #721c24;
  text-align: center;
  font-weight: bold;
}
```

### 5. Ensure Disqualification Logic (research-engine.js)

```javascript
// Line ~154: Disqualification check should only check negative results
const isDisqualified = companyResults.some(result => 
  disqualifyingCriteria.includes(result.criterion) && 
  result.type === 'negative'  // Only negative disqualifies
);
```

## Key Benefits

- **Safe by default**: Unknown results cannot accidentally disqualify companies
- **Clear semantics**: Distinct from errors - unknown means "insufficient info" vs error means "system failure"  
- **User-friendly**: Clear visual distinction in the UI
- **Cost-effective**: Prevents unnecessary additional searches when information is genuinely unavailable

## Visual Design

- **Unknown results**: Yellow background with "?" symbol
- **Error results**: Red background with "✗" symbol
- **Positive/Negative**: Existing green/red styling for disqualifying criteria