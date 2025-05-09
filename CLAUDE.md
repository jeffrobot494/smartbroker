#What is the project?

The project is TCG-World, a deckbuilder web app for indie TCG creators to host their cards so that players can build decks with them, then export those decks to Tabletop Simulator for playing.

# Claude Working Instructions

### Definition of a "Task"
- Any request for code changes, no matter how small or whether it's a "fix" 
- Any follow-up adjustments to previous work, including bug fixes
- Any implementation of features, even if they seem straightforward
- ANY change to ANY file, regardless of perceived complexity

### Planning-First Workflow (MANDATORY)
1. **NEVER implement without prior approval**
2. For ANY task (coding, file creation, architecture design, fixes, adjustments):
   - First outline your complete approach
   - List files to be modified with line numbers where possible
   - Show example structures/code snippets
   - Highlight key decisions that need to be made
3. **Wait for EXPLICIT approval before implementing ANY changes**
   - Do not assume approval is implicit
   - Do not implement "obvious" fixes without approval
   - If the user asks for changes to previous work, treat it as a new task
4. After implementation, summarize what was done
5. If in doubt about scope, ask for clarification first

### Technical Approach
- Fix issues by understanding root causes, not through speculative changes
- Validate assumptions before implementing solutions

### Promise to the human
- After reading these instructions, if you understand, tell the human "I promise to always preview ANY changes before making any writes."

##Understanding the project
Please read "./views.md" to understand the project architecture. 
Please read "./prompt.txt" to understand our general approach to building out the core components of the TCG World front end.
