import re

with open("apps/web/src/app/(onboarding)/layout.tsx", "r") as f:
    content = f.read()

# remove the commented out old code
content = re.sub(r'/\*[\s\S]*?\*/\n', '', content)

with open("apps/web/src/app/(onboarding)/layout.tsx", "w") as f:
    f.write(content)
