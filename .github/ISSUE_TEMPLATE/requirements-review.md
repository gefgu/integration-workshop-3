---
name: Requirements review
about: Review 4–8 functional or non-functional requirements
title: "[NAME] - [TOPIC]"
labels: requirements
assignees: ""
---

# Requirements review

Each author writes **4–8 requirements** (functional or non-functional), then assigns another team member to review each requirement.

The checklist is based on the requirement-quality characteristics in [ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering](https://www.iso.org/standard/72089.html).

## Review rules

1. Add 4–8 requirements, including functional, non-functional, or anti-requirements as appropriate.
2. Assign a reviewer who did not write that requirement.
3. Review the requirement itself before debating its implementation.
4. Mark each check **Pass**, **Fix**, or **N/A**.
5. Resolve every **Fix** and ask the reviewer to confirm the change.

## Assignment matrix

| Requirement / anti-requirement | Type | Reviewer | Review status |
| --- | --- | --- | --- |
| The system shall display a confirmation message after a student completes a guided step. | Functional | Beatriz | Pending |
| The system shall load the main screen within 2 seconds after startup. | Non-functional | Carlos | Pending |
| The system shall not energize a circuit that has been classified as hazardous. | Anti-requirement | Alex | Pending |
| The system shall store the student’s progress when a module step is approved. | Functional | <!-- name --> | Pending |

## Requirement review cards

Copy one card for each requirement. An anti-requirement states something the system must explicitly not do.

### `<!-- short title -->`

**Type:** <!-- Functional / Non-functional / Anti-requirement -->
**Author:** <!-- name -->
**Reviewer:** <!-- name -->
**Priority:** <!-- Must / Should / Could, if used -->

> <!-- Paste the requirement here. Prefer: “The system shall …” or “The system shall not …” for an anti-requirement. -->

**Anti-requirement:** <!-- What must the system explicitly not do? Write “None” if this requirement has no relevant forbidden behavior. -->

#### Quality checklist

| Check | Result | Reviewer note or suggested change |
| --- | --- | --- |
| **Necessary** — Does this support a real stakeholder, system, or project need? | <!-- Pass / Fix / N/A --> | <!-- cite the need, or explain the gap --> |
| **Unambiguous** — Would reasonable readers interpret it the same way? | <!-- Pass / Fix / N/A --> | <!-- identify the ambiguous phrase --> |
| **Singular** — Does it state one capability, constraint, or quality at a time? | <!-- Pass / Fix / N/A --> | <!-- split compound behavior if needed --> |
| **Verifiable** — Can we prove it through inspection, analysis, demonstration, or test? | <!-- Pass / Fix / N/A --> | <!-- describe the verification method --> |
| **Feasible** — Can the team deliver it within the project constraints? | <!-- Pass / Fix / N/A --> | <!-- name the constraint or assumption --> |
| **Complete** — Does it include the needed actor/system, behavior, conditions, limits, and outcome? | <!-- Pass / Fix / N/A --> | <!-- identify missing information --> |
| **Consistent** — Does it conflict with another requirement or decision? | <!-- Pass / Fix / N/A --> | <!-- link the conflict --> |
| **Traceable** — Can it be linked to its source need and verification evidence? | <!-- Pass / Fix / N/A --> | <!-- add source, issue, test, or artifact link --> |

**Suggested rewrite (if needed):**

<!-- Write a complete replacement, or leave blank if no rewrite is needed. -->

**Reviewer decision:** <!-- Approved / Changes requested -->
**Author response:** <!-- What changed, or why no change was made -->
**Re-review completed:** <!-- Yes / No / N/A -->
