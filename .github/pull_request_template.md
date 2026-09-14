<!-- Use PR title: [NAME] - [TOPIC] -->

# Requirements review

Use this template when reviewing a new or substantially changed requirements file. Each author writes **4–8 requirements** (functional or non-functional), then assigns another team member to review each requirement.

The checklist is based on the requirement-quality characteristics in [ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering](https://www.iso.org/standard/72089.html). This is a lightweight peer-review aid, not a formal compliance assessment.

## Review rules

1. Add 4–8 requirements, including functional, non-functional, or anti-requirements as appropriate.
2. Have another team member review each requirement. Spread reviews fairly across the team.
3. Review the requirement itself before debating its implementation. Ask for evidence, examples, or a test when the wording is unclear.
4. A reviewer may mark a check **Pass**, **Fix**, or **N/A**. Use **Fix** when the requirement needs a wording or scope change before approval.
5. The author resolves every **Fix** and the reviewer confirms the change.

## Assignment matrix

| Requirement / anti-requirement | Review status |
| --- | --- |
| The system shall display a confirmation message after a student completes a guided step. | Pending |
| The system shall load the main screen within 2 seconds after startup. | Pending |
| The system shall not energize a circuit that has been classified as hazardous. | Pending |
| The system shall store the student’s progress when a module step is approved. | Pending |

## Requirement review cards

Copy one card for each requirement. Keep the requirement text in the card so the review remains understandable even when the source file changes later.

### `<!-- short title -->`

**Author:** <!-- name -->
**Priority:** <!-- Must / Should / Could, if used -->

> <!-- Paste the requirement here. Prefer: “The system shall …” or “The system shall not …” for an anti-requirement. -->

**Anti-requirement:** <!-- What must the system explicitly not do? Write “None” if this requirement has no relevant forbidden behavior. -->

#### Quality checklist

| Check | Result | Notes or suggested change |
| --- | --- | --- |
| **Necessary** — Does this support a real stakeholder, system, or project need? | <!-- Pass / Fix / N/A --> | <!-- cite the need, or explain the gap --> |
| **Unambiguous** — Would reasonable readers interpret it the same way? Are vague terms, undefined acronyms, and hidden assumptions removed? | <!-- Pass / Fix / N/A --> | <!-- identify the ambiguous phrase --> |
| **Singular** — Does it state one capability, constraint, or quality at a time? | <!-- Pass / Fix / N/A --> | <!-- split compound behavior if needed --> |
| **Verifiable** — Can we prove it is satisfied through inspection, analysis, demonstration, or test? | <!-- Pass / Fix / N/A --> | <!-- describe the verification method --> |
| **Feasible** — Can the team deliver it within the project’s technology, time, budget, and other constraints? | <!-- Pass / Fix / N/A --> | <!-- name the constraint or assumption --> |
| **Complete** — Does it include the needed actor/system, behavior, conditions, limits, and observable outcome? | <!-- Pass / Fix / N/A --> | <!-- identify missing information --> |
| **Consistent** — Does it conflict with another requirement, decision, interface, or authoritative document? | <!-- Pass / Fix / N/A --> | <!-- link the conflict --> |
| **Traceable** — Can it be linked to its source need and to its design, implementation, or verification evidence? | <!-- Pass / Fix / N/A --> | <!-- add source, issue, test, or artifact link --> |

**Suggested rewrite (if needed):**

<!-- Write a complete replacement, or leave blank if no rewrite is needed. -->

**Decision:** <!-- Approved / Changes requested -->
**Author response:** <!-- What changed, or why no change was made -->
**Re-review completed:** <!-- Yes / No / N/A -->
