#!/bin/bash
# DEPRECATED — do not regenerate the landing page from this script.
# The marketing page is now honesty-gated:
#   - Hero = live ScanVerdict UI (components/landing/LandingHeroScanPanel.tsx)
#   - Stats = server queries (lib/landing/public-stats.ts → scan_history / system_metrics)
#   - LaunchLAB CTA = flag-driven (lib/landing/launchlab-card.ts + getLaunchControlState)
#   - Fee copy = flat platformFeeBps, not "only on profits"
#
# Entry points: app/page.tsx + app/landing/page.tsx → lib/landing/load-landing-page.tsx
set -euo pipefail
echo "ERROR: build-landing-page.sh is retired."
echo "Edit components/landing/LandingPageClient.tsx and lib/landing/* instead."
echo "This script used to overwrite app/landing/page.tsx with fabricated stats + robot-hero.png."
exit 1
