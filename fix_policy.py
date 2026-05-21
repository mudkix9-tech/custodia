import re

with open("apps/api/src/routers/onboarding.ts", "r") as f:
    content = f.read()

content = content.replace("versionNumber: 1", "versionId: 'v1.0'")
content = content.replace(".set({ publishedAt: new Date() })", ".set({ status: 'published' })")

with open("apps/api/src/routers/onboarding.ts", "w") as f:
    f.write(content)
