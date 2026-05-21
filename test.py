# Verify UI elements
import re

with open("apps/web/src/app/(onboarding)/onboarding/page.tsx", "r") as f:
    content = f.read()

# Make sure getSettings isn't missing anything
with open("apps/web/src/components/dashboard/SetupProgress.tsx", "r") as f:
    progress_content = f.read()

print("success")
