---
name: design-audit
description: Perform a full UI audit of the project before any redesign or refactor work. Identifies screens, components, patterns, inconsistencies, and alignment with .cursorrules.
---

# 🎯 Purpose

This skill is responsible for performing a full UI audit of the existing system.

It MUST be used before any redesign or refactor task.

The goal is to fully understand the current UI state, identify inconsistencies, and map all reusable components and patterns.

---

# 🧩 Instructions

## 1. Scan the project

- Identify all screens/pages in the application
- Identify shared components (buttons, cards, forms, modals, layouts, etc.)
- Map where each component is used

---

## 2. Identify UI patterns

Analyze and describe:

- Button variants and inconsistencies
- Card and container structures
- Form structure and validation patterns
- Tables and list layouts
- Spacing and layout consistency
- Typography usage
- Color usage vs .cursorrules
- Icon usage (Lucide consistency)

---

## 3. Detect inconsistencies

- Identify violations of `.cursorrules`
- Detect duplicated UI patterns
- Identify conflicting styles across screens
- Highlight areas where design is not consistent

---

## 4. Component reuse analysis

- Which components are reused correctly
- Which components are duplicated
- Which components should be unified

---

## 5. Output requirements

Return a structured audit with:

1. Screens inventory  
2. Shared components inventory  
3. Existing UI patterns  
4. Design inconsistencies  
5. Reuse vs duplication analysis  

---

# ⚠️ Rules

- Do NOT write code
- Do NOT refactor
- Do NOT suggest implementation yet
- Focus only on understanding and mapping

---

# ✅ Success Criteria

- Full understanding of current UI structure
- Clear identification of inconsistencies
- Clear mapping of reusable components