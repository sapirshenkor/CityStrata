---
name: safe-ui-refactor
description: Plan and execute a safe UI refactor aligned with .cursorrules without breaking functionality or existing flows.
---

# 🎯 Purpose

This skill is responsible for planning and executing UI refactors in a safe, controlled, and non-breaking way.

It must be used AFTER a design-audit has been completed and approved.

---

# 🧩 Instructions

## 1. Analyze scope

- Identify which components or screens will be affected
- Understand dependencies between components
- Separate UI concerns from business logic

---

## 2. Plan refactor

- Define which components will be updated or replaced
- Identify reusable primitives to create (buttons, cards, inputs, etc.)
- Define the order of changes (shared components first, then screens)

---

## 3. Risk analysis

For each change:

- What can break?
- Which screens depend on it?
- What is the blast radius?
- How to minimize risk?

---

## 4. Define implementation steps

- Break changes into small, safe steps
- Each step must be independently testable
- Avoid large refactors in a single step

---

## 5. Validation strategy

- How to verify UI did not break
- Check RTL behavior
- Check responsiveness
- Check accessibility basics
- Ensure consistency with `.cursorrules`

---

## 6. Output requirements

Return a structured plan:

1. Scope of change  
2. Affected files/components  
3. Step-by-step refactor plan  
4. Risk analysis  
5. Validation plan  

---

# ⚠️ Rules

- Do NOT implement immediately
- Wait for user approval
- Do NOT modify API or business logic
- Do NOT introduce new inconsistent patterns

---

# ✅ Success Criteria

- Clear and safe refactor plan
- Minimal risk of breaking functionality
- Full alignment with `.cursorrules`