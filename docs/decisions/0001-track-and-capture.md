# ADR-0001: Track + Capture, no auto-apply

**Status**: Accepted
**Date**: 2026-05-09

## Context

The original ask included "somehow I can apply job via LinkedIn". Three interpretations exist:

1. **Track + capture**: log applications you submit manually
2. **Manual log only**: type entries into the dashboard
3. **Auto-apply bot**: tool fills LinkedIn Easy Apply forms

## Decision

Use **track + capture** — bookmarklet (Standard milestone) + Chrome extension (Full milestone) capture page metadata when the user clicks "apply" on an external site. The user always submits the application themselves through the company's own flow.

## Consequences

### Positive

- **ToS-compliant.** No automated form submission against LinkedIn or any company's site. No bot detection risk. No account-ban exposure.
- **Quality preserved.** Auto-applied applications are detectable by recruiters and dilute serious applications. Manual submission preserves quality.
- **Lower scope.** No headless browser automation, no bot-detection evasion, no Captcha solving. Capture is a one-route POST endpoint.
- **Resilient.** Bookmarklet survives LinkedIn UI changes (only depends on `document.title` and `window.location.href`); a true automation would break with any DOM change.

### Negative

- **Slightly higher friction than auto-apply.** User must click apply on the source site, then click bookmarklet. Mitigated: it's still one extra click vs. zero.
- **No automated volume.** Can't run "apply to 200 jobs" workflows. This is a feature, not a bug — see Quality preserved above.

## Alternatives rejected

- **Auto-apply bot**: violates LinkedIn ToS, account-ban risk, low application quality. Strongly rejected.
- **Manual log only (no capture)**: too much friction; users abandon. Capture solves the friction.

## References

- LinkedIn ToS: https://www.linkedin.com/legal/user-agreement (section 8.2 prohibits automated software accessing the service)
- Pattern reference: Huntr.co, Teal — both use capture extensions, neither auto-applies.
