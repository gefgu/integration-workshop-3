# Requirements review

Use this template when reviewing a new or substantially changed requirements
file. Each author writes **4–8 requirements** (functional or non-functional),
then assigns another team member to review each requirement.

The checklist is based on the requirement-quality characteristics in
[ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle
processes — Requirements engineering](https://www.iso.org/standard/72089.html).
This is a lightweight peer-review aid, not a formal compliance assessment.

## Pull request information

| Field | Value |
| --- | --- |
| PR | <!-- link or number --> |
| Requirements file | <!-- path --> |
| Author(s) | <!-- names --> |
| Review deadline | <!-- date --> |
| Reviewers | <!-- names --> |

## Review rules

1. Add 4–8 requirements. Give each one a stable ID, such as `FR-01` or
   `NFR-01`.
2. Assign a reviewer who did not write that requirement. Spread assignments
   fairly across the team.
3. Review the requirement itself before debating its implementation. Ask for
   evidence, examples, or a test when the wording is unclear.
4. A reviewer may mark a check **Pass**, **Fix**, or **N/A**. Use **Fix** when
   the requirement needs a wording or scope change before approval.
5. The author resolves every **Fix** and the reviewer confirms the change.

## Assignment matrix

| Requirement ID | Type (`FR`/`NFR`) | Author | Reviewer | Review status |
| --- | --- | --- | --- | --- |
| <!-- e.g. FR-01 --> | <!-- functional / non-functional --> | <!-- name --> | <!-- name --> | <!-- Pending / Approved --> |
| <!-- e.g. NFR-01 --> | <!-- functional / non-functional --> | <!-- name --> | <!-- name --> | <!-- Pending / Approved --> |
| <!-- add rows until every requirement is assigned --> | | | | |

## Requirement review cards

Copy one card for each requirement. Keep the requirement text in the card so
the review remains understandable even when the source file changes later.

### `<!-- ID -->` — `<!-- short title -->`

**Type:** <!-- Functional / Non-functional  -->  
**Author:** <!-- name -->  
**Reviewer:** <!-- name -->  
**Priority:** <!-- Must / Should / Could, if used -->

> <!-- Paste the requirement here. Prefer: “The system shall …” -->

#### Quality checklist

| Check | Result | Reviewer note or suggested change |
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

**Reviewer decision:** <!-- Approved / Changes requested  -->  
**Author response:** <!-- What changed, or why no change was made -->  
**Re-review completed:** <!-- Yes / No / N/A -->

## Final review summary

| Item | Result |
| --- | --- |
| Every requirement has an author and a different reviewer | <!-- Yes / No --> |
| Every requirement has 4–8 entries per author | <!-- Yes / No --> |
| All checklist items are Pass or explicitly N/A | <!-- Yes / No --> |
| All requested changes are resolved and re-reviewed | <!-- Yes / No --> |
| Requirement IDs are unique and traceable to a source need | <!-- Yes / No --> |

**Overall decision:** <!-- Approved / Changes requested -->

**Open questions or follow-up issues:**

<!-- Link issues instead of hiding unresolved decisions in the requirement text. -->

